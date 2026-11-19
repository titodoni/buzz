import type { PresenceState } from "../presence/state";

/** Shape of `channel.presenceState()`: presence key (user id) -> tracked entries. */
export type PresencePayload = Record<string, ReadonlyArray<{ presence_state?: unknown }>>;

type TrackedState = Exclude<PresenceState, "offline">;

/**
 * When one person has several entries (e.g. two app instances), the highest
 * rank wins: an explicit Busy beats Online, and activity anywhere beats Away.
 */
const RANK: Record<TrackedState, number> = { busy: 3, online: 2, away: 1 };

function isTracked(value: unknown): value is TrackedState {
  return typeof value === "string" && Object.hasOwn(RANK, value);
}

/** Turns the Realtime presence payload into one state per friend. */
export function mergePresence(
  payload: PresencePayload,
  friendIds: readonly string[],
): Record<string, PresenceState> {
  const out: Record<string, PresenceState> = {};
  for (const id of friendIds) {
    let best: PresenceState = "offline";
    for (const { presence_state: s } of payload[id] ?? []) {
      if (isTracked(s) && (best === "offline" || RANK[s] > RANK[best])) best = s;
    }
    out[id] = best;
  }
  return out;
}
