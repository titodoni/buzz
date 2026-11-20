"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PublicProfile } from "@/lib/friends/api"
import type { Availability } from "@/lib/presence/state"
import { updateProfile } from "@/lib/profile/api"
import {
  UP_FOR_CHAT_TEXT,
  clearUpForChat,
  evaluateUpForChat,
  loadUpForChat,
  saveUpForChat,
  startUpForChat,
  type UpForChatState,
} from "./upForChat"

/** setTimeout cannot wait longer than this (a signed 32-bit number of ms). */
const MAX_TIMER_MS = 2_147_483_647

type Mine = Pick<PublicProfile, "displayName" | "statusMessage" | "nowPlaying">

export interface UpForChat {
  /** True while the profile still shows the Up for Chat line and Presence is Available. */
  on: boolean
  busy: boolean
  error: string | null
  toggle: () => void
}

/**
 * Buddy List window only. The toggle, the 60 minute timer and the
 * stale-on-start clear (buzz-trigger R2.1, R2.2, R2.4).
 */
export function useUpForChat(opts: {
  me: string
  profile: Mine | null
  myState: Availability
  setAvailable: () => void
  onStatusSaved: (status: string | null) => void
}): UpForChat {
  const { me, profile, myState, setAvailable, onStatusSaved } = opts
  const [session, setSession] = useState<UpForChatState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)
  // The timer must see the profile as it is now, not as it was when it was set.
  const latest = useRef({ profile, myState })
  useEffect(() => {
    latest.current = { profile, myState }
  })

  const text = profile ? (profile.statusMessage ?? null) : undefined
  const on = session !== null && text === UP_FOR_CHAT_TEXT && myState === "online"

  const writeStatus = useCallback(
    async (status: string | null): Promise<boolean> => {
      const p = latest.current.profile
      if (!p) return false
      const res = await updateProfile(me, {
        display_name: p.displayName,
        status_message: status ?? "",
        now_playing: p.nowPlaying ?? "",
      })
      if (!res.ok) {
        setError(res.message)
        return false
      }
      onStatusSaved(status)
      return true
    },
    [me, onStatusSaved],
  )

  const forget = useCallback(() => {
    try {
      clearUpForChat(localStorage, me)
    } catch {
      // blocked storage: nothing was kept either
    }
    setSession(null)
  }, [me])

  // Once the profile is known: a state from a previous run is resumed or cleared (R2.4).
  // Presence is not stored, so only the Status line decides here.
  useEffect(() => {
    if (loaded.current || text === undefined) return
    loaded.current = true
    let stored: UpForChatState | null = null
    try {
      stored = loadUpForChat(localStorage, me)
    } catch {
      return
    }
    const action = evaluateUpForChat(stored, { text, availability: "online" }, Date.now())
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of localStorage once the profile has loaded
    if (action.type === "wait") setSession(stored)
    else if (action.type === "restore") {
      forget()
      void writeStatus(action.text)
    } else if (action.type === "drop") forget()
  }, [text, me, forget, writeStatus])

  // While on: end the state if the user changed Status or Presence, restore when the hour is up.
  useEffect(() => {
    if (!session) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      const cur = latest.current
      if (!cur.profile) return
      const action = evaluateUpForChat(
        session,
        { text: cur.profile.statusMessage ?? null, availability: cur.myState === "invisible" ? "offline" : cur.myState },
        Date.now(),
      )
      if (action.type === "drop" || action.type === "none") forget()
      else if (action.type === "restore") {
        forget()
        void writeStatus(action.text)
      } else timer = setTimeout(check, Math.min(action.remainingMs, MAX_TIMER_MS))
    }
    check()
    return () => clearTimeout(timer)
  }, [session, text, myState, forget, writeStatus])

  const toggle = useCallback(() => {
    if (busy || !profile) return
    setError(null)
    setBusy(true)
    void (async () => {
      try {
        if (on && session) {
          const action = evaluateUpForChat(
            session,
            { text: UP_FOR_CHAT_TEXT, availability: "online" },
            Date.now(),
            true,
          )
          forget()
          if (action.type === "restore") await writeStatus(action.text)
          return
        }
        const next = startUpForChat(profile.statusMessage ?? null, Date.now())
        if (!(await writeStatus(UP_FOR_CHAT_TEXT))) return
        try {
          saveUpForChat(localStorage, me, next)
        } catch {
          // the hour still runs while the app stays open
        }
        setSession(next)
        setAvailable()
      } finally {
        setBusy(false)
      }
    })()
  }, [busy, profile, on, session, forget, writeStatus, me, setAvailable])

  return { on, busy, error, toggle }
}
