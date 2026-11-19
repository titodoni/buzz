/** What a friend can see: Invisible is never visible to others (they see offline). */
export type PresenceState = "online" | "away" | "busy" | "offline";
/** What the user has chosen for themselves: a PresenceState, or Invisible. */
export type Availability = PresenceState | "invisible";

export type PresenceEvent =
  | { type: "activity"; now: number }
  | { type: "idleTimeout"; now: number; lastActivityAt: number }
  | { type: "setBusy" }
  | { type: "setInvisible" }
  | { type: "setOnline" }
  | { type: "disconnect" }
  | { type: "heartbeatMissed" };

/** Idle time (ms) after which an online user becomes away. */
export const IDLE_TIMEOUT_MS = 300_000;

/**
 * Pure presence transition.
 *
 * - `activity` yields `online`, except from `busy`: a user who chose Busy
 *   stays Busy while active (Req 4.3). From `offline` it also yields
 *   `online`; the caller only emits events while connected.
 * - `setOnline` (the user picks Available) always yields `online`.
 * - `idleTimeout` yields `away` only when `now - lastActivityAt >= 5 min`
 *   and current is `online` or `away`. It never overrides `busy` or `offline`.
 *   Otherwise the current state is returned unchanged.
 * - `setBusy` yields `busy`.
 * - `setInvisible` yields `invisible`. Like Busy it is a choice, so neither
 *   `activity` nor `idleTimeout` ends it; only Available, Busy, or losing the
 *   connection does (Req 12.7).
 * - `disconnect` and `heartbeatMissed` yield `offline`.
 */
export function nextPresenceState(
  current: Availability,
  e: PresenceEvent,
): Availability {
  switch (e.type) {
    case "activity":
      // A user who chose Busy or Invisible stays that way while they keep working (Req 4.3, 12.7).
      return current === "busy" || current === "invisible" ? current : "online";
    case "setOnline":
      return "online";
    case "idleTimeout":
      if (current === "busy" || current === "offline" || current === "invisible") return current;
      return e.now - e.lastActivityAt >= IDLE_TIMEOUT_MS ? "away" : current;
    case "setBusy":
      return "busy";
    case "setInvisible":
      return "invisible";
    case "disconnect":
    case "heartbeatMissed":
      return "offline";
  }
}
