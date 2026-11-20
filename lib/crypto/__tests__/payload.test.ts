import { describe, it, expect } from "vitest"
import { DEFAULT_FORMAT } from "../../chat/format"
import { generateKeyPair } from "../box"
import { decryptMessage, encryptMessage } from "../message"
import { MAX_CIPHER_LENGTH, decodePayload, encodePayload, fitsCipher, isValidBody } from "../payload"

// Feature: buzz-encryption, payload rules and the two-copy message (ADR 0010, E2.1, E2.6)
const BIG_FORMAT = { font: "Times New Roman", size: 24, color: "#abcdef", bold: true, italic: true, underline: true } as const

describe("payload limits", () => {
  it("accepts 1 to 1000 characters", () => {
    expect(isValidBody("a")).toBe(true)
    expect(isValidBody("a".repeat(1000))).toBe(true)
  })
  it("rejects 1001 characters, empty and blank", () => {
    expect(isValidBody("a".repeat(1001))).toBe(false)
    expect(isValidBody("")).toBe(false)
    expect(isValidBody("   \n")).toBe(false)
  })
  it("counts a 4-byte character as one", () => {
    expect(isValidBody("😀".repeat(1000))).toBe(true)
    expect(isValidBody("😀".repeat(1001))).toBe(false)
  })
  it("encode reports why it refused", () => {
    expect(encodePayload("  ", DEFAULT_FORMAT)).toEqual({ ok: false, reason: "empty" })
    expect(encodePayload("a".repeat(1001), DEFAULT_FORMAT)).toEqual({ ok: false, reason: "too long" })
  })
})

describe("decodePayload", () => {
  it("round-trips body and format", () => {
    const enc = encodePayload("hi", BIG_FORMAT)
    expect(enc.ok && decodePayload(enc.json)).toEqual({ body: "hi", format: BIG_FORMAT })
  })
  it("a bad format falls back to the default", () => {
    expect(decodePayload(JSON.stringify({ body: "hi", format: { font: "Comic Sans" } }))?.format).toEqual(DEFAULT_FORMAT)
  })
  it("rejects wrong shapes", () => {
    for (const bad of ["", "nope", "null", "[]", '"x"', "{}", '{"body":"hi"}', '{"body":1,"format":{}}',
      '{"body":"","format":{}}', '{"body":"hi","format":{},"extra":1}', JSON.stringify({ body: "a".repeat(1001), format: {} })])
      expect(decodePayload(bad)).toBeNull()
  })
})

describe("stored size", () => {
  it("the worst valid message fits MAX_CIPHER_LENGTH", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const r = await encryptMessage("😀".repeat(1000), BIG_FORMAT, { friendPublicKey: ann.publicKey, myPublicKey: me.publicKey, myPrivateKey: me.privateKey })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pair.cipherReceiver.length).toBeLessThanOrEqual(MAX_CIPHER_LENGTH)
      expect(fitsCipher(r.pair.cipherSender)).toBe(true)
    }
  })
  it("fitsCipher refuses an oversized value", () => {
    expect(fitsCipher("a".repeat(MAX_CIPHER_LENGTH + 1))).toBe(false)
  })
})

describe("two copies in one row", () => {
  it("sender reads the sender copy, friend reads the receiver copy", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const r = await encryptMessage("hello", BIG_FORMAT, { friendPublicKey: ann.publicKey, myPublicKey: me.publicKey, myPrivateKey: me.privateKey })
    if (!r.ok) throw new Error("encrypt failed")
    const row = { senderId: "me", cipherReceiver: r.pair.cipherReceiver, cipherSender: r.pair.cipherSender }
    const asSender = await decryptMessage(row, { id: "me", publicKey: me.publicKey, privateKey: me.privateKey }, me.publicKey)
    const asFriend = await decryptMessage(row, { id: "ann", publicKey: ann.publicKey, privateKey: ann.privateKey }, me.publicKey)
    expect(asSender).toEqual({ body: "hello", format: BIG_FORMAT })
    expect(asFriend).toEqual({ body: "hello", format: BIG_FORMAT })
  })
  it("the friend cannot read the sender copy and the sender cannot read the receiver copy", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const r = await encryptMessage("hello", DEFAULT_FORMAT, { friendPublicKey: ann.publicKey, myPublicKey: me.publicKey, myPrivateKey: me.privateKey })
    if (!r.ok) throw new Error("encrypt failed")
    const swapped = { senderId: "me", cipherReceiver: r.pair.cipherSender, cipherSender: r.pair.cipherReceiver }
    expect(await decryptMessage(swapped, { id: "ann", publicKey: ann.publicKey, privateKey: ann.privateKey }, me.publicKey)).toBeNull()
    expect(await decryptMessage(swapped, { id: "me", publicKey: me.publicKey, privateKey: me.privateKey }, me.publicKey)).toBeNull()
  })
  it("a message from a swapped sender key is unreadable", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const eve = await generateKeyPair()
    const r = await encryptMessage("hello", DEFAULT_FORMAT, { friendPublicKey: ann.publicKey, myPublicKey: me.publicKey, myPrivateKey: me.privateKey })
    if (!r.ok) throw new Error("encrypt failed")
    const row = { senderId: "me", cipherReceiver: r.pair.cipherReceiver, cipherSender: r.pair.cipherSender }
    expect(await decryptMessage(row, { id: "ann", publicKey: ann.publicKey, privateKey: ann.privateKey }, eve.publicKey)).toBeNull()
  })
  it("refuses an empty or oversized body before encrypting", async () => {
    const me = await generateKeyPair()
    const ann = await generateKeyPair()
    const keys = { friendPublicKey: ann.publicKey, myPublicKey: me.publicKey, myPrivateKey: me.privateKey }
    expect(await encryptMessage(" ", DEFAULT_FORMAT, keys)).toEqual({ ok: false, reason: "empty" })
    expect(await encryptMessage("a".repeat(1001), DEFAULT_FORMAT, keys)).toEqual({ ok: false, reason: "too long" })
  })
})
