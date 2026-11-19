export type PresenceState = "online" | "away" | "busy" | "offline";

export type PresenceEvent =
  | { type: "activity"; now: number }
  | { type: "idleTimeout"; now: number; lastActivityAt: number }
  | { type: "setBusy" }
  | { type: "setOnline" }
  | { type: "disconnect" }
  | { type: "heartbeatMissed" };

/** Idle time (ms) after which an online user becomes away. */
export const IDLE_TIMEOUT_MS = 300_000;

/**
 * Pure presence transition.
 *
 * - `activity` and `setOnline` always yield `online`. This includes `busy`:
 *   busy persists only until an explicit activity/setOnline/disconnect, so
 *   user activity DOES end busy. It also includes `offline`; the caller is
 *   responsible for only emitting events while connected.
 * - `idleTimeout` yields `away` only when `now - lastActivityAt >= 5 min`
 *   and current is `online` or `away`. It never overrides `busy` or `offline`.
 *   Otherwise the current state is returned unchanged.
 * - `setBusy` yields `busy`.
 * - `disconnect` and `heartbeatMissed` yield `offline`.
 */
export function nextPresenceState(
  current: PresenceState,
  e: PresenceEvent,
): PresenceState {
  switch (e.type) {
    case "activity":
    case "setOnline":
      return "online";
    case "idleTimeout":
      if (current === "busy" || current === "offline") return current;
      return e.now - e.lastActivityAt >= IDLE_TIMEOUT_MS ? "away" : current;
    case "setBusy":
      return "busy";
    case "disconnect":
    case "heartbeatMissed":
      return "offline";
  }
}
