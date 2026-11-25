"use client"
import { useCallback, useEffect, useState } from "react"
import { DEFAULT_BUDDY_VIEW, parseBuddyView, toggleCollapsed, type BuddyView } from "./buddyView"

const KEY = "buzz:buddyListView"

/**
 * This device's Buddy List view: collapsed groups and "Show Offline Contacts"
 * (Req 14.7, 14.8). Section 28 moves "Show Offline Contacts" into Preferences.
 */
export function useBuddyView(): {
  view: BuddyView
  toggleGroup: (key: string) => void
  setShowOffline: (show: boolean) => void
} {
  const [view, setView] = useState<BuddyView>(DEFAULT_BUDDY_VIEW)
  useEffect(() => {
    // Read after mount so the first render matches the static export.
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setView(parseBuddyView(window.localStorage.getItem(KEY)))
      } catch {
        // Storage unavailable: keep the defaults.
      }
    })
    // Preferences changed "Show Offline Contacts": apply at once (Req 19.6).
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setView(parseBuddyView(e.key === null ? null : e.newValue))
    }
    window.addEventListener("storage", onStorage)
    return () => {
      active = false
      window.removeEventListener("storage", onStorage)
    }
  }, [])
  const save = useCallback((next: BuddyView) => {
    setView(next)
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable: the change lasts until the window closes.
    }
  }, [])
  const toggleGroup = useCallback((key: string) => save(toggleCollapsed(view, key)), [save, view])
  const setShowOffline = useCallback((show: boolean) => save({ ...view, showOffline: show }), [save, view])
  return { view, toggleGroup, setShowOffline }
}
