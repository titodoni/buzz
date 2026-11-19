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
          style={{ objectFit: "cover", border: "1px solid #999" }}
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
            color: "#fff",
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

  const reload = useCallback(() => {
    return loadHistory(me, friendId)
      .then((rows) => {
        dispatch({ type: "historyLoaded", messages: rows });
        setLoadError(false);
        return markConversationRead(me, friendId);
      })
      .catch(() => setLoadError(true));
  }, [me, friendId]);

  useEffect(() => {
    let active = true;
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

  const onMessage = useCallback(
    (message: MessageRow) => {
      dispatch({ type: "messageArrived", message });
      setFriendTyping((s) => typingOnSend(s));
      // The window is open, so the message counts as read right away.
      markConversationRead(me, friendId).catch(() => undefined);
    },
    [me, friendId],
  );

  const onTyping = useCallback((at: number) => {
    setFriendTyping({ lastKeystrokeAt: at, sent: false });
  }, []);

  const onBuzz = useCallback(() => {
    dispatch({ type: "buzzReceived", at: new Date().toISOString() });
    playBuzzSound();
    void shakeChatWindow(rootRef.current);
  }, []);

  const { sendTyping, sendBuzz } = useChatChannel({
    me,
    friendId,
    onMessage,
    onTyping,
    onBuzz,
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
      void sendMessage(row, presenceRef.current !== "offline").then((res) => {
        dispatch(res.ok ? { type: "sendConfirmed", id: row.id } : { type: "sendFailed", id: row.id });
      });
    },
    [me, friendId],
  );

  const handleBuzz = useCallback(async () => {
    const ok = await sendBuzz();
    if (ok) dispatch({ type: "buzzSent", friendName, at: new Date().toISOString() });
    return ok;
  }, [sendBuzz, friendName]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    inputRef.current?.focus();
  }, []);

  return (
    <WindowFrame title={`${friendName} - Instant Message`}>
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ece9f5" }}>
        <header
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderBottom: "1px solid #ccc" }}
        >
          <PresenceDot state={presence} />
          <strong>{friendName}</strong>
          <span style={{ fontSize: 12, color: "#555" }}>
            {friend?.statusMessage ? `"${friend.statusMessage}"` : presenceLabel(presence)}
          </span>
        </header>
        {loadError ? (
          <p role="alert" style={{ color: "#cc0000", fontSize: 12, margin: "4px 8px" }}>
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
              <NudgeButton friendPresence={presence} onBuzz={handleBuzz} />
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
          <aside style={{ width: 88, padding: 8, borderLeft: "1px solid #ccc" }} aria-label="Pictures">
            <Avatar name={friendName} url={friend?.avatarUrl ?? null} />
            <Avatar name={myName} url={mine?.avatarUrl ?? null} />
          </aside>
        </div>
      </div>
    </WindowFrame>
  );
}

export default ChatWindow;
