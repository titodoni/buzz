import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { shouldRetain, orderOfflineMessages, RETENTION_MS } from "../retention";

const T0 = Date.UTC(2025, 5, 1);
const delivered = fc.option(fc.constant("2025-05-01T00:00:00.000Z"), { nil: null });

describe("shouldRetain", () => {
  // Feature: buzz, Property 12: Offline-message classification and retention cutoff
  it("retains iff undelivered and created_at > now - 30 days", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.integer({ min: -3, max: 3 }).chain((d) => fc.constant(d)),
        fc.boolean(),
        fc.option(fc.integer({ min: -RETENTION_MS * 2, max: RETENTION_MS }), { nil: undefined }),
        (now, delta, nullDelivered, offset) => {
          const createdMs = now - RETENTION_MS + (offset ?? delta); // delta=0 -> exactly 30 days
          fc.pre(createdMs >= 0);
          const m = {
            delivered_at: nullDelivered ? null : "2025-01-01T00:00:00.000Z",
            created_at: new Date(createdMs).toISOString(),
          };
          expect(shouldRetain(m, now)).toBe(nullDelivered && createdMs > now - RETENTION_MS);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("boundary: exactly 30 days old is dropped, 1 ms newer is kept", () => {
    const now = T0;
    const at = (ms: number) => ({ delivered_at: null, created_at: new Date(ms).toISOString() });
    expect(shouldRetain(at(now - RETENTION_MS), now)).toBe(false);
    expect(shouldRetain(at(now - RETENTION_MS + 1), now)).toBe(true);
    expect(shouldRetain(at(now - RETENTION_MS - 1), now)).toBe(false);
    expect(shouldRetain({ ...at(now), delivered_at: "2025-06-01T00:00:00Z" }, now)).toBe(false);
  });

  it("a delivered message is never retained", () => {
    fc.assert(
      fc.property(delivered, (d) => {
        const m = { delivered_at: d, created_at: new Date(T0).toISOString() };
        expect(shouldRetain(m, T0)).toBe(d === null);
      }),
      { numRuns: 100 },
    );
  });
});

describe("orderOfflineMessages", () => {
  // Feature: buzz, Property 13: Offline-message delivery order
  it("returns ascending created_at, a permutation, stable for ties, without mutating input", () => {
    const m = fc.record({
      id: fc.uuid(),
      created_at: fc.integer({ min: 0, max: 20 }).map((s) => new Date(T0 + s * 1000).toISOString()),
    });
    fc.assert(
      fc.property(fc.array(m, { maxLength: 80 }), (msgs) => {
        const copy = [...msgs];
        const res = orderOfflineMessages(msgs);
        expect(msgs).toEqual(copy);
        expect(res).not.toBe(msgs);
        expect(res).toHaveLength(msgs.length);
        expect([...res].map((x) => x.id).sort()).toEqual(msgs.map((x) => x.id).sort());
        for (let i = 1; i < res.length; i++) {
          const a = Date.parse(res[i - 1].created_at);
          const b = Date.parse(res[i].created_at);
          expect(a).toBeLessThanOrEqual(b);
          if (a === b) expect(msgs.indexOf(res[i - 1])).toBeLessThan(msgs.indexOf(res[i]));
        }
      }),
      { numRuns: 200 },
    );
  });
});
