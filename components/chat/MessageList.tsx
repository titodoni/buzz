"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ConversationItem } from "@/lib/chat/conversation";
import { DEFAULT_FORMAT, formatToStyle } from "@/lib/chat/format";
import { MessageBubble } from "./MessageBubble";

export const MSG_NOT_SENT_LINE = "This message was not sent.";
export const START_OF_CONVERSATION = "This is the start of your conversation.";

export function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DEFAULT_STYLE = formatToStyle(DEFAULT_FORMAT);

export interface MessageListProps {
  items: readonly ConversationItem[];
  myName: string;
  friendName: string;
  /** View > Show Timestamps (Req 17.5). */
  showTimestamps: boolean;
  /** View > Show Friends' Fonts (Req 17.3); my own messages always keep mine. */
  showFriendsFonts: boolean;
  /** F3 found nothing older. */
  reachedStart: boolean;
  /** A gray line after the last message, e.g. that the friend is offline (Req 17.9). */
  footerLine?: string | null;
  /** The scrolling log, for Edit > Select All. */
  logRef?: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  items,
  myName,
  friendName,
  showTimestamps,
  showFriendsFonts,
  reachedStart,
  footerLine,
  logRef,
}: MessageListProps) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = logRef ?? ownRef;
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);
  const firstIdRef = useRef<string | null>(null);
  const heightRef = useRef(0);

  // After every render: a new newest item scrolls to the end; older items
  // added above (F3) keep the reader where they were; anything else (a
  // status change, a View toggle) leaves the scroll alone. The height is
  // measured every time so it is never stale.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const lastId = items.length > 0 ? items[items.length - 1].id : null;
    const firstId = items.length > 0 ? items[0].id : null;
    if (lastId !== lastIdRef.current) {
      endRef.current?.scrollIntoView?.({ block: "end" });
    } else if (el && firstId !== firstIdRef.current) {
      el.scrollTop += el.scrollHeight - heightRef.current;
    }
    lastIdRef.current = lastId;
    firstIdRef.current = firstId;
    heightRef.current = el?.scrollHeight ?? 0;
  });

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      style={{ height: "100%", overflowY: "auto", padding: 8, background: "#fff", fontSize: 14 }}
    >
      {reachedStart ? (
        <p style={{ textAlign: "center", fontSize: 11, color: "#666", margin: "0 0 6px" }}>{START_OF_CONVERSATION}</p>
      ) : null}
      {items.length === 0 && !reachedStart ? (
        <p style={{ textAlign: "center", fontStyle: "italic", color: "#666" }}>Say hi to {friendName}!</p>
      ) : null}
      {items.map((item) => {
        if (item.kind === "system") {
          const nudge = item.tone === "nudge";
          return (
            <p
              key={item.id}
              style={{
                textAlign: "center",
                fontStyle: "italic",
                margin: "6px 0",
                color: nudge ? "var(--buzz-red)" : "#666",
                fontWeight: nudge ? 700 : 400,
                textTransform: nudge ? "uppercase" : "none",
              }}
            >
              {item.text}
            </p>
          );
        }
        const failed = item.status === "failed";
        const style = item.mine || showFriendsFonts ? formatToStyle(item.format) : DEFAULT_STYLE;
        return (
          <div key={item.id} style={{ margin: "4px 0", opacity: item.status === "sending" ? 0.6 : 1 }}>
            <span
              style={{
                fontWeight: 700,
                color: item.mine ? "var(--msg-self)" : "var(--msg-friend)",
              }}
            >
              {item.mine ? myName : friendName}
            </span>
            {showTimestamps ? (
              <>
                {" "}
                <span style={{ color: "#888", fontSize: 11 }}>{hhmm(item.createdAt)}</span>
              </>
            ) : null}
            <div>
              {item.unreadable ? (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{item.body}</span>
              ) : (
                <MessageBubble body={item.body} style={style} />
              )}
            </div>
            {failed ? (
              <div role="alert" style={{ color: "var(--buzz-red)", fontSize: 12 }}>
                {MSG_NOT_SENT_LINE}
              </div>
            ) : null}
          </div>
        );
      })}
      {footerLine ? (
        <p role="status" style={{ fontSize: 12, color: "#666", margin: "6px 0 0" }}>
          {footerLine}
        </p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
