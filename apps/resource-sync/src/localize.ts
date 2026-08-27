import { getResourceContentHash, updateResourceState } from "./db"
import { notifyLocalize, type LocalizeChange } from "./discord"
import { decodeUtf8, sha256BytesHex, sha256Hex } from "./hash"
import type { Env, SyncSummary } from "./types"

const RESOURCE = "localize:ja"
const BASE_GAME_ENTRY_URL = "https://h5.g123.jp/game/arifure?lang=ja"
const TARGET_FILE_SUFFIX = "/g123/i18n/ja/texts/Localize.json"
const HASH_CONCURRENCY = 200
const WRITE_CHUNK_SIZE = 100
const VALUE_READ_CHUNK_SIZE = 80

interface ExistingLocalizeRow {
  key: string
  content_hash: string
}

interface ExistingLocalizeValueRow {
  key: string
  value: string
}

export async function syncLocalize(env: Env): Promise<SyncSummary> {
  // The D1 hot-path lookup and dynamic source resolution are independent, so
  // overlap them instead of paying both network latencies serially.
  const [sourceUrl, storedHash] = await Promise.all([
    resolveLocalizeUrl(),
    getResourceContentHash(env.DB, RESOURCE),
  ])

  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Localize fetch failed: ${response.status}`)

  // Hash the response bytes directly. On the overwhelmingly common unchanged
  // path we never allocate/decode the ~3.7 MB JSON string at all.
  const sourceBytes = await response.arrayBuffer()
  if (sourceBytes.byteLength === 0) throw new Error("Localize response was empty")

  const datasetHash = await sha256BytesHex(sourceBytes)
  if (storedHash === datasetHash) {
    return { resource: RESOURCE, changed: false, added: 0, updated: 0, deleted: 0 }
  }

  const rawContent = decodeUtf8(sourceBytes)
  const parsed = JSON.parse(rawContent) as unknown
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Localize schema changed: expected a key-value object")
  }

  const incomingEntries = Object.entries(parsed as Record<string, unknown>)
  const incoming = new Map<string, { value: string; contentHash: string }>()

  // Per-record hashing is cold-path work and only runs after the single-row
  // dataset hash check reports a change. Bound WebCrypto concurrency to keep
  // memory predictable for the multi-megabyte localization source.
  for (let offset = 0; offset < incomingEntries.length; offset += HASH_CONCURRENCY) {
    const chunk = incomingEntries.slice(offset, offset + HASH_CONCURRENCY)
    const hashed = await Promise.all(
      chunk.map(async ([key, value]) => {
        if (typeof value !== "string") {
          throw new Error(`Localize schema changed: value for ${key} is not a string`)
        }
        return [key, { value, contentHash: await sha256Hex(value) }] as const
      }),
    )
    for (const [key, entry] of hashed) incoming.set(key, entry)
  }

  // Compare only keys and hashes; unchanged values are never read back from D1.
  const existingResult = await env.DB
    .prepare("SELECT key, content_hash FROM localize_entries WHERE locale = ?1")
    .bind("ja")
    .all<ExistingLocalizeRow>()
  const existing = new Map(existingResult.results.map((row) => [row.key, row.content_hash]))

  const added: string[] = []
  const updated: string[] = []
  const deleted: string[] = []

  for (const [key, entry] of incoming) {
    const oldHash = existing.get(key)
    if (oldHash === undefined) added.push(key)
    else if (oldHash !== entry.contentHash) updated.push(key)
  }

  for (const key of existing.keys()) {
    if (!incoming.has(key)) deleted.push(key)
  }

  const now = Date.now()
  const detectedAt = Math.floor(now / 1000)
  let discordChanges: LocalizeChange[] | null = null

  if (env.DISCORD_WEBHOOK_LOCALIZE) {
    // Added/updated values are already available in the upstream payload. Only
    // deleted values require a targeted D1 read before those rows are removed.
    const deletedValues = await getExistingValues(env.DB, deleted)
    discordChanges = []

    for (const key of added) {
      discordChanges.push({
        type: "Added",
        key,
        value: incoming.get(key)?.value ?? "",
      })
    }
    for (const key of updated) {
      discordChanges.push({
        type: "Updated",
        key,
        value: incoming.get(key)?.value ?? "",
      })
    }
    for (const key of deleted) {
      discordChanges.push({
        type: "Deleted",
        key,
        value: deletedValues.get(key) ?? "",
      })
    }
  }

  // Build and execute prepared statements one chunk at a time instead of
  // materializing statements for the complete dataset in Worker memory.
  const changedKeys = [...added, ...updated]
  for (let offset = 0; offset < changedKeys.length; offset += WRITE_CHUNK_SIZE) {
    const statements: D1PreparedStatement[] = []
    for (const key of changedKeys.slice(offset, offset + WRITE_CHUNK_SIZE)) {
      const entry = incoming.get(key)
      if (entry === undefined) continue
      statements.push(
        env.DB
          .prepare(
            `INSERT INTO localize_entries (locale, key, value, content_hash, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(locale, key) DO UPDATE SET
               value = excluded.value,
               content_hash = excluded.content_hash,
               updated_at = excluded.updated_at`,
          )
          .bind("ja", key, entry.value, entry.contentHash, now),
      )
    }
    if (statements.length > 0) await env.DB.batch(statements)
  }

  for (let offset = 0; offset < deleted.length; offset += WRITE_CHUNK_SIZE) {
    const statements = deleted
      .slice(offset, offset + WRITE_CHUNK_SIZE)
      .map((key) => env.DB.prepare("DELETE FROM localize_entries WHERE locale = ?1 AND key = ?2").bind("ja", key))
    if (statements.length > 0) await env.DB.batch(statements)
  }

  // Commit the dataset hash last. A partial failure therefore re-enters the
  // comparison path on the next one-minute Cron run and converges idempotently.
  await updateResourceState(env.DB, RESOURCE, datasetHash, incoming.size, sourceUrl, now)

  const summary: SyncSummary = {
    resource: RESOURCE,
    changed: added.length + updated.length + deleted.length > 0,
    added: added.length,
    updated: updated.length,
    deleted: deleted.length,
  }

  if (
    env.DISCORD_WEBHOOK_LOCALIZE &&
    summary.changed &&
    discordChanges !== null
  ) {
    await notifyLocalize(
      env.DISCORD_WEBHOOK_LOCALIZE,
      summary,
      discordChanges,
      detectedAt,
    )
  }

  return summary
}

async function getExistingValues(
  db: D1Database,
  keys: readonly string[],
): Promise<Map<string, string>> {
  const values = new Map<string, string>()

  for (let offset = 0; offset < keys.length; offset += VALUE_READ_CHUNK_SIZE) {
    const chunk = keys.slice(offset, offset + VALUE_READ_CHUNK_SIZE)
    if (chunk.length === 0) continue

    const placeholders = chunk.map(() => "?").join(",")
    const result = await db
      .prepare(
        `SELECT key, value
         FROM localize_entries
         WHERE locale = ? AND key IN (${placeholders})`,
      )
      .bind("ja", ...chunk)
      .all<ExistingLocalizeValueRow>()

    for (const row of result.results) values.set(row.key, row.value)
  }

  return values
}

async function resolveLocalizeUrl(): Promise<string> {
  const response = await fetch(BASE_GAME_ENTRY_URL)
  if (!response.ok) throw new Error(`Game entry fetch failed: ${response.status}`)

  const html = await response.text()
  const version = html.match(/arifure\.pro\.g123-cpp\.com\/(\d+)\//)?.[1]
  if (version === undefined) throw new Error("Could not resolve current G123 resource version")

  return `https://arifure.pro.g123-cpp.com/${version}${TARGET_FILE_SUFFIX}`
}
