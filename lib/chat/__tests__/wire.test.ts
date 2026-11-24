import { describe, it, expect } from "vitest"
import { generateKeyPair } from "../../crypto/box"
import { encryptMessage } from "../../crypto/message"
import { DEFAULT_FORMAT } from "../format"
import { UNREADABLE_TEXT, UNVERIFIED_TEXT, readWireRow, readWireRows, type WireRow } from "../wire"

// Feature: buzz-encryption, reading stored rows (E2.2, E2.7, E4.1)
const base = { id: "m1", sender_id: "ann", receiver_id: "bob", created_at: "2026-11-20T10:00:00Z" }

async function encryptedRow(from: { publicKey: string; privateKey: string }, to: { publicKey: string }, body: string): Promise<WireRow> {
  const r = await encryptMessage(body, DEFAULT_FORMAT, { friendPublicKey: to.publicKey, myPublicKey: from.publicKey, myPrivateKey: from.privateKey })
  if (!r.ok) throw new Error("encrypt failed")
  return { ...base, body: null, encrypted: true, cipher_receiver: r.pair.cipherReceiver, cipher_sender: r.pair.cipherSender, sender_public_key: from.publicKey }
}

describe("readWireRow", () => {
  it("passes a plaintext row through, with or without a key", async () => {
    const row: WireRow = { ...base, body: "old message", format: null, encrypted: false }
    expect(await readWireRow(row, null)).toMatchObject({ body: "old message" })
    const kp = await generateKeyPair()
    expect(await readWireRow(row, { id: "bob", privateKey: kp.privateKey })).toMatchObject({ body: "old message" })
  })

  it("rows without the encrypted field count as plaintext", async () => {
    expect(await readWireRow({ ...base, body: "older still" }, null)).toMatchObject({ body: "older still" })
  })

  it("the friend reads an Encrypted Message", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "hi bob")
    const out = await readWireRow(row, { id: "bob", privateKey: bob.privateKey })
    expect(out).toMatchObject({ id: "m1", sender_id: "ann", body: "hi bob", format: DEFAULT_FORMAT })
    expect(out.unreadable).toBeUndefined()
  })

  it("the sender rereads their own Encrypted Message", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "my own words")
    expect(await readWireRow(row, { id: "ann", privateKey: ann.privateKey })).toMatchObject({ body: "my own words" })
  })

  it("shows the notice when this device has no key", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const out = await readWireRow(await encryptedRow(ann, bob, "secret"), null)
    expect(out).toMatchObject({ body: UNREADABLE_TEXT, unreadable: true })
    expect(JSON.stringify(out)).not.toContain("secret")
  })

  it("shows the notice after a fresh start (a different key)", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const newBob = await generateKeyPair()
    const out = await readWireRow(await encryptedRow(ann, bob, "secret"), { id: "bob", privateKey: newBob.privateKey })
    expect(out).toMatchObject({ body: UNREADABLE_TEXT, unreadable: true })
  })

  it("shows the notice for an encrypted row missing a part", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "secret")
    const out = await readWireRow({ ...row, sender_public_key: null }, { id: "bob", privateKey: bob.privateKey })
    expect(out.unreadable).toBe(true)
  })

  it("keeps order across a list, mixing old and new rows", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const rows = [
      { ...base, id: "a", body: "plain first" },
      { ...(await encryptedRow(ann, bob, "second")), id: "b" },
    ]
    const out = await readWireRows(rows, { id: "bob", privateKey: bob.privateKey })
    expect(out.map((m) => m.body)).toEqual(["plain first", "second"])
  })
})

describe("readWireRow and the sender key (audit S11)", () => {
  it("does not open a friend's message whose key the user has not accepted", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "looks like ann")
    const out = await readWireRow(row, { id: "bob", privateKey: bob.privateKey, trustsSender: () => false })
    expect(out).toMatchObject({ body: UNVERIFIED_TEXT, unreadable: true, unverified: true })
  })

  it("opens it once the key is accepted", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "hi bob")
    const seen: string[] = []
    const out = await readWireRow(row, {
      id: "bob",
      privateKey: bob.privateKey,
      trustsSender: (sender, key) => {
        seen.push(sender)
        return key === ann.publicKey
      },
    })
    expect(out).toMatchObject({ body: "hi bob" })
    expect(seen).toEqual(["ann"])
  })

  it("never asks about my own messages", async () => {
    const ann = await generateKeyPair()
    const bob = await generateKeyPair()
    const row = await encryptedRow(ann, bob, "my own words")
    const out = await readWireRow(row, { id: "ann", privateKey: ann.privateKey, trustsSender: () => false })
    expect(out).toMatchObject({ body: "my own words" })
  })
})
