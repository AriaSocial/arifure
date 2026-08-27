const encoder = new TextEncoder()
const decoder = new TextDecoder()

function digestToHex(digest: ArrayBuffer): string {
  const bytes = new Uint8Array(digest)
  let hex = ""
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index]!.toString(16).padStart(2, "0")
  }
  return hex
}

export async function sha256BytesHex(value: ArrayBuffer): Promise<string> {
  return digestToHex(await crypto.subtle.digest("SHA-256", value))
}

export async function sha256Hex(value: string): Promise<string> {
  return digestToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
}

export function decodeUtf8(value: ArrayBuffer): string {
  return decoder.decode(value)
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new TypeError("canonicalJson does not support undefined values")
    }
    return serialized
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`
  }

  const object = value as Record<string, unknown>
  const entries = Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
  return `{${entries.join(",")}}`
}

export async function hashCanonical(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value))
}
