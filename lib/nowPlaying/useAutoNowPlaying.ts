"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { setMyNowPlaying } from "@/lib/profile/api"
import { nowPlayingPlatform, nowPlayingSupported, onNowPlaying, setNowPlayingEnabled } from "@/lib/tauri/nowPlaying"
import type { NowPlayingPlatform } from "./note"
import { decideAuto, formatTrack, initAuto, stepAuto, type AutoState } from "./auto"

const SETTING_KEY = "buzz:share-now-playing"
const savedKey = (me: string) => `buzz:now-playing:${me}`

type Saved = { manual: string | null; lastAuto: string | null }

function readSaved(me: string): Saved {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(savedKey(me)) ?? "null")
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown> // checked field by field below
      const str = (x: unknown) => (typeof x === "string" ? x : null)
      return { manual: str(o.manual), lastAuto: str(o.lastAuto) }
    }
  } catch {
    // unreadable storage: start fresh
  }
  return { manual: null, lastAuto: null }
}

function writeSaved(me: string, s: Saved) {
  try {
    localStorage.setItem(savedKey(me), JSON.stringify(s))
  } catch {
    // storage full or blocked; the next start treats the profile line as hand-typed
  }
}

/** The "Share What I'm Playing" setting (off by default, R7.1) and whether this build supports it. */
export function useShareNowPlaying(): {
  supported: boolean
  platform: NowPlayingPlatform
  enabled: boolean
  setEnabled: (v: boolean) => void
} {
  const [supported, setSupported] = useState(false)
  const [platform, setPlatform] = useState<NowPlayingPlatform>("other")
  const [enabled, setState] = useState(() => {
    try {
      return localStorage.getItem(SETTING_KEY) === "1"
    } catch {
      return false
    }
  })
  useEffect(() => {
    let active = true
    void nowPlayingSupported().then((v) => active && setSupported(v))
    void nowPlayingPlatform().then((v) => active && setPlatform(v))
    return () => {
      active = false
    }
  }, [])
  const setEnabled = useCallback((v: boolean) => {
    setState(v)
    try {
      localStorage.setItem(SETTING_KEY, v ? "1" : "0")
    } catch {
      // the choice still applies for this run
    }
  }, [])
  return { supported, platform, enabled: enabled && supported, setEnabled }
}

export interface AutoNowPlayingOptions {
  me: string
  /** The profile's Now Playing; undefined until the profile has loaded. */
  profileLine: string | null | undefined
  enabled: boolean
  /** Called after each successful write, so the window's own copy stays current. */
  onWritten: (line: string | null) => void
}

/**
 * Keeps Now Playing in step with what the computer is playing (R7). Lives in
 * the Buddy List window only, like presence tracking.
 */
export function useAutoNowPlaying({ me, profileLine, enabled, onWritten }: AutoNowPlayingOptions): void {
  const stateRef = useRef<AutoState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writingRef = useRef(false)
  const onWrittenRef = useRef(onWritten)
  const profileRef = useRef(profileLine)
  useEffect(() => {
    onWrittenRef.current = onWritten
    profileRef.current = profileLine
  })
  const loaded = profileLine !== undefined


  useEffect(() => {
    if (!enabled || !loaded) {
      // Turned off: put back the hand-typed line if Buzz's own line is showing.
      const s = stateRef.current
      stateRef.current = null
      if (s && !s.manualWins && s.shown !== s.manual) {
        void setMyNowPlaying(me, s.manual).then((r) => {
          if (r.ok) {
            writeSaved(me, { manual: s.manual, lastAuto: null })
            onWrittenRef.current(s.manual)
          }
        })
      }
      return
    }
    stateRef.current = initAuto(profileRef.current ?? null, readSaved(me))
    writeSaved(me, { manual: stateRef.current.manual, lastAuto: readSaved(me).lastAuto })
    let unlisten: (() => void) | null = null
    let cancelled = false
    const evaluate = async (): Promise<void> => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      const s = stateRef.current
      if (!s || cancelled || writingRef.current) return
      const d = decideAuto(s, Date.now())
      if (d.kind === "wait") {
        timerRef.current = setTimeout(() => void evaluate(), Math.max(0, d.at - Date.now()))
        return
      }
      if (d.kind !== "write") return
      writingRef.current = true
      const res = await setMyNowPlaying(me, d.line)
      writingRef.current = false
      if (!stateRef.current || cancelled) return
      // A failed write still counts against the throttle, so it is retried later, not in a loop.
      const line = res.ok ? d.line : stateRef.current.shown
      stateRef.current = stepAuto(stateRef.current, { type: "written", line, now: Date.now() })
      if (res.ok) {
        writeSaved(me, { manual: stateRef.current.manual, lastAuto: d.line })
        onWrittenRef.current(d.line)
      }
      void evaluate()
    }
    void onNowPlaying((track) => {
      if (!stateRef.current) return
      stateRef.current = stepAuto(stateRef.current, { type: "track", line: formatTrack(track), now: Date.now() })
      void evaluate()
    }).then((u) => {
      if (cancelled) u()
      else unlisten = u
      // Enable after listening, so the first announcement is not missed.
      if (!cancelled) void setNowPlayingEnabled(true).catch(() => undefined)
    })
    return () => {
      cancelled = true
      unlisten?.()
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      void setNowPlayingEnabled(false).catch(() => undefined)
    }
  }, [enabled, loaded, me])
}
