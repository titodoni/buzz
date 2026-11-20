import { encryptMessage } from "../crypto/message"
import { checkFriendKey, sendGate, type Pins } from "../crypto/trust"
import type { KeyPair } from "../crypto/box"
import type { MessageFormat } from "./format"

export const MSG_NO_KEY_HERE = "Your encryption key isn't ready yet. Try again in a moment."
export const MSG_NOT_SENT = "This message was not sent."
export const MSG_NO_KEYCHAIN = "Encryption isn't available on this computer, so Buzz can't send messages."

/** `reason` is set when the friend's key is the problem, so the window can offer the right next step. */
export type SendOutcome = { ok: true } | { ok: false; message: string; reason?: "missing" | "changed" }

/** The outside world, passed in so the rules can be tested. */
export interface SendDeps {
  /** The friend's public key as the server shows it now, or null if none. */
  fetchFriendKey(friendId: string): Promise<string | null>
  loadPins(me: string): Pins
  pin(me: string, friendId: string, key: string): void
  insert(row: {
    id: string
    sender_id: string
    receiver_id: string
    cipher_receiver: string
    cipher_sender: string
    sender_public_key: string
    delivered: boolean
  }): Promise<boolean>
}

/**
 * Sends one Encrypted Message (ADR 0010). The friend's key is read right now,
 * so a change is noticed before the message leaves. There is no plaintext
 * fallback: with no key of mine, no key of the friend's, or a changed key
 * that was not confirmed, the message is not sent and the reason is returned.
 */
export async function sendEncrypted(
  input: { me: string; friendId: string; friendName: string; body: string; format: MessageFormat; id: string; delivered: boolean; keys: KeyPair | null | "unavailable" },
  deps: SendDeps,
): Promise<SendOutcome> {
  if (input.keys === "unavailable") return { ok: false, message: MSG_NO_KEYCHAIN }
  if (!input.keys) return { ok: false, message: MSG_NO_KEY_HERE }
  let friendKey: string | null
  try {
    friendKey = await deps.fetchFriendKey(input.friendId)
  } catch {
    return { ok: false, message: MSG_NOT_SENT }
  }
  const pinned = deps.loadPins(input.me)[input.friendId] ?? null
  const check = checkFriendKey(pinned, friendKey)
  const gate = sendGate(check, input.friendName)
  if (!gate.allowed) return { ok: false, message: gate.message, reason: gate.reason }
  if (friendKey === null) return { ok: false, message: MSG_NOT_SENT }
  // First sight of this friend's key: remember it (trust on first use).
  if (check.status === "new") deps.pin(input.me, input.friendId, friendKey)

  const enc = await encryptMessage(input.body, input.format, {
    friendPublicKey: friendKey,
    myPublicKey: input.keys.publicKey,
    myPrivateKey: input.keys.privateKey,
  }).catch(() => null)
  if (!enc || !enc.ok) return { ok: false, message: MSG_NOT_SENT }

  const ok = await deps.insert({
    id: input.id,
    sender_id: input.me,
    receiver_id: input.friendId,
    cipher_receiver: enc.pair.cipherReceiver,
    cipher_sender: enc.pair.cipherSender,
    sender_public_key: input.keys.publicKey,
    delivered: input.delivered,
  })
  return ok ? { ok: true } : { ok: false, message: MSG_NOT_SENT }
}
