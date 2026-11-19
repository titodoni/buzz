import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { IDLE_TIMEOUT_MS, nextPresenceState, type Availability } from "../state";

const all: Availability[] = ["online", "away", "busy", "invisible", "offline"];
const any = fc.constantFrom(...all);
const time = fc.integer({ min: 0, max: 2_000_000_000 });

// Feature: buzz, Property 9 (extended): Invisible
describe("Invisible availability (Req 12.1, 12.7)", () => {
  it("setInvisible gives invisible from any state", () => {
    fc.assert(
      fc.property(any, (cur) => {
        expect(nextPresenceState(cur, { type: "setInvisible" })).toBe("invisible");
      }),
    );
  });

  it("stays invisible through activity and the idle check", () => {
    fc.assert(
      fc.property(time, fc.integer({ min: 0, max: 2 * IDLE_TIMEOUT_MS }), (now, idle) => {
        expect(nextPresenceState("invisible", { type: "activity", now })).toBe("invisible");
        expect(
          nextPresenceState("invisible", { type: "idleTimeout", now: now + idle, lastActivityAt: now }),
        ).toBe("invisible");
      }),
    );
  });

  it("ends only when the user picks Available or Busy, or the connection goes", () => {
    expect(nextPresenceState("invisible", { type: "setOnline" })).toBe("online");
    expect(nextPresenceState("invisible", { type: "setBusy" })).toBe("busy");
    expect(nextPresenceState("invisible", { type: "disconnect" })).toBe("offline");
    expect(nextPresenceState("invisible", { type: "heartbeatMissed" })).toBe("offline");
  });

  it("leaves every other transition exactly as before", () => {
    expect(nextPresenceState("busy", { type: "activity", now: 1 })).toBe("busy");
    expect(nextPresenceState("online", { type: "idleTimeout", now: IDLE_TIMEOUT_MS, lastActivityAt: 0 })).toBe("away");
    expect(nextPresenceState("away", { type: "activity", now: 1 })).toBe("online");
  });
});
