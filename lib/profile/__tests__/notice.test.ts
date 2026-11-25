import { describe, expect, it } from "vitest"

import { setProfileNotice, takeProfileNotice } from "../notice"

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

describe("profile notice", () => {
  it("returns the message once", () => {
    const s = fakeStorage()
    setProfileNotice("Picture failed", s)
    expect(takeProfileNotice(s)).toBe("Picture failed")
    expect(takeProfileNotice(s)).toBeNull()
  })

  it("is quiet without storage", () => {
    expect(() => setProfileNotice("x", null)).not.toThrow()
    expect(takeProfileNotice(null)).toBeNull()
  })
})
