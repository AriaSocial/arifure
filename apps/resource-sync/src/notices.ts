import { getResourceContentHash, runWriteChunks, updateResourceState } from "./db"
import { notifyNotices, type NoticeChange } from "./discord"
import { decodeUtf8, hashCanonical, sha256BytesHex } from "./hash"
import type { Env, SyncSummary } from "./types"

const RESOURCE = "notices"
const SOURCE_URL = "https://arifure-slb.pro.g123-cpp.com/gm/index.php?g=&m=data&a=out_notice&game=arifure&owner="

interface UpstreamNotice {
  title: Record<string, string>
  content: Record<string, string>
  sort: string
  stime: string
  etime: string
  utime: string
  coverpic: string
  lastsTime: number
  lasteTime: number
  lastuTime: number
}

interface ExistingNoticeRow {
  notice_key: string
  content_hash: string
}

interface HashedNotice {
  key: string
  value: UpstreamNotice
  contentHash: string
}

export async function syncNotices(env: Env): Promise<SyncSummary> {
  const storedHashPromise = getResourceContentHash(env.DB, RESOURCE)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Notice fetch failed: ${response.status}`)

  const sourceBytes = await response.arrayBuffer()
  if (sourceBytes.byteLength === 0) throw new Error("Notice response was empty")

  const [datasetHash, storedHash] = await Promise.all([
    sha256BytesHex(sourceBytes),
    storedHashPromise,
  ])
  if (storedHash === datasetHash) {
    return { resource: RESOURCE, changed: false, added: 0, updated: 0, deleted: 0 }
  }

  const parsed = JSON.parse(decodeUtf8(sourceBytes)) as unknown
  if (!Array.isArray(parsed)) throw new Error("Notice schema changed: expected an array")

  const prepared = await Promise.all(parsed.map((value) => hashNotice(value)))
  const incoming = new Map(prepared.map((notice) => [notice.key, notice]))

  if (incoming.size !== prepared.length) {
    throw new Error("Notice identity collision detected; sort:lastsTime is no longer unique")
  }

  const existingResult = await env.DB
    .prepare("SELECT notice_key, content_hash FROM notices WHERE active = 1")
    .all<ExistingNoticeRow>()
  const existing = new Map(existingResult.results.map((row) => [row.notice_key, row.content_hash]))

  const added: string[] = []
  const updated: string[] = []
  const deleted: string[] = []

  for (const [key, notice] of incoming) {
    const oldHash = existing.get(key)
    if (oldHash === undefined) added.push(key)
    else if (oldHash !== notice.contentHash) updated.push(key)
  }

  for (const key of existing.keys()) {
    if (!incoming.has(key)) deleted.push(key)
  }

  const now = Date.now()

  for (const key of [...added, ...updated]) {
    const notice = incoming.get(key)
    if (notice !== undefined) await writeNotice(env.DB, notice, now)
  }

  const removalWrites = deleted.map((key) =>
    env.DB
      .prepare("UPDATE notices SET active = 0, removed_at = ?2, updated_at = ?2 WHERE notice_key = ?1")
      .bind(key, now),
  )
  await runWriteChunks(env.DB, removalWrites)

  await updateResourceState(env.DB, RESOURCE, datasetHash, incoming.size, SOURCE_URL, now)

  const summary: SyncSummary = {
    resource: RESOURCE,
    changed: added.length + updated.length + deleted.length > 0,
    added: added.length,
    updated: updated.length,
    deleted: deleted.length,
  }

  if (env.DISCORD_WEBHOOK_INDEX && added.length + updated.length > 0) {
    const changes: NoticeChange[] = []

    for (const key of added) {
      const notice = incoming.get(key)?.value
      if (notice === undefined) continue
      changes.push({
        type: "Added",
        key,
        title: localizedValue(notice.title, key),
        content: localizedValue(notice.content, ""),
      })
    }

    for (const key of updated) {
      const notice = incoming.get(key)?.value
      if (notice === undefined) continue
      changes.push({
        type: "Updated",
        key,
        title: localizedValue(notice.title, key),
        content: localizedValue(notice.content, ""),
      })
    }

    await notifyNotices(env.DISCORD_WEBHOOK_INDEX, changes, {
      username: env.DISCORD_USERNAME,
      avatarUrl: env.DISCORD_AVATAR_URL,
    })
  }

  return summary
}

function localizedValue(values: Record<string, string>, fallback: string): string {
  return values.ja ?? Object.values(values)[0] ?? fallback
}

async function hashNotice(value: unknown): Promise<HashedNotice> {
  if (!isUpstreamNotice(value)) throw new Error("Notice schema changed: invalid notice item")

  return {
    key: `${value.sort}:${value.lastsTime}`,
    value,
    contentHash: await hashCanonical(value),
  }
}

async function writeNotice(db: D1Database, notice: HashedNotice, now: number): Promise<void> {
  const value = notice.value
  const locales = new Set([...Object.keys(value.title), ...Object.keys(value.content)])
  const translations = await Promise.all(
    Array.from(locales).map(async (locale) => {
      const title = value.title[locale] ?? ""
      const content = value.content[locale] ?? ""
      return {
        locale,
        title,
        content,
        contentHash: await hashCanonical({ title, content }),
      }
    }),
  )

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO notices (
           notice_key, sort, stime, etime, utime, lasts_time, laste_time, lastu_time,
           coverpic, content_hash, active, first_seen_at, updated_at, removed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11, NULL)
         ON CONFLICT(notice_key) DO UPDATE SET
           sort = excluded.sort,
           stime = excluded.stime,
           etime = excluded.etime,
           utime = excluded.utime,
           lasts_time = excluded.lasts_time,
           laste_time = excluded.laste_time,
           lastu_time = excluded.lastu_time,
           coverpic = excluded.coverpic,
           content_hash = excluded.content_hash,
           active = 1,
           updated_at = excluded.updated_at,
           removed_at = NULL`,
      )
      .bind(
        notice.key,
        value.sort,
        value.stime,
        value.etime,
        value.utime,
        value.lastsTime,
        value.lasteTime,
        value.lastuTime,
        value.coverpic,
        notice.contentHash,
        now,
      ),
    db.prepare("DELETE FROM notice_translations WHERE notice_key = ?1").bind(notice.key),
  ]

  for (const translation of translations) {
    statements.push(
      db
        .prepare(
          `INSERT INTO notice_translations (
             notice_key, locale, title, content, content_hash, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(
          notice.key,
          translation.locale,
          translation.title,
          translation.content,
          translation.contentHash,
          now,
        ),
    )
  }

  await db.batch(statements)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    Object.values(value).every((entry) => typeof entry === "string")
  )
}

function isUpstreamNotice(value: unknown): value is UpstreamNotice {
  if (value === null || Array.isArray(value) || typeof value !== "object") return false
  const notice = value as Record<string, unknown>

  return (
    isStringRecord(notice.title) &&
    isStringRecord(notice.content) &&
    typeof notice.sort === "string" &&
    typeof notice.stime === "string" &&
    typeof notice.etime === "string" &&
    typeof notice.utime === "string" &&
    typeof notice.coverpic === "string" &&
    typeof notice.lastsTime === "number" &&
    typeof notice.lasteTime === "number" &&
    typeof notice.lastuTime === "number"
  )
}
