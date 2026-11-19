import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { DEFAULT_GROUP_NAME, arrangeBuddyList, type ArrangeInput } from "../arrange"
import type { PresenceState } from "../../presence/state"

const f = (id: string, displayName = id) => ({ id, displayName })
const base = (over: Partial<ArrangeInput> = {}): ArrangeInput => ({
  friends: [f("ann", "Ann"), f("bob", "Bob"), f("cat", "Cat"), f("dan", "Dan")],
  groups: [
    { id: "g-other", name: "Other", position: 2 },
    { id: "g-family", name: "Family", position: 1 },
  ],
  memberships: [
    { friendId: "ann", groupId: "g-family" },
    { friendId: "bob", groupId: "g-family" },
  ],
  presence: { ann: "offline", bob: "online", cat: "busy" },
  showOffline: true,
  search: "",
  ...over,
})
const names = (g: { friends: { displayName: string }[] }) => g.friends.map((x) => x.displayName)

describe("arrangeBuddyList (Req 14.1, 14.5, 14.6, 14.8, 14.9)", () => {
  it("puts the default group first, then the user's groups in their order, with (online/total)", () => {
    const groups = arrangeBuddyList(base())
    expect(groups.map((g) => [g.id, g.name, g.online, g.total])).toEqual([
      [null, DEFAULT_GROUP_NAME, 1, 2],
      ["g-family", "Family", 1, 2],
      ["g-other", "Other", 0, 0],
    ])
    expect(DEFAULT_GROUP_NAME).toBe("Friends")
  })

  it("lists Available, Busy, and Away friends before Offline ones, then by name", () => {
    const groups = arrangeBuddyList(base({ presence: { ann: "offline", bob: "away" } }))
    expect(names(groups[1])).toEqual(["Bob", "Ann"])
    expect(names(groups[0])).toEqual(["Cat", "Dan"])
  })

  it("marks online friends bold and offline ones not", () => {
    const fam = arrangeBuddyList(base())[1]
    expect(fam.friends.map((x) => [x.displayName, x.presence, x.bold])).toEqual([
      ["Bob", "online", true],
      ["Ann", "offline", false],
    ])
  })

  it("hides offline friends when asked but keeps the whole group in the count", () => {
    const fam = arrangeBuddyList(base({ showOffline: false }))[1]
    expect(names(fam)).toEqual(["Bob"])
    expect([fam.online, fam.total]).toEqual([1, 2])
  })

  it("filters by name ignoring case, and leaves out groups with no match", () => {
    const groups = arrangeBuddyList(base({ search: "  BO " }))
    expect(groups.map((g) => [g.name, names(g), g.online, g.total])).toEqual([["Family", ["Bob"], 1, 2]])
  })

  it("puts a friend whose group no longer exists into the default group", () => {
    const groups = arrangeBuddyList(base({ memberships: [{ friendId: "ann", groupId: "g-gone" }] }))
    expect(names(groups[0])).toContain("Ann")
  })

  it("hides an empty default group when the user has groups of their own", () => {
    const groups = arrangeBuddyList(
      base({
        memberships: ["ann", "bob", "cat", "dan"].map((id) => ({ friendId: id, groupId: "g-family" })),
      }),
    )
    expect(groups.map((g) => g.name)).toEqual(["Family", "Other"])
  })

  it("always shows the default group when the user has no groups", () => {
    expect(arrangeBuddyList(base({ friends: [], groups: [], memberships: [] })).map((g) => g.name)).toEqual([
      DEFAULT_GROUP_NAME,
    ])
  })

  it("shows every friend exactly once, and counts match", () => {
    const state = fc.constantFrom<PresenceState>("online", "away", "busy", "offline")
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 5 }), { maxLength: 12 }),
        fc.array(fc.tuple(fc.nat(11), fc.nat(3))),
        fc.array(state, { minLength: 12, maxLength: 12 }),
        (ids, links, states) => {
          const friends = ids.map((id) => f(id))
          const groups = [0, 1, 2].map((i) => ({ id: `g${i}`, name: `G${i}`, position: i }))
          const memberships = links
            .filter(([fi]) => fi < ids.length)
            .map(([fi, gi]) => ({ friendId: ids[fi], groupId: `g${gi}` }))
          const presence = Object.fromEntries(ids.map((id, i) => [id, states[i]]))
          const out = arrangeBuddyList({ friends, groups, memberships, presence, showOffline: true, search: "" })
          const shown = out.flatMap((g) => g.friends.map((x) => x.id))
          expect([...shown].sort()).toEqual([...ids].sort())
          for (const g of out) {
            expect(g.total).toBe(g.friends.length)
            expect(g.online).toBe(g.friends.filter((x) => x.presence !== "offline").length)
          }
        },
      ),
    )
  })
})
