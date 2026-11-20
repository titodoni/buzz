import { decryptMessage } from "../crypto/message"
import type { MessageRow } from "./conversation"

/** What the `messages` table returns: a plaintext row, or an Encrypted Message (ADR 0010). */
export interface WireRow {
  id: string
  sender_id: string
  receiver_id: string
  body: string | null
  created_at: string
  format?: unknown
  encrypted?: boolean
  cipher_receiver?: string | null
  cipher_sender?: string | null
  sender_public_key?: string | null
}

export const UNREADABLE_TEXT = "This message can't be read on this device."

/** What reading needs: my id and private key, or null when this window has no key. */
export type ReadKey = { id: string; privateKey: string } | null

/**
 * Turns a stored row into what the chat shows. Rows from before encryption
 * pass through unchanged. An Encrypted Message becomes its text, or the
 * unreadable notice when there is no key or the key does not fit.
 */
export async function readWireRow(row: WireRow, me: ReadKey): Promise<MessageRow> {
  if (!row.encrypted) {
    return { id: row.id, sender_id: row.sender_id, receiver_id: row.receiver_id, body: row.body ?? "", created_at: row.created_at, format: row.format }
  }
  const base = { id: row.id, sender_id: row.sender_id, receiver_id: row.receiver_id, created_at: row.created_at }
  const unreadable: MessageRow = { ...base, body: UNREADABLE_TEXT, unreadable: true }
  if (!me || !row.cipher_receiver || !row.cipher_sender || !row.sender_public_key) return unreadable
  const payload = await decryptMessage(
    { senderId: row.sender_id, senderPublicKey: row.sender_public_key, cipherReceiver: row.cipher_receiver, cipherSender: row.cipher_sender },
    me,
  )
  return payload ? { ...base, body: payload.body, format: payload.format } : unreadable
}

export function readWireRows(rows: readonly WireRow[], me: ReadKey): Promise<MessageRow[]> {
  return Promise.all(rows.map((r) => readWireRow(r, me)))
}
