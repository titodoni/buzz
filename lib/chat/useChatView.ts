"use client"
import { useCallback, useEffect, useState } from "react"
import { DEFAULT_FORMAT, parseFormat, type MessageFormat } from "./format"

const KEY = "buzz:chatView"

/** This device's chat window settings; Section 28's Preferences should read the same key. */
export interface ChatView {
  /** View > Show Timestamps (Req 17.5). */
  showTimestamps: boolean
  /** View > Show Friends' Fonts (Req 17.3). */
  showFriendsFonts: boolean
  /** The formatting bar's choice, used for every message I send (Req 17.2). */
  myFormat: MessageFormat
}

export const DEFAULT_CHAT_VIEW: ChatView = { showTimestamps: true, showFriendsFonts: true, myFormat: DEFAULT_FORMAT }

function parseChatView(raw: string | null): ChatView {
  try {
    const v: unknown = raw === null ? null : JSON.parse(raw)
    if (typeof v !== "object" || v === null) return DEFAULT_CHAT_VIEW
    const r = v as Record<string, unknown> // narrowing parsed JSON to read its fields
    return {
      showTimestamps: typeof r.showTimestamps === "boolean" ? r.showTimestamps : true,
      showFriendsFonts: typeof r.showFriendsFonts === "boolean" ? r.showFriendsFonts : true,
      myFormat: parseFormat(r.myFormat),
    }
  } catch {
    return DEFAULT_CHAT_VIEW
  }
}

export function useChatView(): { view: ChatView; update: (change: Partial<ChatView>) => void } {
  const [view, setView] = useState<ChatView>(DEFAULT_CHAT_VIEW)
  useEffect(() => {
    // Read after mount so the first render matches the static export.
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setView(parseChatView(window.localStorage.getItem(KEY)))
      } catch {
        // Storage unavailable: keep the defaults.
      }
    })
    // Preferences (or another chat window) changed it: apply at once (Req 19.6).
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setView(parseChatView(e.key === null ? null : e.newValue))
    }
    window.addEventListener("storage", onStorage)
    return () => {
      active = false
      window.removeEventListener("storage", onStorage)
    }
  }, [])
  const update = useCallback((change: Partial<ChatView>) => {
    setView((prev) => {
      const next = { ...prev, ...change }
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable: the change lasts until the window closes.
      }
      return next
    })
  }, [])
  return { view, update }
}
