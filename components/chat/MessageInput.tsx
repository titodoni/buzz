"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { isValidMessageBody, MESSAGE_BODY_MAX } from "@/lib/validation/profile";
import { onKeystroke, type TypingState } from "@/lib/typing/state";
import { shouldBroadcastTyping } from "@/lib/typing/broadcast";
import { insertAtCursor } from "@/lib/emoticons/shortcode";

export interface MessageInputHandle {
  /** Insert a shortcode at the cursor and refocus the box. */
  insertShortcode: (shortcode: string) => void;
  focus: () => void;
}

export interface MessageInputProps {
  /** Resolves true when the message was saved. */
  onSend: (body: string) => Promise<boolean>;
  /** Typing broadcast; `stopped: true` is sent once right after a message. */
  onTyping: (stopped: boolean) => void;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput(
  { onSend, onTyping },
  ref,
) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<TypingState>({ lastKeystrokeAt: null, sent: false });
  const lastBroadcastRef = useRef<number | null>(null);

  function keystroke() {
    const now = Date.now();
    typingRef.current = onKeystroke(typingRef.current, now);
    if (shouldBroadcastTyping(lastBroadcastRef.current, now)) {
      lastBroadcastRef.current = now;
      onTyping(false);
    }
  }

  function change(next: string) {
    setText(next);
    setError(null);
    if (next.length > 0) keystroke();
  }

  useImperativeHandle(ref, () => ({
    focus: () => areaRef.current?.focus(),
    insertShortcode: (shortcode) => {
      const el = areaRef.current;
      const pos = el?.selectionStart ?? text.length;
      const res = insertAtCursor(text, pos, shortcode);
      change(res.text);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(res.pos, res.pos);
      });
    },
  }));

  function submit() {
    if (!isValidMessageBody(text)) {
      setError(
        text.length > MESSAGE_BODY_MAX
          ? `That message is too long. The limit is ${MESSAGE_BODY_MAX} characters.`
          : "Type a message first.",
      );
      return;
    }
    const announcedTyping = lastBroadcastRef.current !== null;
    void onSend(text).then((ok) => {
      // Clear the friend's indicator right away instead of waiting for it to time out.
      if (ok && announcedTyping) onTyping(true);
    });
    setText("");
    setError(null);
    lastBroadcastRef.current = null;
    typingRef.current = { lastKeystrokeAt: null, sent: false };
  }

  return (
    <div style={{ padding: 6 }}>
      <textarea
        className="ym-message-box"
        ref={areaRef}
        value={text}
        aria-label="Type a message"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "message-error" : undefined}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        style={{ width: "100%", boxSizing: "border-box", resize: "none", fontSize: 14, padding: 4 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span
          id="message-error"
          role="alert"
          style={{ color: "var(--buzz-red)", fontSize: 12, minHeight: 16 }}
        >
          {error ?? ""}
        </span>
        <span
          style={{ fontSize: 11, color: text.length > MESSAGE_BODY_MAX ? "var(--buzz-red)" : "var(--text-muted)" }}
          aria-label="Characters used"
        >
          {text.length}/{MESSAGE_BODY_MAX}
        </span>
        <button type="button" className="ym-button" onClick={submit}>
          Send
        </button>
      </div>
    </div>
  );
});

export default MessageInput;
