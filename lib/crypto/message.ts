import { open, seal } from "./box"
import { decodePayload, encodePayload, fitsCipher, type MessagePayload } from "./payload"
import type { MessageFormat } from "../chat/format"

/** The two copies stored in one row: one the friend can read, one I can read (ADR 0010). */
export interface EncryptedPair {
  cipherReceiver: string
  cipherSender: string
}

export type EncryptResult = { ok: true; pair: EncryptedPair } | { ok: false; reason: "empty" | "too long" }

export async function encryptMessage(
  body: string,
  format: MessageFormat,
  keys: { friendPublicKey: string; myPublicKey: string; myPrivateKey: string },
): Promise<EncryptResult> {
  const enc = encodePayload(body, format)
  if (!enc.ok) return enc
  const [cipherReceiver, cipherSender] = await Promise.all([
    seal(enc.json, keys.friendPublicKey, keys.myPrivateKey),
    seal(enc.json, keys.myPublicKey, keys.myPrivateKey),
  ])
  // Cannot happen for a valid payload; stops a row the database would refuse.
  if (!fitsCipher(cipherReceiver) || !fitsCipher(cipherSender)) return { ok: false, reason: "too long" }
  return { ok: true, pair: { cipherReceiver, cipherSender } }
}

/**
 * Reads a row for the signed-in user. A message I sent is read from the
 * sender copy with my own public key; one I received is read from the
 * receiver copy with the sender's public key. Null means "can't be read".
 */
export async function decryptMessage(
  row: { senderId: string; cipherReceiver: string; cipherSender: string },
  me: { id: string; publicKey: string; privateKey: string },
  senderPublicKey: string,
): Promise<MessagePayload | null> {
  const mine = row.senderId === me.id
  const json = await open(mine ? row.cipherSender : row.cipherReceiver, mine ? me.publicKey : senderPublicKey, me.privateKey)
  return json === null ? null : decodePayload(json)
}
