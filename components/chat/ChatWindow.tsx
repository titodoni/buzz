"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { PresenceDot, presenceLabel } from "@/components/PresenceDot";
import { NudgeButton } from "@/components/chat/NudgeButton";
import { EmoticonPicker } from "./EmoticonPicker";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { conversation, emptyConversation, type MessageRow } from "@/lib/chat/conversation";
import { loadHistory, markConversationRead, sendMessage } from "@/lib/chat/api";
import { useChatChannel } from "@/lib/realtime/chat";
import { useFriendPresence } from "@/lib/realtime/presence";
import { playBuzzSound, shakeChatWindow } from "@/lib/nudge/effects";
import { getProfile, type PublicProfile } from "@/lib/friends/api";
import { onSend as typingOnSend, type TypingState } from "@/lib/typing/state";
import { receiveTypingSignal, type TypingSignal } from "@/lib/typing/broadcast";
import { reportActivity } from "@/lib/realtime/activity";
import { sendNudgeToInbox } from "@/lib/realtime/inbox";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar in a static export
        <img
          src={url}
          alt={`${name}'s picture`}
          width={64}
          height={64}
          style={{ objectFit: "cover", border: "1px solid var(--border)" }}
        />
      ) : (
        <div
          role="img"
          aria-label={`${name}'s picture`}
          style={{
            width: 64,
            height: 64,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--ym-purple)",
            color: "var(--titlebar-text)",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </div>
      )}
      <div style={{ fontSize: 11, overflowWrap: "anywhere" }}>{name}</div>
    </div>
  );
}

export interface ChatWindowProps {
  me: string;
  friendId: string;
}

