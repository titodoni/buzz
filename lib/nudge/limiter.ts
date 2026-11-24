/** At most this many Nudges to anyone inside the window (buzz-trigger R4.5). */
export const NUDGE_LIMIT = 5
/** The window the limit counts over: 10 minutes. */
export const NUDGE_LIMIT_WINDOW_MS = 10 * 60_000
/** Shown when the sixth Nudge is blocked. */
export const NUDGE_LIMIT_MESSAGE = "Wait a moment before Nudging again"

/** Times (ms) of my recent Nudges, oldest first. It holds times only, never who. */
export type SentLog = readonly number[]

function recent(log: SentLog, now: number): number[] {
  return log.filter((t) => now - t < NUDGE_LIMIT_WINDOW_MS)
}

/** True when fewer than five Nudges went out in the last 10 minutes. */
export function canNudge(log: SentLog, now: number): boolean {
  return recent(log, now).length < NUDGE_LIMIT
}

/** The log with a Nudge sent at `now` added and old entries dropped. */
export function recordNudge(log: SentLog, now: number): number[] {
  return [...recent(log, now), now].slice(-NUDGE_LIMIT)
}

/**
 * Reads the log saved in localStorage. Anything missing or damaged gives an
 * empty log. A time in the future (a clock change) counts as now, so it can
 * never block Nudges for longer than the window. Only the latest five matter.
 * This is a courtesy limit on the sender's own client, not a server rule (R4.6).
 */
export function readSentLog(raw: string | null, now: number): number[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const times = parsed
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t))
    .map((t) => Math.min(t, now))
    .sort((a, b) => a - b)
  return recent(times, now).slice(-NUDGE_LIMIT)
}
