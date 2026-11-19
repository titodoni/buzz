"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { getSupabase } from "@/lib/supabase/browser-client"

export interface IgnoredPerson {
  id: string
  displayName: string
}

export type IgnoreResult = { ok: true } | { ok: false; message: string }

const MSG_FAILED = "That didn't work. Please try again."

/** People I have ignored (Req 15.1, 15.8). Reloads on window focus and after changes made here. */
export function useIgnoreList(me: string): {
  ignored: IgnoredPerson[]
  ignoredIds: ReadonlySet<string>
  reload: () => void
} {
  const [ignored, setIgnored] = useState<IgnoredPerson[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const supabase = getSupabase()
        const { data, error } = await supabase.from("ignored_users").select("ignored_id").eq("owner_id", me)
        if (!active || error) return
        const ids = data.map((r) => r.ignored_id)
        if (ids.length === 0) return setIgnored([])
        const profiles = await supabase.from("profiles").select("id, display_name").in("id", ids)
        if (!active || profiles.error) return
        const names = new Map(profiles.data.map((p) => [p.id, p.display_name]))
        setIgnored(ids.map((id) => ({ id, displayName: names.get(id) ?? "Someone" })))
      } catch {
        // Not configured or offline: keep what we had.
      }
    })()
    return () => {
      active = false
    }
  }, [me, tick])
  useEffect(() => {
    window.addEventListener("focus", reload)
    return () => window.removeEventListener("focus", reload)
  }, [reload])
  const ignoredIds = useMemo<ReadonlySet<string>>(() => new Set(ignored.map((p) => p.id)), [ignored])
  return { ignored, ignoredIds, reload }
}

/**
 * The people who ignore me, so my app shows them as Offline (Req 15.5,
 * docs/adr/0009). Refreshed when the window gets focus; the ignorer's change
 * reaches me then, not instantly.
 */
export function useIgnorers(me: string): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error } = await getSupabase().rpc("ignorers_of_me")
        if (active && !error) setIds(new Set(data))
      } catch {
        // Not configured or offline: keep what we had.
      }
    }
    void load()
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => {
      active = false
      window.removeEventListener("focus", onFocus)
    }
  }, [me])
  return ids
}

export async function ignoreUser(me: string, personId: string): Promise<IgnoreResult> {
  const { error } = await getSupabase().from("ignored_users").upsert(
    { owner_id: me, ignored_id: personId },
    { onConflict: "owner_id,ignored_id", ignoreDuplicates: true },
  )
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}

export async function unignoreUser(me: string, personId: string): Promise<IgnoreResult> {
  const { error } = await getSupabase().from("ignored_users").delete().eq("owner_id", me).eq("ignored_id", personId)
  return error ? { ok: false, message: MSG_FAILED } : { ok: true }
}

/** Whether I have ignored this one person (used by a chat window). */
export async function isIgnoredByMe(me: string, personId: string): Promise<boolean> {
  try {
    const { data } = await getSupabase()
      .from("ignored_users")
      .select("ignored_id")
      .eq("owner_id", me)
      .eq("ignored_id", personId)
      .maybeSingle()
    return data !== null
  } catch {
    return false
  }
}
