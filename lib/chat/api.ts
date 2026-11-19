"use client"

import { getSupabase } from "@/lib/supabase/browser-client"
import { DEFAULT_MESSAGE_LIMIT } from "./messages"
import type { MessageRow } from "./conversation"

export const MSG_NOT_SENT = "This message was not sent."

export type SendResult = { ok: true } | { ok: false; message: string }

/** The most recent 50 messages between two friends (the reducer sorts them). */
export async function loadHistory(me: string, friendId: string): Promise<MessageRow[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("id, sender_id, receiver_id, body, created_at")
    .or(
      `and(sender_id.eq.${me},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me})`,
    )
    .order("created_at", { ascending: false })
    .limit(DEFAULT_MESSAGE_LIMIT)
  if (error) throw error
  return data ?? []
}

/**
 * Inserts a message with a client-made id. When the friend is online the
 * message is stamped delivered right away (Req 5.5, 9.1).
 */
export async function sendMessage(row: MessageRow, deliveredNow: boolean): Promise<SendResult> {
  try {
    const { error } = await getSupabase()
      .from("messages")
      .insert({
        id: row.id,
        sender_id: row.sender_id,
        receiver_id: row.receiver_id,
        body: row.body,
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
