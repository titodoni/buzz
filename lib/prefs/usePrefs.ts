"use client"
import { useCallback, useEffect, useState } from "react"
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, type Prefs } from "./prefs"

/** Reads `buzz:prefs` now; the defaults when storage is unavailable. */
export function readPrefs(): Prefs {
  try {
    return parsePrefs(window.localStorage.getItem(PREFS_KEY))
  } catch {
    return DEFAULT_PREFS
  }
}

/**
 * This device's alert and Buzz! preferences. A change made in any window
 * reaches every other open window through the `storage` event (Req 19.6,
 * docs/adr/0008).
 */
export function usePrefs(): { prefs: Prefs; update: (change: { alerts?: Partial<Prefs["alerts"]>; buzz?: Partial<Prefs["buzz"]> }) => void } {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  useEffect(() => {
    // Read after mount so the first render matches the static export.
    let active = true
    queueMicrotask(() => {
      if (active) setPrefs(readPrefs())
    })
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_KEY || e.key === null) setPrefs(readPrefs())
    }
    window.addEventListener("storage", onStorage)
    return () => {
      active = false
      window.removeEventListener("storage", onStorage)
    }
  }, [])
  const update = useCallback((change: { alerts?: Partial<Prefs["alerts"]>; buzz?: Partial<Prefs["buzz"]> }) => {
    setPrefs((prev) => {
      const next: Prefs = { alerts: { ...prev.alerts, ...change.alerts }, buzz: { ...prev.buzz, ...change.buzz } }
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable: the change lasts until the window closes.
      }
      return next
    })
  }, [])
  return { prefs, update }
}
