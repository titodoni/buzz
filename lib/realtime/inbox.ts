"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { acceptInboundNudge, type InboundLog } from "../nudge/inbound";
import { closeChannel, openChannel } from "./channel";

// Each signed-in user's Buddy List listens on a personal inbox channel. A nudge
// is sent there as well as on the pair's chat channel, so a friend whose chat
// window is closed still gets it: their Buddy List pops the window open and it
// shakes, as in classic Yahoo Messenger (docs/adr/0007). The channel is
// private, so the server rejects nudges from anyone who isn't a friend.

/** Inbox channel name for a user. */
export function inboxChannel(userId: string): string {
  return `inbox:${userId}`;
}

const NUDGE_EVENT = "nudge";

/**
 * Sends a nudge to a friend's inbox over Realtime's REST broadcast endpoint
 * (no subscription needed). Resolves true when the server accepted it.
 */
export async function sendNudgeToInbox(me: string, friendId: string): Promise<boolean> {
  const name = inboxChannel(friendId);
  // Private: only accepted friends may send here (Realtime Authorization,
  // migration 20250101000600).
  const channel = await openChannel(name, { config: { private: true } });
  if (!channel) return false;
  try {
    const res = await channel.httpSend(NUDGE_EVENT, { sender: me });
    return res.success;
  } catch {
    return false;
  } finally {
    void closeChannel(name, channel);
  }
}

/**
 * Buddy List only: calls `onNudge(senderId, receivedAt)` for every nudge
 * arriving in my inbox; `receivedAt` is the local time in ms. The caller
 * decides what to do (open or focus the chat window).
 */
export function useNudgeInbox(me: string, onNudge: (senderId: string, receivedAt: number) => void): void {
  const onNudgeRef = useRef(onNudge);
  useEffect(() => {
    onNudgeRef.current = onNudge;
  }, [onNudge]);

  useEffect(() => {
    if (!me) return;
    const name = inboxChannel(me);
    const seen: InboundLog = new Map();
    let cancelled = false;
    let opened: RealtimeChannel | null = null;
    void (async () => {
      const channel = await openChannel(name, { config: { private: true } }, () => cancelled);
      if (!channel) return;
      opened = channel;
      channel
        .on("broadcast", { event: NUDGE_EVENT }, ({ payload }) => {
          // Payload comes from another client, so check its shape before use.
          const sender = (payload as { sender?: unknown } | null)?.sender;
          if (typeof sender !== "string" || sender === me) return;
          // A friend's modified app could Buzz in a loop; honest apps wait (lib/nudge/inbound.ts).
          const now = Date.now();
          if (acceptInboundNudge(seen, sender, now)) onNudgeRef.current(sender, now);
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (opened) void closeChannel(name, opened);
    };
  }, [me]);
}
