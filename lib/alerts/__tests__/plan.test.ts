import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { friendOnlineAlerts, incomingMessagePlan, type ChatWindowState } from "../plan"
import type { PresenceState } from "../../presence/state"

const sounds = { allSounds: true, messageSound: true }

describe("incomingMessagePlan (Req 16.1, 16.2, 16.10)", () => {
  it("opens a closed chat window behind the others, flashes it, and plays the sound", () => {
    expect(incomingMessagePlan("closed", sounds)).toEqual({ open: true, flash: true, sound: true })
  })

  it("flashes an open window that isn't focused and plays the sound", () => {
    expect(incomingMessagePlan("unfocused", sounds)).toEqual({ open: false, flash: true, sound: true })
  })

  it("does nothing for the window the user is looking at", () => {
    expect(incomingMessagePlan("focused", sounds)).toEqual({ open: false, flash: false, sound: false })
  })

  it("never plays the sound when either switch is off, and never changes what opens or flashes", () => {
    const state = fc.constantFrom<ChatWindowState>("closed", "unfocused", "focused")
    fc.assert(
      fc.property(state, fc.boolean(), fc.boolean(), (w, all, msg) => {
        const on = incomingMessagePlan(w, sounds)
        const out = incomingMessagePlan(w, { allSounds: all, messageSound: msg })
        expect(out.sound).toBe(on.sound && all && msg)
        expect([out.open, out.flash]).toEqual([on.open, on.flash])
      }),
    )
  })
})

describe("friendOnlineAlerts (Req 16.4, 16.10)", () => {
  const prefs = { allSounds: true, onlineSound: true, onlineToast: true }

  it("toasts a friend who goes from Offline to Available, with the sound", () => {
    expect(friendOnlineAlerts({ ann: "offline" }, { ann: "online" }, { settled: true, ...prefs })).toEqual({
      toastFor: ["ann"],
      sound: true,
    })
  })

  it("treats a friend missing from the old list as Offline", () => {
    expect(friendOnlineAlerts({}, { ann: "online" }, { settled: true, ...prefs }).toastFor).toEqual(["ann"])
  })

  it("ignores everything until presence has settled after start-up", () => {
    expect(friendOnlineAlerts({ ann: "offline" }, { ann: "online" }, { settled: false, ...prefs })).toEqual({
      toastFor: [],
      sound: false,
    })
  })

  it("only Offline to Available counts", () => {
    const changes: [PresenceState, PresenceState][] = [
      ["offline", "busy"],
      ["offline", "away"],
      ["busy", "online"],
      ["away", "online"],
      ["online", "online"],
    ]
    for (const [a, b] of changes) {
      expect(friendOnlineAlerts({ x: a }, { x: b }, { settled: true, ...prefs }).toastFor).toEqual([])
    }
  })

  it("respects the switches for the toast and the sound separately", () => {
    const change = [{ ann: "offline" as const }, { ann: "online" as const }] as const
    expect(friendOnlineAlerts(...change, { settled: true, ...prefs, onlineToast: false })).toEqual({ toastFor: [], sound: true })
    expect(friendOnlineAlerts(...change, { settled: true, ...prefs, onlineSound: false })).toEqual({ toastFor: ["ann"], sound: false })
    expect(friendOnlineAlerts(...change, { settled: true, ...prefs, allSounds: false }).sound).toBe(false)
  })
})
