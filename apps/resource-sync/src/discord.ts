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

interface TextDisplayComponent {
  type: 10
  content: string
}

interface SeparatorComponent {
  type: 14
  divider: boolean
  spacing: 1 | 2
}

interface ContainerComponent {
  type: 17
  accent_color: number
  components: Array<TextDisplayComponent | SeparatorComponent>
}

interface ComponentsV2Payload {
  flags: number
  allowed_mentions: { parse: [] }
  components: ContainerComponent[]
}

const IS_COMPONENTS_V2 = 1 << 15
const ACCENT_COLOR = 0x00bcd1
const MAX_DETAIL_LENGTH = 3_500

function truncate(value: string, maxLength = 120): string {
  const normalized = value.replace(/\r?\n/g, " ")
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_~|>#[\]])/g, "\\$1")
}

function escapeInlineCode(value: string): string {
  return value.replace(/`/g, "｀").replace(/\r?\n/g, " ")
}

function buildPayload(title: string, summary: SyncSummary, detailLines: readonly string[]): ComponentsV2Payload {
  const detailText = detailLines.join("\n") || "コンテンツhashが更新されました。"
  const details =
    detailText.length > MAX_DETAIL_LENGTH
      ? `${detailText.slice(0, MAX_DETAIL_LENGTH)}…`
      : detailText
  const timestamp = Math.floor(Date.now() / 1000)

  return {
    flags: IS_COMPONENTS_V2,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        accent_color: ACCENT_COLOR,
        components: [
          {
            type: 10,
            content: `## ${title}`,
          },
          {
            type: 10,
            content: `**Added** ${summary.added.toLocaleString("en-US")}  ·  **Updated** ${summary.updated.toLocaleString("en-US")}  ·  **Deleted** ${summary.deleted.toLocaleString("en-US")}`,
          },
          {
            type: 14,
            divider: true,
            spacing: 1,
          },
          {
            type: 10,
            content: details,
          },
          {
            type: 14,
            divider: false,
            spacing: 1,
          },
          {
            type: 10,
            content: `-# Detected <t:${timestamp}:R>`,
          },
        ],
      },
    ],
  }
}

async function postWebhook(webhookUrl: string, payload: ComponentsV2Payload): Promise<void> {
  try {
    const target = new URL(webhookUrl)
    target.searchParams.set("with_components", "true")
    target.searchParams.set("wait", "true")

    const response = await fetch(target, {
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
  webhookUrl: string,
  summary: SyncSummary,
  previews: readonly LocalizeChangePreview[],
): Promise<void> {
  const lines = previews.map((change) => {
    const suffix =
      change.value === undefined
        ? ""
        : ` — ${escapeMarkdown(truncate(change.value))}`
    return `- **${change.type}** · \`${escapeInlineCode(change.key)}\`${suffix}`
  })
  if (summary.added + summary.updated + summary.deleted > previews.length) {
    lines.push("- ほかにも変更があります。")
  }

  await postWebhook(
    webhookUrl,
    buildPayload("Source updated · Localize.json", summary, lines),
  )
}

export async function notifyNotices(
  webhookUrl: string,
  summary: SyncSummary,
  previews: readonly NoticeChangePreview[],
): Promise<void> {
  const lines = previews.map((change) => {
    const title =
      change.title === undefined
        ? escapeMarkdown(change.key)
        : escapeMarkdown(truncate(change.title, 160))
    return `- **${change.type}** · ${title}`
  })
  if (summary.added + summary.updated + summary.deleted > previews.length) {
    lines.push("- ほかにも変更があります。")
  }

  await postWebhook(
    webhookUrl,
    buildPayload("Source updated · index", summary, lines),
  )
}
