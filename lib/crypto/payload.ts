import { parseFormat, type MessageFormat } from "../chat/format"
import { MESSAGE_BODY_MAX } from "../validation/profile"

/**
 * What goes inside an Encrypted Message: the text and its look, together
 * (ADR 0010). The database cannot read it, so these rules live in the app.
 */
export interface MessagePayload {
  body: string
  format: MessageFormat
}

/**
 * The most characters one stored cipher may have. A 1000 character body of
 * four-byte characters is about 4.2 KB of bytes, or 5.6 K base64 characters.
 * The database check in migration 20250101001600 must use this number.
 */
export const MAX_CIPHER_LENGTH = 6000

const chars = (s: string) => [...s].length

/** The same rule as the old plaintext column: 1 to 1000 characters and not blank. */
export function isValidBody(body: string): boolean {
  return body.trim() !== "" && chars(body) <= MESSAGE_BODY_MAX
}

export type EncodeResult = { ok: true; json: string } | { ok: false; reason: "empty" | "too long" }

export function encodePayload(body: string, format: MessageFormat): EncodeResult {
  if (body.trim() === "") return { ok: false, reason: "empty" }
  if (chars(body) > MESSAGE_BODY_MAX) return { ok: false, reason: "too long" }
  return { ok: true, json: JSON.stringify({ body, format }) }
}

/**
 * Reads decrypted text. A friend's app wrote it, so it is untrusted: a bad
 * shape gives null, and a bad format falls back to the default format.
 */
export function decodePayload(json: string): MessagePayload | null {
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null
  const r = v as Record<string, unknown> // narrowing an unknown object to read its fields
  const keys = Object.keys(r)
  if (keys.length !== 2 || !("body" in r) || !("format" in r)) return null
  if (typeof r.body !== "string" || !isValidBody(r.body)) return null
  return { body: r.body, format: parseFormat(r.format) }
}

/** True when a stored cipher is small enough for the database check. */
export function fitsCipher(cipher: string): boolean {
  return cipher.length <= MAX_CIPHER_LENGTH
}
