// Supabase Realtime closes a client's channel when it sends more than 5
// presence updates (track or untrack) within 30 seconds
// (https://supabase.com/kb/troubleshooting/realtime-client-presence-rate-limit-reached).
// We keep one below that so a quick run of status changes can never trip it.

/** Length of Supabase's presence rate-limit window. */
export const PRESENCE_WINDOW_MS = 30_000;
/** Most presence updates we send inside one window. */
export const PRESENCE_BUDGET = 4;

export interface PresenceSendPlan {
  /** True when an update may be sent now. */
  sendNow: boolean;
  /** When not sending now, how long to wait before trying again. */
  waitMs: number;
  /** The send times still inside the window (older ones are dropped). */
  recent: number[];
}

/** Decides whether a presence update may go out now, given the recent send times (epoch ms). */
export function planPresenceSend(sentAt: readonly number[], now: number): PresenceSendPlan {
  const recent = sentAt.filter((t) => now - t < PRESENCE_WINDOW_MS);
  if (recent.length < PRESENCE_BUDGET) return { sendNow: true, waitMs: 0, recent };
  const oldest = Math.min(...recent);
  return { sendNow: false, waitMs: oldest + PRESENCE_WINDOW_MS - now, recent };
}
