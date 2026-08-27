import { getResourceState, runWriteChunks, updateResourceState } from "./db"
import { notifyLocalize } from "./discord"
import { sha256Hex } from "./hash"
import type { Env, SyncSummary } from "./types"

const RESOURCE = "localize:ja"
const BASE_GAME_ENTRY_URL = "https://h5.g123.jp/game/arifure?lang=ja"
const TARGET_FILE_SUFFIX = "/g123/i18n/ja/texts/Localize.json"
const HASH_CONCURRENCY = 200

interface ExistingLocalizeRow {
  key: string
  content_hash: string
}

export async function syncLocalize(env: Env): Promise<SyncSummary> {
  const sourceUrl = await resolveLocalizeUrl()
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Localize fetch failed: ${response.status}`)

  const rawContent = await response.text()
  if (rawContent.length === 0) throw new Error("Localize response was empty")

  const datasetHash = await sha256Hex(rawContent)
  const state = await getResourceState(env.DB, RESOURCE)
  if (state?.contentHash === datasetHash) {
    return { resource: RESOURCE, changed: false, added: 0, updated: 0, deleted: 0 }
  }

  const parsed = JSON.parse(rawContent) as unknown
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Localize schema changed: expected a key-value object")
  }

  const incomingEntries = Object.entries(parsed as Record<string, unknown>)
  const incoming = new Map<string, { value: string; contentHash: string }>()

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
  const writes: D1PreparedStatement[] = []

  for (const key of [...added, ...updated]) {
    const entry = incoming.get(key)
    if (entry === undefined) continue
    writes.push(
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

  for (const key of deleted) {
    writes.push(env.DB.prepare("DELETE FROM localize_entries WHERE locale = ?1 AND key = ?2").bind("ja", key))
  }

  await runWriteChunks(env.DB, writes)
  await updateResourceState(env.DB, RESOURCE, datasetHash, incoming.size, sourceUrl, now)

  const summary: SyncSummary = {
    resource: RESOURCE,
    changed: added.length + updated.length + deleted.length > 0,
    added: added.length,
    updated: updated.length,
    deleted: deleted.length,
  }

  const previews = [
    ...added.map((key) => ({ type: "Added" as const, key, value: incoming.get(key)?.value ?? "" })),
    ...updated.map((key) => ({ type: "Updated" as const, key, value: incoming.get(key)?.value ?? "" })),
    ...deleted.map((key) => ({ type: "Deleted" as const, key })),
  ]
  await notifyLocalize(env.DISCORD_WEBHOOK_LOCALIZE, summary, previews)

  return summary
}

async function resolveLocalizeUrl(): Promise<string> {
  const response = await fetch(BASE_GAME_ENTRY_URL)
  if (!response.ok) throw new Error(`Game entry fetch failed: ${response.status}`)

  const html = await response.text()
  const version = html.match(/arifure\.pro\.g123-cpp\.com\/(\d+)\//)?.[1]
  if (version === undefined) throw new Error("Could not resolve current G123 resource version")

  return `https://arifure.pro.g123-cpp.com/${version}${TARGET_FILE_SUFFIX}`
}
