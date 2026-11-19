import { describe, it, expect } from "vitest";
import { conversation, emptyConversation, type MessageRow } from "../conversation";

const ME = "me";
const ANN = "ann";

const msg = (id: string, sender_id: string, created_at: string, body = id): MessageRow => ({
  id,
  sender_id,
  receiver_id: sender_id === ME ? ANN : ME,
  body,
  created_at,
});

describe("conversation", () => {
  it("shows loaded history oldest first", () => {
    const state = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("b", ANN, "2025-01-01T10:05:00Z"), msg("a", ME, "2025-01-01T10:00:00Z")],
    });
    expect(state.items.map((i) => (i.kind === "message" ? [i.id, i.mine] : null))).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("adds an arriving message once, even if Realtime delivers it twice", () => {
    let state = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("a", ME, "2025-01-01T10:00:00Z")],
    });
    const hi = msg("b", ANN, "2025-01-01T10:01:00Z", "hi :)");
    state = conversation(state, { type: "messageArrived", message: hi });
    state = conversation(state, { type: "messageArrived", message: hi });
    expect(state.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  describe("sending (the client picks the message id)", () => {
    const mine = msg("m1", ME, "2025-01-01T10:02:00Z", "hello");
    const started = conversation(emptyConversation(ME), { type: "sendStarted", message: mine });
    const statuses = (s: typeof started) =>
      s.items.map((i) => (i.kind === "message" ? [i.id, i.status] : null));

    it("shows my message at once as sending", () => {
      expect(statuses(started)).toEqual([["m1", "sending"]]);
    });

    it("marks it sent when the insert is confirmed, then ignores the Realtime echo", () => {
      let s = conversation(started, { type: "sendConfirmed", id: "m1" });
      s = conversation(s, { type: "messageArrived", message: mine });
      expect(statuses(s)).toEqual([["m1", "sent"]]);
    });

    it("marks it sent when the Realtime echo comes before the confirmation", () => {
      let s = conversation(started, { type: "messageArrived", message: mine });
      s = conversation(s, { type: "sendConfirmed", id: "m1" });
      expect(statuses(s)).toEqual([["m1", "sent"]]);
    });

    it("marks it failed when the insert fails, so it never looks delivered (Req 9.4)", () => {
      const s = conversation(started, { type: "sendFailed", id: "m1" });
      expect(statuses(s)).toEqual([["m1", "failed"]]);
    });
  });

  it("adds Buzz system lines in time order with the messages (Req 6.2)", () => {
    let s = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("a", ANN, "2025-01-01T10:00:00Z"), msg("c", ANN, "2025-01-01T10:10:00Z")],
    });
    s = conversation(s, { type: "buzzSent", friendName: "Ann", at: "2025-01-01T10:05:00Z" });
    s = conversation(s, { type: "buzzReceived", at: "2025-01-01T10:15:00Z" });
    expect(
      s.items.map((i) => (i.kind === "system" ? `${i.tone}:${i.text}` : i.id)),
    ).toEqual(["a", "info:You nudged Ann", "c", "buzz:BUZZ!!!"]);
  });
});
