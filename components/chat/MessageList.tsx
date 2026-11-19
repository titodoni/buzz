"use client";

import { useEffect, useRef } from "react";
import type { ConversationItem } from "@/lib/chat/conversation";
import { MessageBubble } from "./MessageBubble";

export const MSG_NOT_SENT_LINE = "This message was not sent.";

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface MessageListProps {
  items: readonly ConversationItem[];
  myName: string;
  friendName: string;
}

export function MessageList({ items, myName, friendName }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [items]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      style={{ height: "100%", overflowY: "auto", padding: 8, background: "#fff", fontSize: 14 }}
    >
      {items.length === 0 ? (
        <p style={{ textAlign: "center", fontStyle: "italic", color: "#666" }}>
          Say hi to {friendName}!
        </p>
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
        return (
          <div key={item.id} style={{ margin: "4px 0", opacity: item.status === "sending" ? 0.6 : 1 }}>
            <span
              style={{
                fontWeight: 700,
                color: item.mine ? "var(--msg-self)" : "var(--msg-friend)",
              }}
            >
              {item.mine ? myName : friendName}
            </span>{" "}
            <span style={{ color: "#888", fontSize: 11 }}>{hhmm(item.createdAt)}</span>
            <div>
              <MessageBubble body={item.body} />
            </div>
            {failed ? (
              <div role="alert" style={{ color: "var(--buzz-red)", fontSize: 12 }}>
                {MSG_NOT_SENT_LINE}
              </div>
            ) : null}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
