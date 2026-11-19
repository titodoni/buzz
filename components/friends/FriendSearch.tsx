"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { searchProfiles, sendFriendRequest, type PublicProfile } from "@/lib/friends/api"

export function FriendSearch({ me, onSent, initialQuery = "" }: { me: string; onSent?: () => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<PublicProfile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const run = useCallback(
    async (q: string) => {
      setBusy(true)
      setNote(null)
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
    setBusy(true)
    setNote(null)
    try {
      setResults(await searchProfiles(query, me))
    } catch {
      setResults(null)
      setNote("Search didn't work. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function add(p: PublicProfile) {
    const res = await sendFriendRequest(me, p.id)
    setNote(res.message ?? null)
    if (res.ok) {
      setResults((r) => r?.filter((x) => x.id !== p.id) ?? null)
      onSent?.()
    }
  }

  return (
    <section aria-label="Find a friend" className="p-2">
      <form onSubmit={onSubmit} role="search" className="flex gap-1">
        <input
          type="search"
          aria-label="Search by display name or email"
          placeholder="Display name or exact email"
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
      {results && results.length === 0 ? <p className="text-xs">No one found. Check the spelling, or use their exact email.</p> : null}
      <ul className="m-0 list-none p-0">
        {results?.map((p) => (
          <li key={p.id} className="ym-row flex items-center justify-between gap-2 px-1 py-1">
            <span className="truncate font-bold">{p.displayName}</span>
            <button type="button" className="ym-button" onClick={() => void add(p)}>
              Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
