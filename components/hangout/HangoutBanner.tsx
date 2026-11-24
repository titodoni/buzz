"use client"

import { useState } from "react"
import { respondHangout } from "@/lib/hangout/api"

/**
 * An incoming Hangout with Accept and Decline (buzz-trigger R3.2). Shared by
 * the Buddy List and the Chat Window. `onAnswered` runs after the database
 * took the answer.
 */
export function HangoutBanner({
  id,
  fromName,
  text,
  onAnswered,
}: {
  id: string
  fromName: string
  text: string
  onAnswered: (answer: "accepted" | "declined") => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function answer(status: "accepted" | "declined") {
    setBusy(true)
    setFailed(false)
    const ok = await respondHangout(id, status)
    setBusy(false)
    if (ok) onAnswered(status)
    else setFailed(true)
  }

  return (
    <section aria-label={`Hangout from ${fromName}`} className="border-b px-2 py-1" role="status" aria-live="polite">
      <p className="m-0 text-xs">
        <strong>{fromName}</strong> wants to hang out: {text}
      </p>
      <div className="mt-1 flex gap-1">
        <button type="button" className="ym-button" disabled={busy} onClick={() => void answer("accepted")}>
          Accept
        </button>
        <button type="button" className="ym-button" disabled={busy} onClick={() => void answer("declined")}>
          Decline
        </button>
      </div>
      {failed ? (
        <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
          That Hangout is no longer waiting.
        </p>
      ) : null}
    </section>
  )
}
