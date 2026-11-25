"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  acceptRequest,
  declineRequest,
  searchProfiles,
  sendFriendRequest,
  type FriendEntry,
  type PublicProfile,
  type RequestEntry,
} from "@/lib/friends/api"
import { searchResultRelation } from "@/lib/friends/search"

export interface FriendSearchProps {
  me: string
  friends?: readonly FriendEntry[]
  incoming?: readonly RequestEntry[]
  outgoing?: readonly RequestEntry[]
  /** People I ignore: their requests stay hidden, so search must not offer to accept them. */
  ignoredIds?: ReadonlySet<string>
  onSent?: () => void
  initialQuery?: string
}

export function FriendSearch({
  me,
  friends = [],
  incoming = [],
  outgoing = [],
  ignoredIds,
  onSent,
  initialQuery = "",
}: FriendSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PublicProfile[] | null>(null)
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const run = useCallback(
    async (q: string) => {
      setBusy(true)
      setNote(null)
      setSentIds(new Set())
      try {
        setResults(await searchProfiles(q, me))
      } catch {
        setResults(null)
        setNote("Search didn't work. Please try again.")
      } finally {
        setBusy(false)
      }
    },
    [me],
  )
  // An email typed into the Buddy List search box is searched right away (Req 14.10).
  useEffect(() => {
    if (!initialQuery.trim()) return
    let active = true
    queueMicrotask(() => {
      if (active) void run(initialQuery)
    })
    return () => {
      active = false
    }
  }, [initialQuery, run])
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await run(query)
  }

  async function add(p: PublicProfile) {
    const res = await sendFriendRequest(me, p.id)
    setNote(res.message ?? null)
    if (res.ok) {
      setSentIds((prev) => new Set(prev).add(p.id))
    }
    onSent?.()
  }

  async function respond(fn: (id: string) => Promise<{ ok: boolean; message?: string }>, friendshipId: string) {
    const res = await fn(friendshipId)
    setNote(res.message ?? null)
    if (res.ok) onSent?.()
  }

  return (
    <section aria-label="Find a friend" className="border-b p-2">
      <form onSubmit={onSubmit} role="search" className="flex gap-1">
        <input
          type="search"
          aria-label="Search by display name or email"
          placeholder="3+ letters of a name, or exact email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded border px-2 py-1"
        />
        <button type="submit" className="ym-button" disabled={busy}>
          Search
        </button>
      </form>
      <p role="status" className="mt-1 min-h-4 text-xs">
        {note}
      </p>
      {results && results.length === 0 ? <p className="text-xs">No one found. Type at least 3 letters of their name, or their exact email.</p> : null}
      <ul className="m-0 list-none p-0">
        {results?.map((p) => {
          const rel = searchResultRelation(p.id, { friends, incoming, outgoing }, sentIds)
          return (
            <li key={p.id} className="ym-row flex items-center justify-between gap-1 px-1 py-1">
              <span className="min-w-0 flex-1 truncate font-bold">{p.displayName}</span>
              {rel.kind === "none" ? (
                <button type="button" className="ym-button" onClick={() => void add(p)}>
                  Add
                </button>
              ) : rel.kind === "incoming" && ignoredIds?.has(p.id) ? (
                <span className="text-xs italic">Ignored</span>
              ) : rel.kind === "incoming" ? (
                <>
                  <button type="button" className="ym-button" onClick={() => void respond(acceptRequest, rel.friendshipId)}>
                    Accept
                  </button>
                  <button type="button" className="ym-button" onClick={() => void respond(declineRequest, rel.friendshipId)}>
                    Decline
                  </button>
                </>
              ) : rel.kind === "outgoing" ? (
                <span className="text-xs italic">(pending)</span>
              ) : (
                <span className="text-xs italic">Friend</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
