/** The ready-made Hangout lines (buzz-trigger R3.1). */
export const HANGOUT_TEMPLATES = [
  "Play a game?",
  "Just talk for a bit?",
  "Study together?",
  "Hop in a call elsewhere?",
] as const

/** Longest Hangout line, after trimming (R3.1). Matches the database check. */
export const HANGOUT_TEXT_MAX = 60

export type HangoutTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "too-long" }

/** Trims a template or custom line and checks it is 1 to 60 characters. */
export function validateHangoutText(input: string): HangoutTextResult {
  const text = input.trim()
  if (text.length === 0) return { ok: false, reason: "empty" }
  if (text.length > HANGOUT_TEXT_MAX) return { ok: false, reason: "too-long" }
  return { ok: true, text }
}
