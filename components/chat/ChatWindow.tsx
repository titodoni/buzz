"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { PresenceDot, presenceLabel } from "@/components/PresenceDot";
import { NudgeButton } from "@/components/chat/NudgeButton";
import { EmoticonPicker } from "./EmoticonPicker";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { MessageList } from "./MessageList";
import { Avatar, ChatLayout } from "./ChatLayout";
import { TypingIndicator } from "./TypingIndicator";
import { conversation, emptyConversation, type MessageRow } from "@/lib/chat/conversation";
import { loadHistory, markConversationRead, sendMessage } from "@/lib/chat/api";
import { useChatChannel } from "@/lib/realtime/chat";
import { useFriendPresence } from "@/lib/realtime/presence";
import { isIgnoredByMe, useIgnorers } from "@/lib/friends/ignore";
import { playNudgeSound, shakeChatWindow } from "@/lib/nudge/effects";
import { getProfile, type PublicProfile } from "@/lib/friends/api";
import { onSend as typingOnSend, type TypingState } from "@/lib/typing/state";
import { receiveTypingSignal, type TypingSignal } from "@/lib/typing/broadcast";
import { reportActivity } from "@/lib/realtime/activity";
import { sendNudgeToInbox } from "@/lib/realtime/inbox";
import { clearAttention } from "@/lib/tauri/windows";

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
  const livePresence = useFriendPresence(friendId);
  // A friend who ignores me looks Offline (Req 15.5); then the Nudge button is off too.
  const ignorers = useIgnorers(me);
  const presence = ignorers.has(friendId) ? "offline" : livePresence;
  // Buzz! and typing from someone I ignore are dropped here too (Req 15.3); the server blocks them first.
  const ignoredRef = useRef(false);
  // Resolves once the first check is done, so a window opened by a Buzz! can
  // wait for it before shaking.
  const ignoreCheckedRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    const check = () => {
      const done = isIgnoredByMe(me, friendId).then((v) => {
        if (active) ignoredRef.current = v;
      });
      ignoreCheckedRef.current = done;
    };
    check();
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  }, [me, friendId]);
  // Looking at the window stops its taskbar flash (Req 16.3).
  useEffect(() => {
    const stop = () => void clearAttention().catch(() => undefined);
    // A window opened behind the others for an incoming message keeps its flash.
    if (document.hasFocus()) stop();
    window.addEventListener("focus", stop);
    return () => window.removeEventListener("focus", stop);
  }, []);
  const presenceRef = useRef(presence);
  useEffect(() => {
    presenceRef.current = presence;
  });

  const receiveNudge = useCallback(() => {
    if (ignoredRef.current) return;
    dispatch({ type: "nudgeReceived", at: new Date().toISOString() });
    playNudgeSound();
    void shakeChatWindow(rootRef.current);
  }, []);

  // A window opened by an incoming Nudge has `nudge=1` in its URL (chatUrl).
  const pendingNudgeRef = useRef(false);

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
      .then(async () => {
        if (!pendingNudgeRef.current) return;
        pendingNudgeRef.current = false;
        await ignoreCheckedRef.current;
        receiveNudge();
        // Drop `nudge` so a reload does not shake again.
        const url = new URL(window.location.href);
        url.searchParams.delete("nudge");
        window.history.replaceState(window.history.state, "", url);
      });
  }, [me, friendId, markReadIfActive, receiveNudge]);

  useEffect(() => {
    let active = true;
    pendingNudgeRef.current = new URLSearchParams(window.location.search).get("nudge") === "1";
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
    if (ignoredRef.current) return;
    setFriendTyping((s) => receiveTypingSignal(s, signal, at));
  }, []);

  const { sendTyping, sendNudge } = useChatChannel({
    me,
    friendId,
    onMessage,
    onTyping,
    onNudge: receiveNudge,
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

  const handleNudge = useCallback(async () => {
    // Chat channel reaches an open window; the inbox opens a closed one. Either is delivery.
    const results = await Promise.all([sendNudge(), sendNudgeToInbox(me, friendId)]);
    const ok = results.some(Boolean);
    if (ok) dispatch({ type: "nudgeSent", friendName, at: new Date().toISOString() });
    return ok;
  }, [sendNudge, friendId, me, friendName]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    inputRef.current?.focus();
  }, []);

  return (
    <WindowFrame title={`${friendName} - Instant Message`} icon={<PresenceDot state={presence} size={14} />}>
      <ChatLayout
        rootRef={rootRef}
        header={
          <>
            <PresenceDot state={presence} />
            <strong className="ym-truncate">{friendName}</strong>
            <span className="ym-truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {friend?.statusMessage ? `"${friend.statusMessage}"` : presenceLabel(presence)}
            </span>
          </>
        }
        notice={
          loadError ? (
            <p role="alert" style={{ color: "var(--buzz-red)", fontSize: 12, margin: "4px 8px" }}>
              Couldn&apos;t load your earlier messages. We&apos;ll try again when you&apos;re back online.
            </p>
          ) : null
        }
        list={<MessageList items={state.items} myName={myName} friendName={friendName} />}
        typing={<TypingIndicator friendName={friendName} typing={friendTyping} />}
        toolbar={
          <>
            <button
              type="button"
              className="ym-button"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}
            >
              Emoticons
            </button>
            <NudgeButton friendId={friendId} friendPresence={presence} onNudge={handleNudge} />
            {pickerOpen ? (
              <EmoticonPicker
                onPick={(code) => {
                  inputRef.current?.insertShortcode(code);
                  setPickerOpen(false);
                }}
                onClose={closePicker}
              />
            ) : null}
          </>
        }
        input={<MessageInput ref={inputRef} onSend={handleSend} onTyping={sendTyping} />}
        pictures={
          <>
            <Avatar name={friendName} url={friend?.avatarUrl ?? null} />
            <Avatar name={myName} url={mine?.avatarUrl ?? null} />
          </>
        }
      />
    </WindowFrame>
  );
}
export default ChatWindow;
