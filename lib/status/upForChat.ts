/** Up for Chat: a one-tap Status that clears itself after an hour (buzz-trigger R2). */

export const UP_FOR_CHAT_TEXT = "Up for chat, say hi!"
export const UP_FOR_CHAT_MS = 60 * 60 * 1000
export const upForChatKey = (me: string) => `buzz:up-for-chat:${me}`

/** What Buzz remembers while Up for Chat is on. Lives in localStorage only (R2.4). */
export interface UpForChatState {
  /** Epoch ms when the user tapped the toggle. */
  startedAt: number
  /** The Status to put back; null means empty (R2.2). */
  previousText: string | null
}

/** The signed-in user's Status and Presence as the profile holds them now. */
export interface CurrentStatus {
  text: string | null
  availability: "online" | "away" | "busy" | "offline"
}

export type UpForChatAction =
  /** Nothing stored. */
  | { type: "none" }
  /** The user changed Status or Presence meanwhile; forget the state, write nothing (R2.2). */
  | { type: "drop" }
  /** Still on; check again after `remainingMs`. */
  | { type: "wait"; remainingMs: number }
  /** Time is up or the user tapped off; write `text` back (null clears it). */
  | { type: "restore"; text: string | null }

/** Tap on: remembers the old Status. The caller writes UP_FOR_CHAT_TEXT and Available. */
export function startUpForChat(currentText: string | null, now: number): UpForChatState {
  const previous = currentText?.trim() ? currentText : null
  // Never remember our own line as the "old" Status.
  return { startedAt: now, previousText: previous === UP_FOR_CHAT_TEXT ? null : previous }
}

/** True while the profile still shows what Up for Chat wrote. */
export function isStillUpForChat(current: CurrentStatus): boolean {
  return current.text === UP_FOR_CHAT_TEXT && current.availability === "online"
}

/**
 * Decides what to do with a stored state. Used by the timer, the toggle and
 * the app start alike. `tappedOff` forces a restore even before an hour has passed.
 */
export function evaluateUpForChat(
  state: UpForChatState | null,
  current: CurrentStatus,
  now: number,
  tappedOff = false,
): UpForChatAction {
  if (!state) return { type: "none" }
  if (!isStillUpForChat(current)) return { type: "drop" }
  const remaining = state.startedAt + UP_FOR_CHAT_MS - now
  if (tappedOff || remaining <= 0) return { type: "restore", text: state.previousText }
  return { type: "wait", remainingMs: remaining }
}

/** Reads the stored state; anything malformed counts as none. */
export function parseUpForChat(raw: string | null): UpForChatState | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v !== "object" || v === null) return null
    const { startedAt, previousText } = v as Record<string, unknown>
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null
    if (previousText !== null && typeof previousText !== "string") return null
    return { startedAt, previousText }
  } catch {
    return null
  }
}

export function loadUpForChat(store: Pick<Storage, "getItem">, me: string): UpForChatState | null {
  return parseUpForChat(store.getItem(upForChatKey(me)))
}

export function saveUpForChat(store: Pick<Storage, "setItem">, me: string, state: UpForChatState): void {
  store.setItem(upForChatKey(me), JSON.stringify(state))
}

export function clearUpForChat(store: Pick<Storage, "removeItem">, me: string): void {
  store.removeItem(upForChatKey(me))
}
