"use client"

import { useState } from "react"
import { acceptRequest, declineRequest, type ApiResult, type RequestEntry } from "@/lib/friends/api"

export function PendingRequests({
  incoming,
  outgoing = [],
  onChanged,
}: {
  incoming: RequestEntry[]
  outgoing?: RequestEntry[]
  onChanged: () => void
}) {
  const [note, setNote] = useState<string | null>(null)

  if (incoming.length === 0 && outgoing.length === 0) return null

  async function act(fn: (id: string) => Promise<ApiResult>, id: string) {
    const res = await fn(id)
    setNote(res.message ?? null)
    if (res.ok) onChanged()
  }

  return (
    <section aria-label="Friend requests" className="border-t px-2 py-1">
      <h2 className="m-0 text-xs font-bold">Friend requests</h2>
      <ul className="m-0 list-none p-0">
        {incoming.map((r) => (
          <li key={r.friendshipId} className="ym-row flex items-center gap-1 px-1 py-1">
            <span className="min-w-0 flex-1 truncate font-bold">{r.displayName}</span>
            <button type="button" className="ym-button" onClick={() => void act(acceptRequest, r.friendshipId)}>
              Accept
            </button>
            <button type="button" className="ym-button" onClick={() => void act(declineRequest, r.friendshipId)}>
              Decline
            </button>
          </li>
        ))}
        {outgoing.map((r) => (
          <li key={r.friendshipId} className="ym-row flex items-center gap-1 px-1 py-1">
            <span className="min-w-0 flex-1 truncate">{r.displayName}</span>
            <span className="text-xs italic">Waiting...</span>
          </li>
        ))}
      </ul>
      <p role="status" className="min-h-4 text-xs">
        {note}
      </p>
    </section>
  )
}
