import { describe, it, expect } from "vitest"
import { generateKeyPair, publicKeyOf } from "../box"
import { ensureMyKeyPair, loadMyKeyPair, planKeySetup, type KeyApi } from "../identity"
import { browserKeyStore } from "../keyStore"

// Feature: buzz-encryption, making and publishing my key (E1.1)
const memStore = () => {
  const m = new Map<string, string>()
  return browserKeyStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) })
}
const fakeApi = (published: string | null, publishOk = true) => {
  const calls: string[] = []
  const api: KeyApi = {
    fetchPublished: async () => published,
    publish: async (_me, key) => (calls.push(key), publishOk),
  }
  return { api, calls }
}

describe("planKeySetup", () => {
  it("creates when this device holds no key", () => {
    expect(planKeySetup(null, null, null)).toBe("create")
    expect(planKeySetup(null, "pub", null)).toBe("create")
  })
  it("is ready when the server shows my key", () => {
    expect(planKeySetup("priv", "pub", "pub")).toBe("ready")
  })
  it("publishes when the server shows nothing or another key", () => {
    expect(planKeySetup("priv", null, "pub")).toBe("publish")
    expect(planKeySetup("priv", "other", "pub")).toBe("publish")
  })
})

describe("ensureMyKeyPair", () => {
  it("first open: makes a key, saves it, then publishes its public half", async () => {
    const store = memStore()
    const { api, calls } = fakeApi(null)
    const r = await ensureMyKeyPair("u1", store, api)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r).toMatchObject({ created: true, replacedOther: false })
    expect(await store.get("u1")).toBe(r.keys.privateKey)
    expect(calls).toEqual([r.keys.publicKey])
    expect(await publicKeyOf(r.keys.privateKey)).toBe(r.keys.publicKey)
  })

  it("the private key never goes to the server", async () => {
    const { api, calls } = fakeApi(null)
    const r = await ensureMyKeyPair("u1", memStore(), api)
    if (!r.ok) throw new Error("setup failed")
    expect(calls.join(" ")).not.toContain(r.keys.privateKey)
  })

  it("later opens: reuses the key and publishes nothing", async () => {
    const store = memStore()
    const kp = await generateKeyPair()
    await store.set("u1", kp.privateKey)
    const { api, calls } = fakeApi(kp.publicKey)
    const r = await ensureMyKeyPair("u1", store, api)
    expect(r).toMatchObject({ ok: true, created: false })
    expect(calls).toEqual([])
  })

  it("a saved key the server does not show is published again, not replaced", async () => {
    const store = memStore()
    const kp = await generateKeyPair()
    await store.set("u1", kp.privateKey)
    const { api, calls } = fakeApi(null)
    const r = await ensureMyKeyPair("u1", store, api)
    expect(r).toMatchObject({ ok: true, created: false })
    expect(calls).toEqual([kp.publicKey])
    expect(await store.get("u1")).toBe(kp.privateKey)
  })

  it("a new device starts fresh and replaces the published key", async () => {
    const old = await generateKeyPair()
    const store = memStore()
    const { api, calls } = fakeApi(old.publicKey)
    const r = await ensureMyKeyPair("u1", store, api)
    expect(r).toMatchObject({ ok: true, created: true, replacedOther: true })
    if (r.ok) expect(r.keys.publicKey).not.toBe(old.publicKey)
    expect(calls).toHaveLength(1)
  })

  it("keeps the saved key when publishing fails, and says so", async () => {
    const store = memStore()
    const { api } = fakeApi(null, false)
    expect(await ensureMyKeyPair("u1", store, api)).toEqual({ ok: false, reason: "publish-failed" })
    expect(await store.get("u1")).not.toBeNull()
  })

  it("does not make a key when the server cannot be asked", async () => {
    const store = memStore()
    const api: KeyApi = { fetchPublished: async () => { throw new Error("offline") }, publish: async () => true }
    await expect(ensureMyKeyPair("u1", store, api)).rejects.toThrow("offline")
    expect(await store.get("u1")).toBeNull()
  })
})

describe("loadMyKeyPair", () => {
  it("reads an existing key and never creates one", async () => {
    const store = memStore()
    expect(await loadMyKeyPair("u1", store)).toBeNull()
    expect(await store.get("u1")).toBeNull()
    const kp = await generateKeyPair()
    await store.set("u1", kp.privateKey)
    expect(await loadMyKeyPair("u1", store)).toEqual(kp)
  })
})
