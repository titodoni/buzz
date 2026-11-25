import { describe, expect, it } from "vitest"
import { INBOUND_MIN_GAP_MS } from "../../nudge/inbound"
import { DEFAULT_PREFS, parsePrefs, shouldAcceptNudge, type Prefs } from "../prefs"

describe("parsePrefs", () => {
  it("returns the defaults for missing or damaged JSON", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs("{not json")).toEqual(DEFAULT_PREFS)
    expect(parsePrefs("42")).toEqual(DEFAULT_PREFS)
    expect(parsePrefs("[]")).toEqual(DEFAULT_PREFS)
  })

  it("keeps defaults for wrong types and drops unknown keys", () => {
    const raw = JSON.stringify({ alerts: { allSounds: "no", messageSound: false, extra: true }, buzz: [], other: 1 })
    expect(parsePrefs(raw)).toEqual({
      alerts: { ...DEFAULT_PREFS.alerts, messageSound: false },
      buzz: DEFAULT_PREFS.buzz,
    })
  })

  it("round-trips a valid object", () => {
    const prefs: Prefs = {
      alerts: { allSounds: false, messageSound: true, onlineSound: false, onlineToast: true },
      buzz: { allow: true, sound: false, shake: false },
    }
    expect(parsePrefs(JSON.stringify(prefs))).toEqual(prefs)
  })
})

describe("shouldAcceptNudge", () => {
  const off: Prefs = { ...DEFAULT_PREFS, buzz: { ...DEFAULT_PREFS.buzz, allow: false } }

  it("drops every Buzz while Allow Buzz! is off", () => {
    expect(shouldAcceptNudge(off, undefined, 1_000_000)).toBe(false)
  })

  it("accepts the first Buzz from a friend", () => {
    expect(shouldAcceptNudge(DEFAULT_PREFS, undefined, 1_000_000)).toBe(true)
  })

  it("accepts a Buzz 10 seconds after the previous one", () => {
    expect(shouldAcceptNudge(DEFAULT_PREFS, 0, 10_000)).toBe(true)
    expect(shouldAcceptNudge(DEFAULT_PREFS, 0, 9_999)).toBe(true)
  })

  it("drops a Buzz that comes sooner than the gap", () => {
    expect(shouldAcceptNudge(DEFAULT_PREFS, 0, INBOUND_MIN_GAP_MS)).toBe(true)
    expect(shouldAcceptNudge(DEFAULT_PREFS, 0, INBOUND_MIN_GAP_MS - 1)).toBe(false)
  })
})
