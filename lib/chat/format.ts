/**
 * Message formatting (Req 17.2 to 17.4). The same rules as the
 * `messages_format_valid` CHECK in migration 20250101001200.
 */

export const FONTS = ["Tahoma", "Verdana", "Arial", "Times New Roman"] as const
export type Font = (typeof FONTS)[number]

export const MIN_SIZE = 10
export const MAX_SIZE = 24

export interface MessageFormat {
  font: Font
  /** Points, MIN_SIZE to MAX_SIZE. */
  size: number
  /** Lowercase `#rrggbb`. */
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export const DEFAULT_FORMAT: MessageFormat = {
  font: "Tahoma",
  size: 10,
  color: "#000000",
  bold: false,
  italic: false,
  underline: false,
}

const KEYS = ["font", "size", "color", "bold", "italic", "underline"] as const
const COLOR = /^#[0-9a-f]{6}$/

function isFont(v: unknown): v is Font {
  return typeof v === "string" && (FONTS as readonly string[]).includes(v)
}

/**
 * The format to show a message in. Anything that is not exactly a valid
 * format (unknown font, size outside 10 to 24, bad color, extra keys) gives
 * the default format, never a partly repaired one (Req 17.4).
 */
export function parseFormat(value: unknown): MessageFormat {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return DEFAULT_FORMAT
  const r = value as Record<string, unknown> // narrowing an unknown object to read its fields
  if (Object.keys(r).length !== KEYS.length || !KEYS.every((k) => k in r)) return DEFAULT_FORMAT
  const { font, size, color, bold, italic, underline } = r
  if (!isFont(font)) return DEFAULT_FORMAT
  if (typeof size !== "number" || !Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) return DEFAULT_FORMAT
  if (typeof color !== "string" || !COLOR.test(color)) return DEFAULT_FORMAT
  if (typeof bold !== "boolean" || typeof italic !== "boolean" || typeof underline !== "boolean") return DEFAULT_FORMAT
  return { font, size, color, bold, italic, underline }
}

/** CSS font stacks, one per allowed font: the only font-family values Buzz ever writes. */
const FONT_STACKS: Record<Font, string> = {
  Tahoma: "Tahoma, Verdana, sans-serif",
  Verdana: "Verdana, Tahoma, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  "Times New Roman": '"Times New Roman", Times, serif',
}

export interface FormatStyle {
  fontFamily: string
  fontSize: string
  color: string
  fontWeight: 400 | 700
  fontStyle: "normal" | "italic"
  textDecoration: "none" | "underline"
}

/**
 * Inline style for a message. It validates again, so whatever it is given
 * (even a value that only claims to be a MessageFormat), every value comes
 * from a fixed list or a checked number or color, never from raw text.
 */
export function formatToStyle(format: MessageFormat): FormatStyle {
  const f = parseFormat(format)
  return {
    fontFamily: FONT_STACKS[f.font],
    fontSize: `${f.size}pt`,
    color: f.color,
    fontWeight: f.bold ? 700 : 400,
    fontStyle: f.italic ? "italic" : "normal",
    textDecoration: f.underline ? "underline" : "none",
  }
}
