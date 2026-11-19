import { describe, it, expect } from "vitest";
import { conversation, earlierCursor, emptyConversation, type MessageRow } from "../conversation";

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

  it("a history reload keeps messages it doesn't know about yet and never duplicates", () => {
    let s = conversation(emptyConversation(ME), { type: "historyLoaded", messages: [] });
    const sending = msg("p", ME, "2025-01-01T10:03:00Z", "still sending");
    const arrived = msg("q", ANN, "2025-01-01T10:04:00Z", "arrived during the fetch");
    s = conversation(s, { type: "sendStarted", message: sending });
    s = conversation(s, { type: "messageArrived", message: arrived });
    // The reload was fetched before "q" existed but after "p" was stored.
    s = conversation(s, {
      type: "historyLoaded",
      messages: [msg("a", ANN, "2025-01-01T10:00:00Z"), sending],
    });
    expect(s.items.map((i) => (i.kind === "message" ? [i.id, i.status] : null))).toEqual([
      ["a", "sent"],
      ["p", "sent"],
      ["q", "sent"],
    ]);
  });

  it("adds Nudge system lines in time order with the messages (Req 6.2)", () => {
    let s = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("a", ANN, "2025-01-01T10:00:00Z"), msg("c", ANN, "2025-01-01T10:10:00Z")],
    });
    s = conversation(s, { type: "nudgeSent", friendName: "Ann", at: "2025-01-01T10:05:00Z" });
    s = conversation(s, { type: "nudgeReceived", at: "2025-01-01T10:15:00Z" });
    expect(
      s.items.map((i) => (i.kind === "system" ? `${i.tone}:${i.text}` : i.id)),
    ).toEqual(["a", "info:You nudged Ann", "c", "nudge:BUZZ!!!"]);
  });

  describe("earlier messages (F3, Req 17.6)", () => {
    const shown = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("c", ANN, "2025-01-01T10:10:00Z"), msg("d", ME, "2025-01-01T10:20:00Z")],
    });

    it("puts the earlier page before what is on screen, once each, in time order", () => {
      const s = conversation(shown, {
        type: "earlierLoaded",
        // Newest first, as the query returns them, and overlapping the oldest one on screen.
        messages: [msg("c", ANN, "2025-01-01T10:10:00Z"), msg("b", ME, "2025-01-01T10:05:00Z"), msg("a", ANN, "2025-01-01T10:00:00Z")],
        pageSize: 50,
      });
      expect(s.items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("knows it reached the start of the conversation when a page comes back short", () => {
      expect(shown.reachedStart).toBe(false);
      const full = Array.from({ length: 3 }, (_, n) => msg(`e${n}`, ANN, `2025-01-01T09:0${n}:00Z`));
      expect(conversation(shown, { type: "earlierLoaded", messages: full, pageSize: 3 }).reachedStart).toBe(false);
      const short = conversation(shown, { type: "earlierLoaded", messages: full.slice(0, 2), pageSize: 3 });
      expect(short.reachedStart).toBe(true);
      expect(conversation(shown, { type: "earlierLoaded", messages: [], pageSize: 3 }).reachedStart).toBe(true);
    });

    it("pages back from the oldest message on screen, ignoring system lines", () => {
      expect(earlierCursor(emptyConversation(ME))).toBeNull(); // nothing shown: start from now
      const withLine = conversation(shown, { type: "nudgeReceived", at: "2025-01-01T09:00:00Z" });
      expect(earlierCursor(withLine)).toBe("2025-01-01T10:10:00Z");
    });
  });

  describe("Clear Window (Req 17.8)", () => {
    const shown = conversation(emptyConversation(ME), {
      type: "historyLoaded",
      messages: [msg("a", ANN, "2025-01-01T10:00:00Z"), msg("b", ME, "2025-01-01T10:05:00Z")],
    });
    const cleared = conversation(shown, { type: "cleared", at: "2025-01-01T10:06:00Z" });

    it("empties the window", () => {
      expect(cleared.items).toEqual([]);
    });

    it("keeps cleared messages out when history reloads, but shows new ones", () => {
      const s = conversation(cleared, {
        type: "historyLoaded",
        messages: [msg("a", ANN, "2025-01-01T10:00:00Z"), msg("b", ME, "2025-01-01T10:05:00Z"), msg("c", ANN, "2025-01-01T10:07:00Z")],
      });
      expect(s.items.map((i) => i.id)).toEqual(["c"]);
    });

    it("still lets F3 bring the stored messages back, starting from the clear", () => {
      expect(earlierCursor(cleared)).toBe("2025-01-01T10:06:00Z");
      const s = conversation(cleared, {
        type: "earlierLoaded",
        messages: [msg("b", ME, "2025-01-01T10:05:00Z"), msg("a", ANN, "2025-01-01T10:00:00Z")],
        pageSize: 50,
      });
      expect(s.items.map((i) => i.id)).toEqual(["a", "b"]);
    });
  });
});
