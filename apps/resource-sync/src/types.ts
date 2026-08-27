export interface Env {
  DB: D1Database
  DISCORD_WEBHOOK_LOCALIZE?: string
  DISCORD_WEBHOOK_INDEX?: string
  DISCORD_USERNAME?: string
  DISCORD_AVATAR_URL?: string
}

export interface SyncSummary {
  resource: string
  changed: boolean
  added: number
  updated: number
  deleted: number
}
