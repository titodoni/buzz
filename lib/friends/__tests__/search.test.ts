import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { searchUsers, canSendRequest, canonicalPair, pairKey, searchResultRelation } from "../search";

const user = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }),
  email: fc.string({ maxLength: 12 }),
  display_name: fc.string({ maxLength: 12 }),
});
const opts = { numRuns: 200 };

describe("searchUsers", () => {
  // Feature: buzz, Property 7: Friend search filtering
  it("results match query, exclude self, and are capped at 20", () => {
    fc.assert(
      fc.property(fc.array(user, { maxLength: 120 }), fc.string({ maxLength: 3 }), fc.string({ maxLength: 6 }), (users, q, self) => {
        const res = searchUsers(users, q, self);
        const needle = q.trim().toLowerCase();
        expect(res.length).toBeLessThanOrEqual(20);
        if (needle === "") expect(res).toEqual([]);
        for (const u of res) {
          expect(u.id).not.toBe(self);
          expect(u.email.toLowerCase().includes(needle) || u.display_name.toLowerCase().includes(needle)).toBe(true);
        }
      }),
      opts,
    );
  });

  // Feature: buzz, Property 7: Friend search filtering (cap boundaries, self included in list)
  it.each([19, 20, 21, 22])("with %i matches returns min(n, 20), never including self", (n) => {
    fc.assert(
      fc.property(fc.constantFrom("a", "A"), fc.nat(5), (ch, limitExtra) => {
        const users = Array.from({ length: n }, (_, i) => ({ id: `u${i}`, email: `${ch}${i}@x.io`, display_name: "zz" }));
        users.push({ id: "me", email: "a@me.io", display_name: "a" });
        const res = searchUsers(users, "a", "me");
        expect(res.length).toBe(Math.min(n, 20));
        expect(res.some((u) => u.id === "me")).toBe(false);
        const lim = searchUsers(users, "a", "me", 20 + limitExtra);
        expect(lim.length).toBeLessThanOrEqual(20);
        expect(searchUsers(users, "a", "me", 3).length).toBe(Math.min(n, 3));
      }),
      { numRuns: 100 },
    );
  });

  it("is case-insensitive and finds by display_name", () => {
    const users = [{ id: "1", email: "Bob@Ex.com", display_name: "Robert" }];
    expect(searchUsers(users, "BOB", "x")).toHaveLength(1);
    expect(searchUsers(users, "robe", "x")).toHaveLength(1);
    expect(searchUsers(users, "   ", "x")).toEqual([]);
  });
});

describe("pairs", () => {
  it("canonicalPair/pairKey are symmetric and ordered", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const [lo, hi] = canonicalPair(a, b);
        expect(lo <= hi).toBe(true);
        expect(canonicalPair(b, a)).toEqual([lo, hi]);
        expect(pairKey(a, b)).toBe(`${lo}_${hi}`);
        expect(pairKey(a, b)).toBe(pairKey(b, a));
      }),
      opts,
    );
  });
});

describe("canSendRequest", () => {
  // Feature: buzz, Property 8: Friend request gating
  it("is not ok exactly when self, accepted, or pending", () => {
    const rel = fc.option(
      fc.record({ status: fc.constantFrom("accepted", "pending", "declined", "removed", "other") }),
      { nil: null },
    );
    const id = fc.constantFrom("a", "b", "c");
    fc.assert(
      fc.property(rel, id, id, (r, self, rcpt) => {
        const blocked = rcpt === self || r?.status === "accepted" || r?.status === "pending";
        const res = canSendRequest(r, self, rcpt);
        expect(res.ok).toBe(!blocked);
        if (!res.ok) expect(res.reason).toBeTruthy();
      }),
      opts,
    );
  });
});

describe("searchResultRelation", () => {
  const lists = {
    friends: [{ id: "f1", friendshipId: "fs-f1" }],
    incoming: [{ id: "in1", friendshipId: "fs-in1" }],
    outgoing: [{ id: "out1", friendshipId: "fs-out1" }],
  };

  it("identifies existing friends, incoming requests, outgoing requests, and strangers", () => {
    expect(searchResultRelation("f1", lists)).toEqual({ kind: "friend" });
    expect(searchResultRelation("in1", lists)).toEqual({ kind: "incoming", friendshipId: "fs-in1" });
    expect(searchResultRelation("out1", lists)).toEqual({ kind: "outgoing", friendshipId: "fs-out1" });
    expect(searchResultRelation("stranger", lists)).toEqual({ kind: "none" });
  });

  it("marks optimistically sent ids as outgoing even before reload completes", () => {
    expect(searchResultRelation("stranger", lists, new Set(["stranger"]))).toEqual({ kind: "outgoing" });
  });
});
