import type { PresenceState } from "../presence/state"

/** Where the chat window with a friend stands when their message arrives. */
export type ChatWindowState = "closed" | "unfocused" | "focused"

export interface MessageAlertPlan {
  /** Open the chat window behind the others, without taking focus. */
  open: boolean
  /** Flash its taskbar entry. */
  flash: boolean
  sound: boolean
}

/** What to do when a friend's message arrives (Req 16.1, 16.2, 16.10). */
export function incomingMessagePlan(
  window: ChatWindowState,
  switches: { allSounds: boolean; messageSound: boolean },
): MessageAlertPlan {
  if (window === "focused") return { open: false, flash: false, sound: false }
  return { open: window === "closed", flash: true, sound: switches.allSounds && switches.messageSound }
}

export interface OnlineAlerts {
  /** Friends to announce with a Toast "<name> is now online". */
  toastFor: string[]
  sound: boolean
}

/**
 * Announces friends who went from Offline to Available (Req 16.4). Before
 * presence has `settled` after start-up, every friend "comes online" at once,
 * so nothing is announced then.
 */
export function friendOnlineAlerts(
  prev: Readonly<Record<string, PresenceState>>,
  next: Readonly<Record<string, PresenceState>>,
  opts: { settled: boolean; allSounds: boolean; onlineSound: boolean; onlineToast: boolean },
): OnlineAlerts {
  if (!opts.settled) return { toastFor: [], sound: false }
  const cameOnline = Object.keys(next).filter((id) => next[id] === "online" && (prev[id] ?? "offline") === "offline")
  return {
    toastFor: opts.onlineToast ? cameOnline : [],
    sound: cameOnline.length > 0 && opts.allSounds && opts.onlineSound,
  }
}
