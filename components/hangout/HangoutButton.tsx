"use client"

import { useState } from "react"
import { HangoutPicker } from "./HangoutPicker"
import { busyHint, sendBlockReason } from "@/lib/hangout/state"
import { sendHangout } from "@/lib/hangout/api"
import type { PresenceState } from "@/lib/presence/state"

/**
 * The Hangout button in the Chat Window toolbar (buzz-trigger R3.1, R3.6 to
 * R3.8). Disabled with the reason written next to it when the friend is
 * Offline or a Hangout is already waiting.
 */
export function HangoutButton({
  me,
  friendId,
  friendName,
  friendPresence,
  hasPending,
  onNote,
}: {
  me: string
  friendId: string
  friendName: string
  friendPresence: PresenceState
  hasPending: boolean
  onNote: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const reason = sendBlockReason(friendPresence, hasPending)
  const reasonText =
    reason === "offline"
      ? `${friendName} is offline, so a Hangout can't be sent.`
      : reason === "pending"
        ? "A Hangout is already waiting for an answer."
        : null

  async function send(text: string) {
    setSending(true)
    const res = await sendHangout(me, friendId, text)
    setSending(false)
    setOpen(false)
    if (res.ok) {
      const hint = busyHint(friendPresence)
      onNote(hint ? `Hangout sent: ${text}. ${hint}.` : `Hangout sent: ${text}`)
    } else if (res.reason === "pending") {
      onNote("A Hangout is already waiting for an answer.")
    } else if (res.reason === "rate-limited") {
      onNote("That's a lot of Hangouts! Wait a few minutes before sending another.")
    } else if (res.reason === "invalid") {
      onNote("Write 1 to 60 characters for the Hangout.")
    } else {
      onNote("Couldn't send the Hangout. Try again.")
    }
  }

  return (
    <>
      <button
        type="button"
        className="ym-chip"
        title="Ask to hang out"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={reasonText ? "hangout-reason" : undefined}
        disabled={reason !== null || sending}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.4" fill="#ffe259" stroke="#7a5200" strokeWidth="1" />
          <circle cx="6.2" cy="6.6" r="0.85" fill="#3a2a00" />
          <circle cx="9.8" cy="6.6" r="0.85" fill="#3a2a00" />
          <path d="M5.4 9.2Q8 12 10.6 9.2" fill="none" stroke="#3a2a00" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        Hangout
      </button>
      {reasonText ? (
        <span id="hangout-reason" className="ym-chip-status text-xs">
          {reasonText}
        </span>
      ) : null}
      {open && reason === null ? <HangoutPicker onSend={(t) => void send(t)} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
