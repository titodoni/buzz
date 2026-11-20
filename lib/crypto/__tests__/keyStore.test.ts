import { describe, it, expect } from "vitest"
import { browserKeyStore, chooseKeyStore, type KeyStore } from "../keyStore"

// Feature: buzz-encryption, where the private key lives (E1.2, E1.3)
const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
const fake = (kind: KeyStore["kind"]): KeyStore => ({ kind, get: async () => null, set: async () => undefined, remove: async () => undefined })

describe("browserKeyStore", () => {
  it("stores one key per account and can remove it", async () => {
    const s = mem()
    const ks = browserKeyStore(s)
    expect(await ks.get("u1")).toBeNull()
    await ks.set("u1", "k1")
    await ks.set("u2", "k2")
    expect(await ks.get("u1")).toBe("k1")
    expect(await ks.get("u2")).toBe("k2")
    await ks.remove("u1")
    expect(await ks.get("u1")).toBeNull()
    expect(await ks.get("u2")).toBe("k2")
  })
  it("is labelled as development only", () => {
    expect(browserKeyStore(mem()).kind).toBe("browser-dev")
  })
})

describe("chooseKeyStore", () => {
  const keychain = fake("keychain")
  const browser = fake("browser-dev")
  it("desktop with a keychain uses the keychain", async () => {
    expect(await chooseKeyStore({ desktop: true, keychainAvailable: async () => true, keychain, browser })).toBe(keychain)
  })
  it("desktop without a keychain is unavailable, never localStorage", async () => {
    expect(await chooseKeyStore({ desktop: true, keychainAvailable: async () => false, keychain, browser })).toEqual({ kind: "unavailable" })
  })
  it("a plain browser uses the development store and never asks for the keychain", async () => {
    let asked = false
    const r = await chooseKeyStore({ desktop: false, keychainAvailable: async () => ((asked = true), true), keychain, browser })
    expect(r).toBe(browser)
    expect(asked).toBe(false)
  })
})
