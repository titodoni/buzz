import type { PresenceState } from "@/lib/presence/state"
import { UP_FOR_CHAT_TEXT } from "./upForChat"

/** The Message "Say hi" sends (buzz-trigger R2.3). */
export const SAY_HI_TEXT = "Hi! Saw you're up for chat :)"
/** A second tap inside this time only opens the Chat Window (R2.3). */
export const SAY_HI_GUARD_MS = 60_000

/**
 * A friend counts as Up for Chat while their Status says so and they are
 * Available. Anything else (Away, Busy, Offline) means the line is stale.
 */
export function isFriendUpForChat(status: string | null | undefined, presence: PresenceState): boolean {
  return presence === "online" && status === UP_FOR_CHAT_TEXT
}

/** True when a tap may send the greeting; `lastSentAt` is when this friend last got one from here. */
export function canSayHi(lastSentAt: number | undefined, now: number): boolean {
  return lastSentAt === undefined || now - lastSentAt >= SAY_HI_GUARD_MS
}
