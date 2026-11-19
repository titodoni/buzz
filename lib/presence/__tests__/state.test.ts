import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  IDLE_TIMEOUT_MS,
  nextPresenceState,
  type Availability,
  type PresenceEvent,
  type PresenceState,
} from "../state";

const states: PresenceState[] = ["online", "away", "busy", "offline"];
const stateArb = fc.constantFrom(...states);
const time = fc.integer({ min: 0, max: 2_000_000_000 });
const delta = fc.oneof(
  fc.constantFrom(IDLE_TIMEOUT_MS - 1, IDLE_TIMEOUT_MS, IDLE_TIMEOUT_MS + 1, 0),
  fc.integer({ min: -1_000_000, max: 2_000_000 }),
);
const eventArb: fc.Arbitrary<PresenceEvent> = fc.oneof(
  time.map((now) => ({ type: "activity" as const, now })),
  fc.tuple(time, delta).map(([lastActivityAt, d]) => ({
    type: "idleTimeout" as const,
    now: lastActivityAt + d,
    lastActivityAt,
  })),
  fc.constant({ type: "setBusy" as const }),
  fc.constant({ type: "setOnline" as const }),
  fc.constant({ type: "disconnect" as const }),
  fc.constant({ type: "heartbeatMissed" as const }),
);

const opts = { numRuns: 200 };

// Feature: buzz, Property 9: Presence state machine
describe("Property 9: Presence state machine", () => {
  it("setOnline (choosing Available) -> online from any state", () => {
    fc.assert(
      fc.property(stateArb, (cur) => {
        expect(nextPresenceState(cur, { type: "setOnline" })).toBe("online");
      }),
      opts,
    );
  });
  it("activity -> online, except a user who chose busy stays busy (Req 4.3)", () => {
    fc.assert(
      fc.property(stateArb, time, (cur, now) => {
        expect(nextPresenceState(cur, { type: "activity", now })).toBe(
          cur === "busy" ? "busy" : "online",
        );
      }),
      opts,
    );
  });

  it("idleTimeout -> away iff elapsed >= 5 min (online/away), boundaries +/-1 ms", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PresenceState>("online", "away"),
        time,
        delta,
        (cur, last, d) => {
          const out = nextPresenceState(cur, {
            type: "idleTimeout",
            now: last + d,
            lastActivityAt: last,
          });
          expect(out).toBe(d >= IDLE_TIMEOUT_MS ? "away" : cur);
        },
      ),
      opts,
    );
    const at = (d: number, cur: PresenceState) =>
      nextPresenceState(cur, {
        type: "idleTimeout",
        now: 1000 + d,
        lastActivityAt: 1000,
      });
    expect(at(299_999, "online")).toBe("online");
    expect(at(300_000, "online")).toBe("away");
    expect(at(300_001, "online")).toBe("away");
  });

  it("idleTimeout never overrides busy or offline", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PresenceState>("busy", "offline"),
        time,
        delta,
        (cur, last, d) => {
          expect(
            nextPresenceState(cur, {
              type: "idleTimeout",
              now: last + d,
              lastActivityAt: last,
            }),
          ).toBe(cur);
        },
      ),
      opts,
    );
  });

  it("setBusy -> busy; disconnect/heartbeatMissed -> offline", () => {
    fc.assert(
      fc.property(stateArb, (cur) => {
        expect(nextPresenceState(cur, { type: "setBusy" })).toBe("busy");
        expect(nextPresenceState(cur, { type: "disconnect" })).toBe("offline");
        expect(nextPresenceState(cur, { type: "heartbeatMissed" })).toBe(
          "offline",
        );
      }),
      opts,
    );
  });

  it("busy persists across activity/idleTimeout/setBusy sequences", () => {
    const persisting = eventArb.filter(
      (e) => e.type === "activity" || e.type === "idleTimeout" || e.type === "setBusy",
    );
    fc.assert(
      fc.property(fc.array(persisting, { maxLength: 30 }), (events) => {
        let s: Availability = "busy";
        for (const e of events) s = nextPresenceState(s, e);
        expect(s).toBe("busy");
      }),
      opts,
    );
  });

  it("random sequences match the reference model", () => {
    fc.assert(
      fc.property(
        stateArb,
        fc.array(eventArb, { maxLength: 50 }),
        (init, events) => {
          let s: Availability = init;
          for (const e of events) {
            const prev = s;
            s = nextPresenceState(prev, e);
            let expected: Availability;
            switch (e.type) {
              case "activity":
                expected = prev === "busy" ? "busy" : "online";
                break;
              case "setOnline":
                expected = "online";
                break;
              case "setBusy":
                expected = "busy";
                break;
              case "setInvisible":
                expected = "invisible";
                break;
              case "disconnect":
              case "heartbeatMissed":
                expected = "offline";
                break;
              case "idleTimeout":
                expected =
                  prev !== "busy" &&
                  prev !== "offline" &&
                  e.now - e.lastActivityAt >= IDLE_TIMEOUT_MS
                    ? "away"
                    : prev;
                break;
            }
            expect(s).toBe(expected);
          }
        },
      ),
      opts,
    );
  });
});
