import { describe, it, expect } from "vitest"
import { generateKeyPair, open, publicKeyOf, seal } from "../box"

// Feature: buzz-encryption, key and box helpers (ADR 0010)
describe("box", () => {
  it("a friend reads what I seal for them", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const cipher = await seal("hello ann", ann.publicKey, me.privateKey)
    expect(await open(cipher, me.publicKey, ann.privateKey)).toBe("hello ann")
  })

  it("I read my own copy with my own public key", async () => {
    const me = await generateKeyPair()
    const cipher = await seal("note to self", me.publicKey, me.privateKey)
    expect(await open(cipher, me.publicKey, me.privateKey)).toBe("note to self")
  })

  it("keeps non-ASCII text intact", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const text = "héllo 😀 世界"
    expect(await open(await seal(text, ann.publicKey, me.privateKey), me.publicKey, ann.privateKey)).toBe(text)
  })

  it("a stranger cannot read it", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const eve = await generateKeyPair()
    const cipher = await seal("secret", ann.publicKey, me.privateKey)
    expect(await open(cipher, me.publicKey, eve.privateKey)).toBeNull()
  })

  it("rejects the wrong sender key (the sender is checked)", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const eve = await generateKeyPair()
    const cipher = await seal("secret", ann.publicKey, me.privateKey)
    expect(await open(cipher, eve.publicKey, ann.privateKey)).toBeNull()
  })

  it("a changed byte makes it unreadable", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const cipher = await seal("secret", ann.publicKey, me.privateKey)
    const i = Math.floor(cipher.length / 2)
    const tampered = cipher.slice(0, i) + (cipher[i] === "A" ? "B" : "A") + cipher.slice(i + 1)
    expect(await open(tampered, me.publicKey, ann.privateKey)).toBeNull()
  })

  it("garbage and too-short values are unreadable, not errors", async () => {
    const me = await generateKeyPair()
    for (const bad of ["", "abc", "!!!not base64!!!", "AAAA"]) expect(await open(bad, me.publicKey, me.privateKey)).toBeNull()
  })

  it("the same text gives a different value each time", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    expect(await seal("same", ann.publicKey, me.privateKey)).not.toBe(await seal("same", ann.publicKey, me.privateKey))
  })

  it("a malformed key throws", async () => {
    const me = await generateKeyPair()
    await expect(seal("x", "not-a-key", me.privateKey)).rejects.toThrow("Invalid key")
    await expect(seal("x", me.publicKey, "AAAA")).rejects.toThrow("Invalid key")
    await expect(open("AAAA", me.publicKey, "")).rejects.toThrow("Invalid key")
  })

  it("derives the public key from the private key", async () => {
    const kp = await generateKeyPair()
    expect(await publicKeyOf(kp.privateKey)).toBe(kp.publicKey)
  })
})
