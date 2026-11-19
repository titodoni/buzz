"use client"

import { getSupabase } from "@/lib/supabase/browser-client"
import { DEFAULT_MESSAGE_LIMIT } from "./messages"
import type { MessageRow } from "./conversation"
import type { MessageFormat } from "./format"

export const MSG_NOT_SENT = "This message was not sent."

export type SendResult = { ok: true } | { ok: false; message: string }

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
async function loadPage(me: string, friendId: string, before: string | null): Promise<MessageRow[]> {
  let query = getSupabase()
    .from("messages")
    .select("id, sender_id, receiver_id, body, created_at, format")
    .or(
      `and(sender_id.eq.${me},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me})`,
    )
  if (before !== null) query = query.lt("created_at", before)
  const { data, error } = await query.order("created_at", { ascending: false }).limit(EARLIER_PAGE_SIZE)
  if (error) throw error
  return data ?? []
}

/** The most recent 50 messages between two friends. */
export function loadHistory(me: string, friendId: string): Promise<MessageRow[]> {
  return loadPage(me, friendId, null)
}

/** The 50 messages before `before` (F3); null means the most recent. */
export function loadEarlier(me: string, friendId: string, before: string | null): Promise<MessageRow[]> {
  return loadPage(me, friendId, before)
}

/**
 * Inserts a message with a client-made id. When the friend is online the
 * message is stamped delivered right away (Req 5.5, 9.1).
 */
export async function sendMessage(
  row: MessageRow,
  format: MessageFormat,
  deliveredNow: boolean,
): Promise<SendResult> {
  try {
    const { error } = await getSupabase()
      .from("messages")
      .insert({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        body: row.body,
        // Spread into a plain object: the column type is Json.
        format: { ...format },
        ...(deliveredNow ? { delivered_at: new Date().toISOString() } : {}),
      })
    if (error) return { ok: false, message: MSG_NOT_SENT }
    return { ok: true }
  } catch {
    return { ok: false, message: MSG_NOT_SENT }
  }
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
