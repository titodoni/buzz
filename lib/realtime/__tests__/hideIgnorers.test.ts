import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { hideIgnorers } from "../hideIgnorers"
import type { PresenceState } from "../../presence/state"

describe("hideIgnorers (Req 15.5)", () => {
  it("shows people who ignore me as offline and leaves everyone else alone", () => {
    const presence: Record<string, PresenceState> = { ann: "online", bob: "busy", cat: "away" }
    expect(hideIgnorers(presence, new Set(["bob"]))).toEqual({ ann: "online", bob: "offline", cat: "away" })
  })

  it("returns the same object when nobody ignores me", () => {
    const presence: Record<string, PresenceState> = { ann: "online" }
    expect(hideIgnorers(presence, new Set())).toBe(presence)
  })

  it("never shows an ignorer as anything but offline", () => {
    const state = fc.constantFrom<PresenceState>("online", "away", "busy", "offline")
    fc.assert(
      fc.property(fc.dictionary(fc.string({ minLength: 1, maxLength: 4 }), state), fc.array(fc.string({ maxLength: 4 })), (presence, ids) => {
        const out = hideIgnorers(presence, new Set(ids))
        for (const [id, s] of Object.entries(out)) expect(s).toBe(ids.includes(id) ? "offline" : presence[id])
      }),
    )
  })
})
