import { describe, it, expect } from "vitest";
import { mergePresence } from "../presenceMerge";

describe("mergePresence", () => {
  it("reports a friend with no presence entry as offline", () => {
    expect(mergePresence({}, ["ann"])).toEqual({ ann: "offline" });
  });

  it("reports the state a friend is tracking", () => {
    const payload = { ann: [{ presence_state: "busy" }] };
    expect(mergePresence(payload, ["ann"])).toEqual({ ann: "busy" });
  });

  it("with several entries, an explicit busy wins, then online, then away", () => {
    const merged = mergePresence(
      {
        ann: [{ presence_state: "away" }, { presence_state: "online" }],
        bob: [{ presence_state: "online" }, { presence_state: "busy" }],
        cat: [{ presence_state: "nonsense" }, { presence_state: "away" }],
      },
      ["ann", "bob", "cat"],
    );
    expect(merged).toEqual({ ann: "online", bob: "busy", cat: "away" });
  });
});
