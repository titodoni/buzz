// localStorage adapters for the Nudge log, the send limit, the per-friend
// cooldown and the "chat opened" signal. The rules are in limiter.ts,
// recent.ts and cooldown.ts; this file only reads and writes. Everything here
// is a courtesy on this computer, not a server rule (buzz-trigger R4.6, ADR 0007).

import { readSentLog, recordNudge } from "./limiter"
import { addRecent, readRecent, type RecentNudge } from "./recent"
import { readStoredCooldown, type NudgeCooldown } from "./cooldown"

const SENT_KEY = "buzz:nudgeSentLog"
const RECENT_KEY = "buzz:recentNudges"
const SEEN_KEY = "buzz:chatSeen"

/** localStorage key holding when I last Nudged this friend (ms timestamp string). */
export function cooldownKey(friendId: string): string {
  return `buzz:nudgeCooldown:${friendId}`
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // storage unavailable
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Best effort: a full or blocked store only loses the log.
  }
}

/** My Nudges in the last 10 minutes, for the 5-per-10-minutes limit. */
export function loadSentLog(now: number = Date.now()): number[] {
  return readSentLog(read(SENT_KEY), now)
}

/** Records a delivered Nudge for the limit and starts that friend's 10 second cooldown. */
export function recordDeliveredNudge(friendId: string, now: number = Date.now()): void {
  write(SENT_KEY, JSON.stringify(recordNudge(loadSentLog(now), now)))
  write(cooldownKey(friendId), String(now))
}

/** The per-friend 10 second cooldown, restored from storage. */
export function loadCooldown(friendId: string, now: number = Date.now()): NudgeCooldown {
  return readStoredCooldown(read(cooldownKey(friendId)), now)
}

/** The Nudges I received, newest first. */
export function loadRecentNudges(now: number = Date.now()): RecentNudge[] {
  return readRecent(read(RECENT_KEY), now)
}

/** Adds a received Nudge and returns the saved list. */
export function saveReceivedNudge(nudge: RecentNudge, now: number = Date.now()): RecentNudge[] {
  const list = addRecent(loadRecentNudges(now), nudge)
  write(RECENT_KEY, JSON.stringify(list))
  return list
}

/**
 * A Chat Window tells the Buddy List it is open and in view, so the red count
 * on that friend's row clears (R4.2). Works across windows through the
 * `storage` event, like docs/adr/0008.
 */
export function announceChatSeen(friendId: string, now: number = Date.now()): void {
  write(SEEN_KEY, JSON.stringify({ friendId, at: now }))
}

/** Calls `onSeen(friendId)` when another window announces it. Returns an unsubscribe function. */
export function onChatSeen(onSeen: (friendId: string) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== SEEN_KEY || e.newValue === null) return
    try {
      const v: unknown = JSON.parse(e.newValue)
      const id = typeof v === "object" && v !== null ? (v as { friendId?: unknown }).friendId : undefined
      if (typeof id === "string") onSeen(id)
    } catch {
      // A damaged value is ignored.
    }
  }
  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}
