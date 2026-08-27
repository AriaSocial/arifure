import type { SyncSummary } from "./types"

export interface LocalizeChange {
  type: "Added" | "Updated" | "Deleted"
  key: string
  value: string
}

export interface NoticeChange {
  type: "Added" | "Updated"
  key: string
  title: string
  content: string
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
const LOCALIZE_VISIBLE_CHANGE_LIMIT = 12
const LOCALIZE_VALUE_PREVIEW_LENGTH = 120
const MAX_COMPONENTS_PER_MESSAGE = 40
const NOTICE_COMPONENTS_PER_CONTAINER = 6
const MAX_NOTICE_CONTAINERS_PER_MESSAGE = Math.floor(
  MAX_COMPONENTS_PER_MESSAGE / NOTICE_COMPONENTS_PER_CONTAINER,
)
const MAX_NOTICE_TEXT_PER_MESSAGE = 3_800
const MAX_NOTICE_TITLE_LENGTH = 240

function truncateSingleLine(value: string, maxLength: number): string {
  const normalized = value.replace(/\r?\n/g, " ")
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized
}

function truncateMultiline(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_~|>#[\]])/g, "\\$1")
}

function escapeInlineCode(value: string): string {
  return value.replace(/`/g, "｀").replace(/\r?\n/g, " ")
}

function webhookTarget(webhookUrl: string, withComponents: boolean): URL {
  const target = new URL(webhookUrl)
  target.searchParams.set("wait", "true")
  if (withComponents) target.searchParams.set("with_components", "true")
  return target
}

async function postComponentsWebhook(
  webhookUrl: string,
  payload: ComponentsV2Payload,
): Promise<void> {
  try {
    const response = await fetch(webhookTarget(webhookUrl, true), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error("Discord Components V2 webhook failed", response.status, await response.text())
    }
  } catch (error) {
    console.error("Discord Components V2 webhook request failed", error)
  }
}

async function postFileWebhook(
  webhookUrl: string,
  filename: string,
  content: string,
): Promise<void> {
  try {
    const form = new FormData()
    form.set(
      "payload_json",
      JSON.stringify({
        allowed_mentions: { parse: [] },
        attachments: [{ id: 0, filename }],
      }),
    )
    form.set(
      "files[0]",
      new Blob([content], { type: "text/plain;charset=utf-8" }),
      filename,
    )

    const response = await fetch(webhookTarget(webhookUrl, false), {
      method: "POST",
      body: form,
    })

    if (!response.ok) {
      console.error("Discord attachment webhook failed", response.status, await response.text())
    }
  } catch (error) {
    console.error("Discord attachment webhook request failed", error)
  }
}

function buildLocalizeFile(changes: readonly LocalizeChange[], detectedAt: number): string {
  const lines = [`Detected: ${detectedAt}`, ""]

  for (const change of changes) {
    lines.push(`${change.type}: ${change.key}`, change.value, "")
  }

  return `${lines.join("\n").trimEnd()}\n`
}

function buildLocalizePayload(
  summary: SyncSummary,
  changes: readonly LocalizeChange[],
  detectedAt: number,
): ComponentsV2Payload {
  const components: Array<TextDisplayComponent | SeparatorComponent> = [
    {
      type: 10,
      content: "## Source updated · Localize.json",
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
  ]

  for (const change of changes.slice(0, LOCALIZE_VISIBLE_CHANGE_LIMIT)) {
    const value = escapeMarkdown(
      truncateSingleLine(change.value, LOCALIZE_VALUE_PREVIEW_LENGTH),
    )
    components.push({
      type: 10,
      content: `**${change.type}:** \`${escapeInlineCode(change.key)}\`\n${value}`,
    })
  }

  if (changes.length > LOCALIZE_VISIBLE_CHANGE_LIMIT) {
    components.push({
      type: 10,
      content: `-# ほか ${changes.length - LOCALIZE_VISIBLE_CHANGE_LIMIT} 件の変更があります。`,
    })
  }

  components.push(
    {
      type: 14,
      divider: false,
      spacing: 1,
    },
    {
      type: 10,
      content: `-# Detected <t:${detectedAt}:R>`,
    },
  )

  return {
    flags: IS_COMPONENTS_V2,
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17,
        accent_color: ACCENT_COLOR,
        components,
      },
    ],
  }
}

export async function notifyLocalize(
  webhookUrl: string,
  summary: SyncSummary,
  changes: readonly LocalizeChange[],
  detectedAt: number,
): Promise<void> {
  const fileContent = buildLocalizeFile(changes, detectedAt)

  await postComponentsWebhook(
    webhookUrl,
    buildLocalizePayload(summary, changes, detectedAt),
  )

  await postFileWebhook(webhookUrl, `${detectedAt}.txt`, fileContent)
}

function buildNoticeContainer(change: NoticeChange): {
  container: ContainerComponent
  textLength: number
} {
  const title = escapeMarkdown(
    truncateSingleLine(change.title, MAX_NOTICE_TITLE_LENGTH),
  )
  const footer = `-# ${change.type}: \`${escapeInlineCode(change.key)}\``
  const fixedTextLength = title.length + footer.length + 3
  const bodyBudget = Math.max(256, MAX_NOTICE_TEXT_PER_MESSAGE - fixedTextLength)
  const body = escapeMarkdown(truncateMultiline(change.content, bodyBudget))

  return {
    textLength: fixedTextLength + body.length,
    container: {
      type: 17,
      accent_color: ACCENT_COLOR,
      components: [
        { type: 10, content: `## ${title}` },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: body },
        { type: 14, divider: false, spacing: 1 },
        { type: 10, content: footer },
      ],
    },
  }
}

function packNoticeMessages(changes: readonly NoticeChange[]): ComponentsV2Payload[] {
  const payloads: ComponentsV2Payload[] = []
  let containers: ContainerComponent[] = []
  let textLength = 0

  const flush = () => {
    if (containers.length === 0) return
    payloads.push({ flags: IS_COMPONENTS_V2, allowed_mentions: { parse: [] }, components: containers })
    containers = []
    textLength = 0
  }

  for (const change of changes) {
    const built = buildNoticeContainer(change)
    const exceedsComponentLimit = containers.length >= MAX_NOTICE_CONTAINERS_PER_MESSAGE
    const exceedsTextLimit = containers.length > 0 && textLength + built.textLength > MAX_NOTICE_TEXT_PER_MESSAGE
    if (exceedsComponentLimit || exceedsTextLimit) flush()
    containers.push(built.container)
    textLength += built.textLength
  }

  flush()
  return payloads
}

export async function notifyNotices(webhookUrl: string, changes: readonly NoticeChange[]): Promise<void> {
  for (const payload of packNoticeMessages(changes)) {
    await postComponentsWebhook(webhookUrl, payload)
  }
}
