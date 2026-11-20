import { describe, it, expect } from "vitest"
import { generateKeyPair } from "../../crypto/box"
import { decryptMessage } from "../../crypto/message"
import { DEFAULT_FORMAT } from "../format"
import { MSG_NOT_SENT, MSG_NO_KEYCHAIN, MSG_NO_KEY_HERE, sendEncrypted, type SendDeps } from "../send"

// Feature: buzz-encryption, the send rules (E2.1, E2.5, E3.1)
type Inserted = Parameters<SendDeps["insert"]>[0]

async function setup(opts: { friendKey?: string | null; pins?: Record<string, string>; insertOk?: boolean; fetchFails?: boolean } = {}) {
  const me = await generateKeyPair()
  const friend = await generateKeyPair()
  const inserted: Inserted[] = []
  const pinned: Array<[string, string]> = []
  const friendKey = opts.friendKey === undefined ? friend.publicKey : opts.friendKey
  const deps: SendDeps = {
    fetchFriendKey: async () => {
      if (opts.fetchFails) throw new Error("offline")
      return friendKey
    },
    loadPins: () => opts.pins ?? {},
    pin: (_me, id, key) => void pinned.push([id, key]),
    insert: async (row) => (inserted.push(row), opts.insertOk ?? true),
  }
  const input = { me: "me", friendId: "ann", friendName: "Ann", body: "hello", format: DEFAULT_FORMAT, id: "m1", delivered: true, keys: me }
  return { me, friend, deps, inserted, pinned, input }
}

describe("sendEncrypted", () => {
  it("sends two readable copies and never the text", async () => {
    const t = await setup()
    expect(await sendEncrypted(t.input, t.deps)).toEqual({ ok: true })
    const row = t.inserted[0]
    expect(JSON.stringify(row)).not.toContain("hello")
    expect(row).toMatchObject({ id: "m1", sender_id: "me", receiver_id: "ann", sender_public_key: t.me.publicKey, delivered: true })
    const asFriend = await decryptMessage({ senderId: "me", senderPublicKey: row.sender_public_key, cipherReceiver: row.cipher_receiver, cipherSender: row.cipher_sender }, { id: "ann", privateKey: t.friend.privateKey })
    const asMe = await decryptMessage({ senderId: "me", senderPublicKey: row.sender_public_key, cipherReceiver: row.cipher_receiver, cipherSender: row.cipher_sender }, { id: "me", privateKey: t.me.privateKey })
    expect(asFriend?.body).toBe("hello")
    expect(asMe?.body).toBe("hello")
  })

  it("remembers a friend's key the first time", async () => {
    const t = await setup()
    await sendEncrypted(t.input, t.deps)
    expect(t.pinned).toEqual([["ann", t.friend.publicKey]])
  })

  it("does not pin again when the key is already remembered", async () => {
    const t = await setup()
    const t2 = await setup({ pins: { ann: t.friend.publicKey }, friendKey: t.friend.publicKey })
    await sendEncrypted(t2.input, t2.deps)
    expect(t2.pinned).toEqual([])
    expect(t2.inserted).toHaveLength(1)
  })

  it("blocks a friend with no key, in plain words, and sends nothing", async () => {
    const t = await setup({ friendKey: null })
    expect(await sendEncrypted(t.input, t.deps)).toEqual({ ok: false, message: "Ann hasn't set up encryption yet.", reason: "missing" })
    expect(t.inserted).toEqual([])
  })

  it("blocks a changed key until it is confirmed, and sends nothing", async () => {
    const other = await generateKeyPair()
    const t = await setup({ pins: { ann: other.publicKey } })
    const r = await sendEncrypted(t.input, t.deps)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.message).toContain("Ann's key changed")
      expect(r.reason).toBe("changed")
    }
    expect(t.inserted).toEqual([])
    expect(t.pinned).toEqual([])
  })

  it("blocks when I have no key", async () => {
    const t = await setup()
    expect(await sendEncrypted({ ...t.input, keys: null }, t.deps)).toEqual({ ok: false, message: MSG_NO_KEY_HERE })
    expect(t.inserted).toEqual([])
  })

  it("blocks, with its own words, when this computer has no keychain", async () => {
    const t = await setup()
    expect(await sendEncrypted({ ...t.input, keys: "unavailable" }, t.deps)).toEqual({ ok: false, message: MSG_NO_KEYCHAIN })
    expect(t.inserted).toEqual([])
  })

  it("reports not sent when the key lookup fails or the insert is refused", async () => {
    const a = await setup({ fetchFails: true })
    expect(await sendEncrypted(a.input, a.deps)).toEqual({ ok: false, message: MSG_NOT_SENT })
    const b = await setup({ insertOk: false })
    expect(await sendEncrypted(b.input, b.deps)).toEqual({ ok: false, message: MSG_NOT_SENT })
  })

  it("refuses empty and oversized text before anything leaves", async () => {
    const t = await setup()
    expect(await sendEncrypted({ ...t.input, body: "  " }, t.deps)).toEqual({ ok: false, message: MSG_NOT_SENT })
    expect(await sendEncrypted({ ...t.input, body: "a".repeat(1001) }, t.deps)).toEqual({ ok: false, message: MSG_NOT_SENT })
    expect(t.inserted).toEqual([])
  })
})
