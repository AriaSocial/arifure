import type { ResourceState } from "./types"

const WRITE_CHUNK_SIZE = 100

export async function getResourceState(db: D1Database, resource: string): Promise<ResourceState | null> {
  const row = await db
    .prepare(
      `SELECT content_hash, record_count, source_url, updated_at
       FROM resource_state
       WHERE resource = ?1`,
    )
    .bind(resource)
    .first<{
      content_hash: string
      record_count: number
      source_url: string
      updated_at: number
    }>()

  if (row === null) return null

  return {
    contentHash: row.content_hash,
    recordCount: row.record_count,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  }
}

export async function updateResourceState(
  db: D1Database,
  resource: string,
  contentHash: string,
  recordCount: number,
  sourceUrl: string,
  updatedAt: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO resource_state (resource, content_hash, record_count, source_url, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(resource) DO UPDATE SET
         content_hash = excluded.content_hash,
         record_count = excluded.record_count,
         source_url = excluded.source_url,
         updated_at = excluded.updated_at`,
    )
    .bind(resource, contentHash, recordCount, sourceUrl, updatedAt)
    .run()
}

export async function runWriteChunks(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (let index = 0; index < statements.length; index += WRITE_CHUNK_SIZE) {
    const chunk = statements.slice(index, index + WRITE_CHUNK_SIZE)
    if (chunk.length > 0) await db.batch(chunk)
  }
}
