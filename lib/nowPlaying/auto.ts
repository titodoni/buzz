import { NOW_PLAYING_MAX } from "../validation/profile"

/** What the OS says is playing: [artist or null, title], or null for nothing. */
export type OsTrack = readonly [string | null, string] | null

/** After playback stops, wait this long before clearing Now Playing (R7.3). */
export const PAUSE_GRACE_MS = 30_000
/** At most one profile write per this interval (R7.5). */
export const WRITE_EVERY_MS = 10_000

/** "Artist - Title", or the title alone, cut to the stored limit (R7.2). */
export function formatTrack(track: OsTrack): string | null {
  if (!track) return null
  const [artist, title] = track
  const t = title.trim()
  if (t === "") return null
  const a = artist?.trim()
  const line = a ? `${a} - ${t}` : t
  return [...line].slice(0, NOW_PLAYING_MAX).join("")
}

export interface AutoState {
  /** Line from the OS right now; null when nothing plays. */
  seen: string | null
  /** When playback stopped; null while playing or before the first stop. */
  stoppedAt: number | null
  /** What the profile holds now, as far as this window knows. */
  shown: string | null
  /** The user's own hand-typed line, restored when playback stops. */
  manual: string | null
  /** True after the user types a line, until the next track change (R7.4). */
  manualWins: boolean
  lastWriteAt: number | null
}

export type AutoEvent =
  | { type: "track"; line: string | null; now: number }
  | { type: "manual"; line: string | null }
  | { type: "written"; line: string | null; now: number }

/** Starts from the profile's current line. `lastAuto` is the last line Buzz wrote itself. */
export function initAuto(profileLine: string | null, saved: { manual: string | null; lastAuto: string | null }): AutoState {
  // If the profile still holds Buzz's own last line, the hand-typed one is the saved one.
  const ours = profileLine !== null && profileLine === saved.lastAuto
  return {
    seen: null,
    stoppedAt: null,
    shown: profileLine,
    manual: ours ? saved.manual : profileLine,
    manualWins: false,
    lastWriteAt: null,
  }
}

export function stepAuto(s: AutoState, e: AutoEvent): AutoState {
  switch (e.type) {
    case "track":
      if (e.line === s.seen) return s
      if (e.line !== null) return { ...s, seen: e.line, stoppedAt: null, manualWins: false }
      return { ...s, seen: null, stoppedAt: e.now }
    case "manual":
      return { ...s, manual: e.line, shown: e.line, manualWins: true }
    case "written":
      return { ...s, shown: e.line, lastWriteAt: e.now }
  }
}

export type AutoDecision =
  | { kind: "none" }
  | { kind: "write"; line: string | null }
  /** Something should change, but not before `at`. */
  | { kind: "wait"; at: number }

/** What the profile should say now, and whether to write it. */
export function decideAuto(s: AutoState, now: number): AutoDecision {
  if (s.manualWins) return { kind: "none" }
  let target: string | null
  if (s.seen !== null) target = s.seen
  else if (s.stoppedAt === null) return { kind: "none" }
  else if (now - s.stoppedAt < PAUSE_GRACE_MS) return { kind: "wait", at: s.stoppedAt + PAUSE_GRACE_MS }
  else target = s.manual
  if (target === s.shown) return { kind: "none" }
  if (s.lastWriteAt !== null && now - s.lastWriteAt < WRITE_EVERY_MS) {
    return { kind: "wait", at: s.lastWriteAt + WRITE_EVERY_MS }
  }
  return { kind: "write", line: target }
}
