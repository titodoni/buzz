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
 * Reads a row for the signed-in user. Both copies were made with the sender's
 * key as it was at send time, which the row carries, so a friend who later
 * starts fresh does not make their older messages unreadable. A message I sent
 * is read from the sender copy; one I received, from the receiver copy.
 * Null means "can't be read".
 */
export async function decryptMessage(
  row: { senderId: string; senderPublicKey: string; cipherReceiver: string; cipherSender: string },
  me: { id: string; privateKey: string },
): Promise<MessagePayload | null> {
  const mine = row.senderId === me.id
  try {
    const json = await open(mine ? row.cipherSender : row.cipherReceiver, row.senderPublicKey, me.privateKey)
    return json === null ? null : decodePayload(json)
  } catch {
    // A malformed key on the row: unreadable, not a crash.
    return null
  }
}
