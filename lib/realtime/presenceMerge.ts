import type { PresenceState } from "../presence/state";

/** Shape of `channel.presenceState()`: presence key -> tracked entries. */
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

/**
 * One person's state from the presence of their own topic (`presence:<id>`).
 * Only that person may track there (Realtime Authorization), so every entry
 * on the topic is theirs, whatever presence key it uses. Several entries
 * (two app instances) merge by rank.
 */
export function stateOfTopic(payload: PresencePayload | undefined): PresenceState {
  let best: PresenceState = "offline";
  for (const entries of Object.values(payload ?? {})) {
    for (const { presence_state: s } of entries) {
      if (isTracked(s) && (best === "offline" || RANK[s] > RANK[best])) best = s;
    }
  }
  return best;
}

/** One state per friend, from each friend's own presence topic. Missing topics read as offline. */
export function mergeFriendTopics(
  topics: Readonly<Record<string, PresencePayload>>,
  friendIds: readonly string[],
): Record<string, PresenceState> {
  const out: Record<string, PresenceState> = {};
  for (const id of friendIds) out[id] = stateOfTopic(topics[id]);
  return out;
}
