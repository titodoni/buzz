"use client";

import { useEffect, useRef } from "react";
import { getSupabase } from "../supabase/browser-client";

// Each signed-in user's Buddy List listens on a personal inbox channel. A nudge
// is sent there as well as on the pair's chat channel, so a friend whose chat
// window is closed still gets it: their Buddy List pops the window open and it
// shakes, as in classic Yahoo Messenger (docs/adr/0007).

/** Inbox channel name for a user. */
export function inboxChannel(userId: string): string {
  return `inbox:${userId}`;
}

const NUDGE_EVENT = "nudge";

/**
 * Sends a nudge to a friend's inbox over Realtime's REST broadcast endpoint
 * (no subscription needed). Resolves true when the server accepted it.
 */
export async function sendNudgeToInbox(friendId: string, me: string): Promise<boolean> {
  const supabase = getSupabase();
  const channel = supabase.channel(inboxChannel(friendId));
  try {
    const res = await channel.httpSend(NUDGE_EVENT, { sender: me });
    return res.success;
  } catch {
    return false;
  } finally {
    void supabase.removeChannel(channel);
  }
}

/**
 * Buddy List only: calls `onNudge(senderId)` for every nudge arriving in my
 * inbox. The caller decides what to do (open or focus the chat window).
 */
export function useNudgeInbox(me: string, onNudge: (senderId: string) => void): void {
  const onNudgeRef = useRef(onNudge);
  useEffect(() => {
    onNudgeRef.current = onNudge;
  }, [onNudge]);

  useEffect(() => {
    if (!me) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(inboxChannel(me))
      .on("broadcast", { event: NUDGE_EVENT }, ({ payload }) => {
        // Payload comes from another client, so check its shape before use.
        const sender = (payload as { sender?: unknown } | null)?.sender;
        if (typeof sender === "string" && sender !== me) onNudgeRef.current(sender);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me]);
}
