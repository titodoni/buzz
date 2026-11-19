"use client";

import { useEffect, useState } from "react";
import { shouldShowTyping, typingLine, TYPING_IDLE_MS, type TypingState } from "@/lib/typing/state";

export interface TypingIndicatorProps {
  friendName: string;
  /** The friend's typing state; `sent: true` once their message arrived. */
  typing: TypingState;
}

/** "<name> is typing..." while the friend's last typing broadcast is fresh. */
export function TypingIndicator({ friendName, typing }: TypingIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typing.lastKeystrokeAt == null || typing.sent) return;
    const remaining = typing.lastKeystrokeAt + TYPING_IDLE_MS - Date.now();
    // Re-evaluate once the idle window ends; no polling.
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, remaining) + 20);
    return () => clearTimeout(id);
  }, [typing]);

  const visible = shouldShowTyping(typing, Math.max(now, typing.lastKeystrokeAt ?? 0));
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: 18, fontSize: 12, fontStyle: "italic", color: "#555", padding: "0 8px" }}
    >
      {visible ? typingLine(friendName) : ""}
    </div>
  );
}

export default TypingIndicator;
