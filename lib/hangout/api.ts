"use client"

import { getSupabase } from "@/lib/supabase/browser-client"
import { HANGOUT_EXPIRY_MS, type HangoutStatus } from "./state"
import { validateHangoutText } from "./templates"

/** A Hangout row as the app uses it. */
export interface HangoutRecord {
  id: string
  sender_id: string
  receiver_id: string
  text: string
  status: HangoutStatus
  created_at: string
}

const COLUMNS = "id, sender_id, receiver_id, text, status, created_at"

/** How far back the app loads Hangouts: a little past the 15 minute expiry, so the "expired" line still shows. */
const LOOKBACK_MS = HANGOUT_EXPIRY_MS + 5 * 60_000

export type SendHangoutResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "pending" | "rate-limited" | "failed" }

/**
 * Sends a Hangout to a friend. The database allows one pending Hangout per
 * pair and refuses a sender the friend has ignored (RLS), so a refusal comes
 * back as "pending" or "failed", never as a different error screen.
 */
export async function sendHangout(me: string, friendId: string, text: string): Promise<SendHangoutResult> {
  const checked = validateHangoutText(text)
  if (!checked.ok) return { ok: false, reason: "invalid" }
  const supabase = getSupabase()
  // An old pending Hangout of mine would block the pair until the minute job
  // clears it. The database lets me expire my own once it is 15 minutes old.
  await supabase
    .from("hangouts")
    .update({ status: "expired" })
    .eq("sender_id", me)
    .eq("receiver_id", friendId)
    .eq("status", "pending")
    .lte("created_at", new Date(Date.now() - HANGOUT_EXPIRY_MS).toISOString())
  const { error } = await supabase
    .from("hangouts")
    .insert({ sender_id: me, receiver_id: friendId, text: checked.text })
  if (!error) return { ok: true }
  // 23505 is Postgres "unique violation": the one-pending-per-pair index.
  if (error.code === "23505") return { ok: false, reason: "pending" }
  // The database allows 10 Hangouts per 10 minutes (migration 20261124124357).
  if (/slow down/.test(error.message)) return { ok: false, reason: "rate-limited" }
  return { ok: false, reason: "failed" }
}

/** The receiver answers a pending Hangout. True when the row changed. */
export async function respondHangout(id: string, status: "accepted" | "declined"): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("hangouts")
    .update({ status })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
  return !error && (data?.length ?? 0) > 0
}

/** My recent Hangouts, sent or received. RLS limits the rows to the two parties. */
export async function loadRecentHangouts(): Promise<HangoutRecord[]> {
  const { data, error } = await getSupabase()
    .from("hangouts")
    .select(COLUMNS)
    .gte("created_at", new Date(Date.now() - LOOKBACK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map(toRecord)
}

/** Narrows a database row; `status` is a text column with a CHECK, so unknown values become "expired". */
export function toRecord(row: {
  id: string
  sender_id: string
  receiver_id: string
  text: string
  status: string
  created_at: string
}): HangoutRecord {
  const status: HangoutStatus =
    row.status === "pending" || row.status === "accepted" || row.status === "declined" ? row.status : "expired"
  return {
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    text: row.text,
    status,
    created_at: row.created_at,
  }
}
