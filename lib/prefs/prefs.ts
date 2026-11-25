import { INBOUND_MIN_GAP_MS } from "../nudge/inbound"

/**
 * This device's alert and Buzz! settings (Req 19.3, 19.5), saved in
 * localStorage under `buzz:prefs`. The Messages and General categories of the
 * Preferences window keep using the keys their windows already read
 * (`buzz:chatView`, `buzz:buddyListView`, `buzz.signInOptions`).
 */
export interface Prefs {
  alerts: {
    /** Master switch for every sound. */
    allSounds: boolean
    messageSound: boolean
    onlineSound: boolean
    onlineToast: boolean
  }
  buzz: {
    /** "Allow Buzz!": off drops every incoming Buzz (Req 18.2). */
    allow: boolean
    /** "Play the Buzz! sound" (Req 18.3). */
    sound: boolean
    /** "Shake the window for a Buzz!" (Req 18.4). */
    shake: boolean
  }
}

export const PREFS_KEY = "buzz:prefs"

export const DEFAULT_PREFS: Prefs = {
  alerts: { allSounds: true, messageSound: true, onlineSound: true, onlineToast: true },
  buzz: { allow: true, sound: true, shake: true },
}

function ownValue(obj: unknown, key: string): unknown {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return undefined
  // Read an own property without casting the parsed JSON.
  return Object.getOwnPropertyDescriptor(obj, key)?.value
}

function pickBooleans<T extends Record<string, boolean>>(raw: unknown, defaults: T): T {
  const out = { ...defaults }
  for (const key of Object.keys(defaults) as Array<keyof T & string>) {
    const v = ownValue(raw, key)
    if (typeof v === "boolean") out[key] = v as T[typeof key] // a boolean, checked above
  }
  return out
}

/** Reads saved preferences; anything missing or damaged falls back to its default (Req 19.7). */
export function parsePrefs(raw: string | null): Prefs {
  let value: unknown = null
  try {
    value = raw === null ? null : JSON.parse(raw)
  } catch {
    value = null
  }
  return {
    alerts: pickBooleans(ownValue(value, "alerts"), DEFAULT_PREFS.alerts),
    buzz: pickBooleans(ownValue(value, "buzz"), DEFAULT_PREFS.buzz),
  }
}

/**
 * Whether an incoming Buzz is shown (Req 18.2, 18.5): never while "Allow
 * Buzz!" is off, and not when the same friend's previous Buzz was too recent.
 * `lastAt` is when that friend's previous accepted Buzz arrived (ms), if any.
 * The gap is the sender's 10-second cooldown less a little delivery jitter
 * (INBOUND_MIN_GAP_MS), so an honest app's Buzz is never dropped.
 */
export function shouldAcceptNudge(prefs: Prefs, lastAt: number | undefined, now: number): boolean {
  if (!prefs.buzz.allow) return false
  return lastAt === undefined || now - lastAt >= INBOUND_MIN_GAP_MS
}