export function ChatWindow({ me, friendId }: ChatWindowProps) {
  const [state, dispatch] = useReducer(conversation, me, emptyConversation);
  const [friend, setFriend] = useState<PublicProfile | null>(null);
  const [mine, setMine] = useState<PublicProfile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [friendTyping, setFriendTyping] = useState<TypingState>({ lastKeystrokeAt: null, sent: false });
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<MessageInputHandle>(null);

  const friendName = friend?.displayName ?? "Your friend";
  const myName = mine?.displayName ?? "Me";
  const presence = useFriendPresence(friendId);
  const presenceRef = useRef(presence);
  useEffect(() => {
    presenceRef.current = presence;
  });

  const receiveBuzz = useCallback(() => {
    dispatch({ type: "buzzReceived", at: new Date().toISOString() });
    playBuzzSound();
    void shakeChatWindow(rootRef.current);
  }, []);

  // A window opened by an incoming Nudge has `buzz=1` in its URL (chatUrl).
  const pendingBuzzRef = useRef(false);

  // Read receipts count only while the user can actually see this window (Req 9.3).
  const markReadIfActive = useCallback(() => {
    if (document.hasFocus() && document.visibilityState === "visible") {
      markConversationRead(me, friendId).catch(() => undefined);
    }
  }, [me, friendId]);

  const reload = useCallback(() => {
    return loadHistory(me, friendId)
      .then((rows) => {
        dispatch({ type: "historyLoaded", messages: rows });
        setLoadError(false);
        markReadIfActive();
      })
      .catch(() => setLoadError(true))
      .then(() => {
        if (!pendingBuzzRef.current) return;
        pendingBuzzRef.current = false;
        receiveBuzz();
        // Drop `buzz` so a reload does not shake again.
        const url = new URL(window.location.href);
        url.searchParams.delete("buzz");
        window.history.replaceState(window.history.state, "", url);
      });
  }, [me, friendId, markReadIfActive, receiveBuzz]);

  useEffect(() => {
    let active = true;
    pendingBuzzRef.current = new URLSearchParams(window.location.search).get("buzz") === "1";
    getProfile(friendId)
      .then((p) => active && setFriend(p))
      .catch(() => undefined);
    getProfile(me)
      .then((p) => active && setMine(p))
      .catch(() => undefined);
    void reload();
    return () => {
      active = false;
    };
  }, [me, friendId, reload]);

  // Unread messages stay unread until the window is focused and visible again.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") markReadIfActive();
    };
    window.addEventListener("focus", markReadIfActive);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", markReadIfActive);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [markReadIfActive]);

  // Chatting counts as activity for the Buddy List's presence (Req 4.1, 4.2).
  useEffect(() => {
    const report = () => reportActivity();
    const events = ["keydown", "mousedown", "focus"] as const;
    for (const e of events) window.addEventListener(e, report);
    return () => {
      for (const e of events) window.removeEventListener(e, report);
    };
  }, []);

  const onMessage = useCallback(
    (message: MessageRow) => {
      dispatch({ type: "messageArrived", message });
      if (message.sender_id !== friendId) return; // my own send, seen from another instance
      setFriendTyping((s) => typingOnSend(s));
      markReadIfActive();
    },
    [friendId, markReadIfActive],
  );

  const onTyping = useCallback((signal: TypingSignal, at: number) => {
    setFriendTyping((s) => receiveTypingSignal(s, signal, at));
  }, []);

  const { sendTyping, sendBuzz } = useChatChannel({
    me,
    friendId,
    onMessage,
    onTyping,
    onBuzz: receiveBuzz,
    onReconnect: () => void reload(),
  });

  const handleSend = useCallback(
    (body: string) => {
      const row: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: me,
        receiver_id: friendId,
        body,
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "sendStarted", message: row });
      return sendMessage(row, presenceRef.current !== "offline").then((res) => {
        dispatch(res.ok ? { type: "sendConfirmed", id: row.id } : { type: "sendFailed", id: row.id });
        return res.ok;
      });
    },
    [me, friendId],
  );

  const handleBuzz = useCallback(async () => {
    // Chat channel reaches an open window; the inbox opens a closed one. Either is delivery.
    const results = await Promise.all([sendBuzz(), sendNudgeToInbox(friendId, me)]);
    const ok = results.some(Boolean);
    if (ok) dispatch({ type: "buzzSent", friendName, at: new Date().toISOString() });
    return ok;
  }, [sendBuzz, friendId, me, friendName]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    inputRef.current?.focus();
  }, []);

  return (
    <WindowFrame title={`${friendName} - Instant Message`}>
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--window-bg)" }}>
        <header
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}
        >
          <PresenceDot state={presence} />
          <strong>{friendName}</strong>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {friend?.statusMessage ? `"${friend.statusMessage}"` : presenceLabel(presence)}
          </span>
        </header>
        {loadError ? (
          <p role="alert" style={{ color: "var(--buzz-red)", fontSize: 12, margin: "4px 8px" }}>
            Couldn&apos;t load your earlier messages. We&apos;ll try again when you&apos;re back online.
          </p>
        ) : null}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MessageList items={state.items} myName={myName} friendName={friendName} />
            </div>
            <TypingIndicator friendName={friendName} typing={friendTyping} />
            <div style={{ position: "relative", display: "flex", gap: 6, padding: "2px 6px" }}>
              <button
                type="button"
                className="ym-button"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}
              >
                Emoticons
              </button>
              <NudgeButton friendId={friendId} friendPresence={presence} onBuzz={handleBuzz} />
              {pickerOpen ? (
                <EmoticonPicker
                  onPick={(code) => {
                    inputRef.current?.insertShortcode(code);
                    setPickerOpen(false);
                  }}
                  onClose={closePicker}
                />
              ) : null}
            </div>
            <MessageInput ref={inputRef} onSend={handleSend} onTyping={sendTyping} />
          </div>
          <aside style={{ width: 88, padding: 8, borderLeft: "1px solid var(--border)" }} aria-label="Pictures">
            <Avatar name={friendName} url={friend?.avatarUrl ?? null} />
            <Avatar name={myName} url={mine?.avatarUrl ?? null} />
          </aside>
        </div>
      </div>
    </WindowFrame>
  );
}

export default ChatWindow;
