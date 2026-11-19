import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { DEFAULT_SIGN_IN_OPTIONS, parseSignInOptions, shouldDiscardSession } from "../options"

describe("parseSignInOptions (Req 13.1-13.4)", () => {
  it("defaults to signing in automatically and visibly", () => {
    expect(DEFAULT_SIGN_IN_OPTIONS).toEqual({ autoSignIn: true, signInInvisible: false })
    expect(parseSignInOptions(null)).toEqual(DEFAULT_SIGN_IN_OPTIONS)
  })

  it("reads saved choices", () => {
    expect(parseSignInOptions('{"autoSignIn":false,"signInInvisible":true}')).toEqual({
      autoSignIn: false,
      signInInvisible: true,
    })
  })

  it("falls back to the default for each damaged field", () => {
    expect(parseSignInOptions('{"autoSignIn":"no","signInInvisible":true}')).toEqual({
      autoSignIn: true,
      signInInvisible: true,
    })
    expect(parseSignInOptions("not json")).toEqual(DEFAULT_SIGN_IN_OPTIONS)
    expect(parseSignInOptions("[1,2]")).toEqual(DEFAULT_SIGN_IN_OPTIONS)
  })

  it("never throws and always returns two booleans", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), fc.constant(null)), (raw) => {
        const o = parseSignInOptions(raw)
        expect(typeof o.autoSignIn).toBe("boolean")
        expect(typeof o.signInInvisible).toBe("boolean")
      }),
    )
  })
})

describe("shouldDiscardSession (Req 13.2, 13.3)", () => {
  it("keeps the session when signing in automatically", () => {
    expect(shouldDiscardSession({ autoSignIn: true, startedThisRun: false })).toBe(false)
  })

  it("drops a session left over from an earlier run when not signing in automatically", () => {
    expect(shouldDiscardSession({ autoSignIn: false, startedThisRun: false })).toBe(true)
  })

  it("keeps the session for the rest of this run, e.g. after a reload", () => {
    expect(shouldDiscardSession({ autoSignIn: false, startedThisRun: true })).toBe(false)
  })
})

import { shouldStartInvisible } from "../options"

describe("shouldStartInvisible (Req 13.4)", () => {
  it("starts Invisible on the first Buddy List start of a run when the option is on", () => {
    expect(shouldStartInvisible({ signInInvisible: true, presenceStartedThisRun: false })).toBe(true)
  })

  it("does not force Invisible again after a reload, so a manual change to Available sticks", () => {
    expect(shouldStartInvisible({ signInInvisible: true, presenceStartedThisRun: true })).toBe(false)
  })

  it("never starts Invisible when the option is off", () => {
    expect(shouldStartInvisible({ signInInvisible: false, presenceStartedThisRun: false })).toBe(false)
  })
})
