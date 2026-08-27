import { getResourceContentHash, runWriteChunks, updateResourceState } from "./db"
import { notifyNotices } from "./discord"
import { hashCanonical, sha256Hex } from "./hash"
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

interface PreparedNotice {
  key: string
  value: UpstreamNotice
  contentHash: string
  translations: Array<{
    locale: string
    title: string
    content: string
    contentHash: string
  }>
}

export async function syncNotices(env: Env): Promise<SyncSummary> {
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Notice fetch failed: ${response.status}`)

  const rawContent = await response.text()
  if (rawContent.length === 0) throw new Error("Notice response was empty")

  const datasetHash = await sha256Hex(rawContent)
  const storedHash = await getResourceContentHash(env.DB, RESOURCE)
  if (storedHash === datasetHash) {
    return { resource: RESOURCE, changed: false, added: 0, updated: 0, deleted: 0 }
  }

  const parsed = JSON.parse(rawContent) as unknown
  if (!Array.isArray(parsed)) throw new Error("Notice schema changed: expected an array")

  // Notice preparation is cold-path work and notices are a small collection;
  // process them concurrently only after the dataset-level hash changed.
  const prepared = await Promise.all(parsed.map((value) => prepareNotice(value)))
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

  // Each changed notice is one atomic D1 batch. Unchanged notices never load or
  // rewrite translations.
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

  const previews = [
    ...added.map((key) => ({ type: "Added" as const, key, title: incoming.get(key)?.value.title.ja ?? key })),
    ...updated.map((key) => ({ type: "Updated" as const, key, title: incoming.get(key)?.value.title.ja ?? key })),
    ...deleted.map((key) => ({ type: "Deleted" as const, key })),
  ]
  await notifyNotices(env.DISCORD_WEBHOOK_INDEX, summary, previews)

  return summary
}

async function writeNotice(db: D1Database, notice: PreparedNotice, now: number): Promise<void> {
  const value = notice.value
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

  for (const translation of notice.translations) {
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

async function prepareNotice(value: unknown): Promise<PreparedNotice> {
  if (!isUpstreamNotice(value)) throw new Error("Notice schema changed: invalid notice item")

  const key = `${value.sort}:${value.lastsTime}`
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

  return {
    key,
    value,
    contentHash: await hashCanonical(value),
    translations,
  }
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
