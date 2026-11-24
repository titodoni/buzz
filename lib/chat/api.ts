"use client"

import { getSupabase } from "@/lib/supabase/browser-client"
import { fetchPublicKey } from "@/lib/crypto/keys"
import { keyToPin, loadPins, pinFriendKey } from "@/lib/crypto/trust"
import { DEFAULT_MESSAGE_LIMIT } from "./messages"
import { sendEncrypted, type SendDeps } from "./send"
import type { WireRow } from "./wire"

/** How many older messages one F3 loads (Req 17.6). */
export const EARLIER_PAGE_SIZE = DEFAULT_MESSAGE_LIMIT

/**
 * Up to 50 messages between two friends, newest first (the reducer sorts
 * them): the most recent, or with `before`, those strictly before that time.
 * `created_at` is set by the server per insert, so two messages in one
 * conversation don't share a timestamp in practice.
 * The ids are safe in the filter string: `me` is the session user and the
 * chat page only accepts a UUID as `friendId`.
 */
async function loadPage(me: string, friendId: string, before: string | null): Promise<WireRow[]> {
  let query = getSupabase()
    .from("messages")
    .select("id, sender_id, receiver_id, body, created_at, format, encrypted, cipher_receiver, cipher_sender, sender_public_key")
    .or(
      `and(sender_id.eq.${me},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me})`,
    )
  if (before !== null) query = query.lt("created_at", before)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(EARLIER_PAGE_SIZE)
  if (error) throw error
  return data ?? []
}

/** The most recent 50 messages between two friends. */
export function loadHistory(me: string, friendId: string): Promise<WireRow[]> {
  return loadPage(me, friendId, null)
}

/** The 50 messages before `before` (F3); null means the most recent. */
export function loadEarlier(me: string, friendId: string, before: string | null): Promise<WireRow[]> {
  return loadPage(me, friendId, before)
}

/** The database's rate-limit triggers raise "... slow down" (migration 20261124124357). */
function isRateLimited(error: { message?: string }): boolean {
  return /slow down/.test(error.message ?? "")
}

/** Real versions of what `sendEncrypted` needs from the outside. */
const sendDeps: SendDeps = {
  fetchFriendKey: fetchPublicKey,
  loadPins: (me) => loadPins(localStorage, me),
  pin: (me, friendId, key) => pinFriendKey(localStorage, me, friendId, key),
  /**
   * Inserts an Encrypted Message with a client-made id. When the friend is
   * online it is stamped delivered right away (Req 5.5, 9.1).
   */
  insert: async (row) => {
    try {
      const { error } = await getSupabase()
        .from("messages")
        .insert({
          id: row.id,
          sender_id: row.sender_id,
          receiver_id: row.receiver_id,
          encrypted: true,
          cipher_receiver: row.cipher_receiver,
          cipher_sender: row.cipher_sender,
          sender_public_key: row.sender_public_key,
          ...(row.delivered ? { delivered_at: new Date().toISOString() } : {}),
        })
      if (error && isRateLimited(error)) return "rate-limited"
      return !error
    } catch {
      return false
    }
  },
}

/** Encrypts and sends one message (ADR 0010). There is no plaintext path. */
export function sendEncryptedMessage(input: Parameters<typeof sendEncrypted>[0]) {
  return sendEncrypted(input, sendDeps)
}

/**
 * Marks the friend's messages to me as delivered, then read (Req 9.3).
 * Only null columns are touched, as the receipt trigger requires.
 */
export async function markConversationRead(me: string, friendId: string): Promise<void> {
  const supabase = getSupabase()
  const now = new Date().toISOString()
  const delivered = await supabase
    .from("messages")
    .update({ delivered_at: now })
    .eq("receiver_id", me)
    .eq("sender_id", friendId)
    .is("delivered_at", null)
  if (delivered.error) throw delivered.error
  const read = await supabase
    .from("messages")
    .update({ read_at: now })
    .eq("receiver_id", me)
    .eq("sender_id", friendId)
    .is("read_at", null)
  if (read.error) throw read.error
}

/**
 * The user has compared the Safety Number and accepts the friend's new key
 * (ADR 0010, E3.1). `shownKey` is the key whose Safety Number they compared. It is
 * remembered only if the server still shows that same key. False if it could not be read or changed again.
 */
export async function trustFriendKey(me: string, friendId: string, shownKey: string | null): Promise<boolean> {
  try {
    const key = keyToPin(shownKey, await fetchPublicKey(friendId))
    if (key === null) return false
    pinFriendKey(localStorage, me, friendId, key)
    return true
  } catch {
    return false
  }
}
