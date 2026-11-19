import { nudgeSystemLine } from "../nudge/cooldown";
import { parseFormat, type MessageFormat } from "./format";

/** The message fields the chat window needs (a subset of the `messages` row). */
export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  /** As stored; checked by parseFormat before it is shown (Req 17.4). */
  format?: unknown;
}

/**
 * `sending` until the insert is confirmed or its Realtime echo arrives;
 * `failed` if the insert was rejected (shown as "not sent", Req 9.4).
 */
export type MessageStatus = "sending" | "sent" | "failed";

export interface MessageItem {
  kind: "message";
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
  status: MessageStatus;
  /** Always valid: the default when the row had none or a bad one. */
  format: MessageFormat;
}

/** A centered line that is not a chat message, e.g. Nudge notices. */
export interface SystemItem {
  kind: "system";
  id: string;
  /** `nudge` renders as the red bold "BUZZ!!!" line; `info` as gray italics. */
  tone: "nudge" | "info";
  text: string;
  createdAt: string;
}

/** Text shown when a friend nudges you. */
export const NUDGE_RECEIVED_TEXT = "BUZZ!!!";

export type ConversationItem = MessageItem | SystemItem;

export interface ConversationState {
  me: string;
  items: ConversationItem[];
  /** Counter for unique system line ids. */
  systemCount: number;
  /** True once an earlier page came back short: nothing older is stored. */
  reachedStart: boolean;
  /**
   * When the user last chose Clear Window. A history reload leaves out
   * messages from before it; only F3 brings them back (Req 17.8).
   */
  clearedAt: string | null;
}

/**
 * Events for one chat window. The client generates the id of a message it
 * sends, so the Realtime echo of its own insert carries the same id and is
 * matched to the optimistic item instead of being shown twice.
 */
export type ConversationEvent =
  | { type: "historyLoaded"; messages: readonly MessageRow[] }
  /** A page of older messages (F3); `pageSize` is how many were asked for. */
  | { type: "earlierLoaded"; messages: readonly MessageRow[]; pageSize: number }
  | { type: "messageArrived"; message: MessageRow }
  | { type: "sendStarted"; message: MessageRow }
  | { type: "sendConfirmed"; id: string }
  | { type: "sendFailed"; id: string }
  | { type: "nudgeSent"; friendName: string; at: string }
  | { type: "nudgeReceived"; at: string }
  /** Clear Window: empty the window; stored history is untouched. */
  | { type: "cleared"; at: string };

export function emptyConversation(me: string): ConversationState {
  return { me, items: [], systemCount: 0, reachedStart: false, clearedAt: null };
}

function toItem(me: string, m: MessageRow, status: MessageStatus): MessageItem {
  return {
    kind: "message",
    id: m.id,
    mine: m.sender_id === me,
    body: m.body,
    createdAt: m.created_at,
    status,
    format: parseFormat(m.format),
  };
}

const byTime = (a: ConversationItem, b: ConversationItem) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

function addSystem(
  state: ConversationState,
  tone: SystemItem["tone"],
  text: string,
  at: string,
): ConversationState {
  const n = state.systemCount + 1;
  const item: SystemItem = { kind: "system", id: `system-${n}`, tone, text, createdAt: at };
  return { ...add(state, item), systemCount: n };
}

function setStatus(state: ConversationState, id: string, status: MessageStatus): ConversationState {
  return {
    ...state,
    items: state.items.map((i) => (i.kind === "message" && i.id === id ? { ...i, status } : i)),
  };
}

/** Adds fetched rows as sent, replacing any item with the same id. */
function merge(state: ConversationState, rows: readonly MessageRow[]): ConversationState {
  const fetched = rows.map((m) => toItem(state.me, m, "sent"));
  const fetchedIds = new Set(fetched.map((i) => i.id));
  return {
    ...state,
    items: [...state.items.filter((i) => !fetchedIds.has(i.id)), ...fetched].sort(byTime),
  };
}

function add(state: ConversationState, item: ConversationItem): ConversationState {
  return { ...state, items: [...state.items, item].sort(byTime) };
}

/** Pure reducer for one chat window's conversation. */
export function conversation(state: ConversationState, event: ConversationEvent): ConversationState {
  switch (event.type) {
    case "historyLoaded": {
      // Merge by id rather than replace: a reload (e.g. after a reconnect)
      // must not drop messages still sending or ones that arrived mid-fetch.
      const clearedAt = state.clearedAt === null ? null : Date.parse(state.clearedAt);
      const rows =
        clearedAt === null ? event.messages : event.messages.filter((m) => Date.parse(m.created_at) > clearedAt);
      return merge(state, rows);
    }
    case "earlierLoaded":
      return { ...merge(state, event.messages), reachedStart: event.messages.length < event.pageSize };
    case "messageArrived":
      if (state.items.some((i) => i.id === event.message.id)) return setStatus(state, event.message.id, "sent");
      return add(state, toItem(state.me, event.message, "sent"));
    case "sendStarted":
      if (state.items.some((i) => i.id === event.message.id)) return state;
      return add(state, toItem(state.me, event.message, "sending"));
    case "sendConfirmed":
      return setStatus(state, event.id, "sent");
    case "sendFailed":
      return setStatus(state, event.id, "failed");
    case "nudgeSent":
      return addSystem(state, "info", nudgeSystemLine(event.friendName), event.at);
    case "nudgeReceived":
      return addSystem(state, "nudge", NUDGE_RECEIVED_TEXT, event.at);
    case "cleared":
      return { ...state, items: [], clearedAt: event.at, reachedStart: false };
  }
}

/**
 * Where F3 pages back from: the oldest message on screen, else the moment
 * the window was cleared, else null (the newest messages).
 */
export function earlierCursor(state: ConversationState): string | null {
  const oldest = state.items.find((i) => i.kind === "message");
  return oldest ? oldest.createdAt : state.clearedAt;
}
