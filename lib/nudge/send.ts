"use client"

import { sendNudgeToChat } from "@/lib/realtime/chat"
import { sendNudgeToInbox } from "@/lib/realtime/inbox"
import type { PresenceState } from "@/lib/presence/state"
import { isInCooldown } from "./cooldown"
import { NUDGE_LIMIT_MESSAGE, canNudge } from "./limiter"
import { loadCooldown, loadSentLog, recordDeliveredNudge } from "./store"

export type NudgeBackResult = "sent" | "offline" | "cooldown" | "limit" | "failed"

/**
 * "Nudge back" from Recent Nudges (buzz-trigger R4.4): a normal Nudge with the
 * same rules as the button. Offline friends are refused, the 10 second
 * per-friend cooldown and the 5-per-10-minutes limit apply, and a delivered
 * Nudge counts toward both. It goes to the pair's chat channel (an open
 * window shakes) and to the friend's inbox (a closed one opens), like ADR 0007.
 */
export async function sendNudgeBack(me: string, friendId: string, presence: PresenceState): Promise<NudgeBackResult> {
  if (presence === "offline") return "offline"
  const now = Date.now()
  if (isInCooldown(loadCooldown(friendId, now), now)) return "cooldown"
  if (!canNudge(loadSentLog(now), now)) return "limit"
  const results = await Promise.all([sendNudgeToChat(me, friendId), sendNudgeToInbox(me, friendId)])
  if (!results.some(Boolean)) return "failed"
  recordDeliveredNudge(friendId)
  return "sent"
}

/** What to tell the user after "Nudge back". */
export function nudgeBackText(result: NudgeBackResult, friendName: string): string {
  switch (result) {
    case "sent":
      return `You nudged ${friendName}`
    case "offline":
      return `${friendName} is offline.`
    case "cooldown":
      return "Wait a few seconds before Nudging this friend again."
    case "limit":
      return NUDGE_LIMIT_MESSAGE
    case "failed":
      return "Your buzz wasn't delivered. Try again."
  }
}
