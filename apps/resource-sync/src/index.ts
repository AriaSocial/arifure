import { syncLocalize } from "./localize"
import { syncNotices } from "./notices"
import type { Env } from "./types"

async function runScheduledSync(env: Env): Promise<void> {
  const results = await Promise.allSettled([syncLocalize(env), syncNotices(env)])
  const failures: unknown[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      console.log("Resource sync completed", result.value)
    } else {
      failures.push(result.reason)
      console.error("Resource sync failed", result.reason)
    }
  }

  if (failures.length === results.length) {
    throw new AggregateError(failures, "All resource sync jobs failed")
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledSync(env))
  },
} satisfies ExportedHandler<Env>
