import { describe, it, expect } from "vitest"
import { generateKeyPair } from "../box"
import { safetyNumber } from "../safetyNumber"
import { checkFriendKey, keyToPin, loadPins, parsePins, pinFriendKey, sendGate } from "../trust"

// Feature: buzz-encryption, Safety Number and key trust (E3)
describe("safetyNumber", () => {
  it("is the same for both friends", async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    expect(await safetyNumber(a.publicKey, b.publicKey)).toBe(await safetyNumber(b.publicKey, a.publicKey))
  })
  it("is six groups of five digits", async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    expect(await safetyNumber(a.publicKey, b.publicKey)).toMatch(/^\d{5}( \d{5}){5}$/)
  })
  it("is stable for the same keys", async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    expect(await safetyNumber(a.publicKey, b.publicKey)).toBe(await safetyNumber(a.publicKey, b.publicKey))
  })
  it("changes when either key changes", async () => {
    const a = await generateKeyPair()
    const b = await generateKeyPair()
    const c = await generateKeyPair()
    const base = await safetyNumber(a.publicKey, b.publicKey)
    expect(await safetyNumber(a.publicKey, c.publicKey)).not.toBe(base)
    expect(await safetyNumber(c.publicKey, b.publicKey)).not.toBe(base)
  })
  it("rejects a malformed key", async () => {
    const a = await generateKeyPair()
    await expect(safetyNumber(a.publicKey, "nope")).rejects.toThrow("Invalid key")
    await expect(safetyNumber("", a.publicKey)).rejects.toThrow("Invalid key")
  })
})

describe("checkFriendKey", () => {
  it("missing when the friend has no key", () => {
    expect(checkFriendKey(null, null)).toEqual({ status: "missing" })
    expect(checkFriendKey("k1", null)).toEqual({ status: "missing" })
  })
  it("new the first time, ok when the same, changed when different", () => {
    expect(checkFriendKey(null, "k1")).toEqual({ status: "new" })
    expect(checkFriendKey("k1", "k1")).toEqual({ status: "ok" })
    expect(checkFriendKey("k1", "k2")).toEqual({ status: "changed" })
  })
})

describe("sendGate", () => {
  it("allows ok and new", () => {
    expect(sendGate({ status: "ok" }, "Ann")).toEqual({ allowed: true })
    expect(sendGate({ status: "new" }, "Ann")).toEqual({ allowed: true })
  })
  it("blocks a friend without a key, in plain words", () => {
    expect(sendGate({ status: "missing" }, "Ann")).toEqual({
      allowed: false,
      reason: "missing",
      message: "Ann hasn't set up encryption yet.",
    })
  })
  it("blocks a changed key until confirmed", () => {
    const g = sendGate({ status: "changed" }, "Ann")
    expect(g.allowed).toBe(false)
    if (!g.allowed) {
      expect(g.reason).toBe("changed")
      expect(g.message).toContain("Ann's key changed")
    }
  })
})

describe("pins", () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  it("remembers a key per friend and per account", () => {
    const s = mem()
    pinFriendKey(s, "me", "ann", "k1")
    pinFriendKey(s, "me", "bob", "k2")
    expect(loadPins(s, "me")).toEqual({ ann: "k1", bob: "k2" })
    expect(loadPins(s, "other")).toEqual({})
  })
  it("a confirmed change replaces the old key", () => {
    const s = mem()
    pinFriendKey(s, "me", "ann", "k1")
    pinFriendKey(s, "me", "ann", "k2")
    expect(loadPins(s, "me")).toEqual({ ann: "k2" })
  })
  it("treats malformed storage as none and keeps only text values", () => {
    for (const raw of [null, "", "nope", "null", "[]", "5"]) expect(parsePins(raw)).toEqual({})
    expect(parsePins('{"ann":"k1","bob":5}')).toEqual({ ann: "k1" })
  })
})

describe("keyToPin", () => {
  it("pins the server's key only when it is the key the user compared", () => {
    expect(keyToPin("K1", "K1")).toBe("K1")
  })
  it("pins nothing when the key changed again after the user looked", () => {
    expect(keyToPin("K1", "K2")).toBeNull()
  })
  it("pins nothing without a compared key or a published key", () => {
    expect(keyToPin(null, "K1")).toBeNull()
    expect(keyToPin("K1", null)).toBeNull()
  })
})
