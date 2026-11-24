import { describe, it, expect } from "vitest";
import { mergeFriendTopics, stateOfTopic } from "../presenceMerge";

describe("stateOfTopic", () => {
  it("reads an empty or missing topic as offline", () => {
    expect(stateOfTopic(undefined)).toBe("offline");
    expect(stateOfTopic({})).toBe("offline");
  });

  it("reports the state tracked on the topic", () => {
    expect(stateOfTopic({ ann: [{ presence_state: "busy" }] })).toBe("busy");
  });

  it("uses every entry on the topic, whatever its presence key", () => {
    // Only the topic's owner can track there, so the key carries no meaning.
    expect(stateOfTopic({ "some-other-key": [{ presence_state: "online" }] })).toBe("online");
  });

  it("with several entries, busy wins, then online, then away; junk is ignored", () => {
    expect(stateOfTopic({ a: [{ presence_state: "away" }], b: [{ presence_state: "online" }] })).toBe("online");
    expect(stateOfTopic({ a: [{ presence_state: "online" }, { presence_state: "busy" }] })).toBe("busy");
    expect(stateOfTopic({ a: [{ presence_state: "nonsense" }, { presence_state: "away" }] })).toBe("away");
    expect(stateOfTopic({ a: [{ presence_state: "nonsense" }] })).toBe("offline");
  });
});

describe("mergeFriendTopics", () => {
  it("gives each friend the state of their own topic and nobody else's", () => {
    const topics = {
      ann: { ann: [{ presence_state: "busy" as const }] },
      bob: { bob: [{ presence_state: "away" as const }] },
    };
    expect(mergeFriendTopics(topics, ["ann", "bob", "cat"])).toEqual({ ann: "busy", bob: "away", cat: "offline" });
  });

  it("ignores topics of people who are not in the friend list", () => {
    expect(mergeFriendTopics({ eve: { eve: [{ presence_state: "online" }] } }, ["ann"])).toEqual({ ann: "offline" });
  });
});
