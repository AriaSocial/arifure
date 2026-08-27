const WRITE_CHUNK_SIZE = 100

/**
 * Hot-path lookup used by every one-minute Cron invocation. Read only the
 * dataset hash; all other resource metadata is cold-path information.
 */
export async function getResourceContentHash(db: D1Database, resource: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT content_hash FROM resource_state WHERE resource = ?1")
    .bind(resource)
    .first<{ content_hash: string }>()

  return row?.content_hash ?? null
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

export async function runWriteChunks(db: D1Database, statements: readonly D1PreparedStatement[]): Promise<void> {
  for (let index = 0; index < statements.length; index += WRITE_CHUNK_SIZE) {
    await db.batch(statements.slice(index, index + WRITE_CHUNK_SIZE))
  }
}
