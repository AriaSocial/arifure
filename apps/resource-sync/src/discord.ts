import type { SyncSummary } from "./types"

interface LocalizeChangePreview {
  type: "Added" | "Updated" | "Deleted"
  key: string
  value?: string
}

interface NoticeChangePreview {
  type: "Added" | "Updated" | "Deleted"
  key: string
  title?: string
}

function truncate(value: string, maxLength = 120): string {
  const normalized = value.replace(/\r?\n/g, " ")
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

async function postWebhook(webhookUrl: string | undefined, payload: unknown): Promise<void> {
  if (!webhookUrl) return

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error("Discord webhook failed", response.status, await response.text())
    }
  } catch (error) {
    console.error("Discord webhook request failed", error)
  }
}

export async function notifyLocalize(
  webhookUrl: string | undefined,
  summary: SyncSummary,
  previews: LocalizeChangePreview[],
): Promise<void> {
  if (!summary.changed) return

  const lines = previews.slice(0, 20).map((change) => {
    const suffix = change.value === undefined ? "" : ` — ${truncate(change.value)}`
    return `• ${change.type}: \`${change.key}\`${suffix}`
  })
  if (summary.added + summary.updated + summary.deleted > previews.length) {
    lines.push("• ほかにも変更があります。")
  }

  await postWebhook(webhookUrl, {
    embeds: [
      {
        title: "Source updated (Localize.json)",
        description: lines.join("\n") || "コンテンツhashが更新されました。",
        fields: [
          { name: "Added", value: String(summary.added), inline: true },
          { name: "Updated", value: String(summary.updated), inline: true },
          { name: "Deleted", value: String(summary.deleted), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  })
}

export async function notifyNotices(
  webhookUrl: string | undefined,
  summary: SyncSummary,
  previews: NoticeChangePreview[],
): Promise<void> {
  if (!summary.changed) return

  const lines = previews.slice(0, 20).map((change) => {
    const title = change.title === undefined ? change.key : truncate(change.title, 160)
    return `• ${change.type}: ${title}`
  })

  await postWebhook(webhookUrl, {
    embeds: [
      {
        title: "Source updated (index)",
        description: lines.join("\n") || "コンテンツhashが更新されました。",
        fields: [
          { name: "Added", value: String(summary.added), inline: true },
          { name: "Updated", value: String(summary.updated), inline: true },
          { name: "Deleted", value: String(summary.deleted), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  })
}
