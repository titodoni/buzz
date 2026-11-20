"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { PresenceDot, presenceLabel } from "@/components/PresenceDot";
import { NudgeButton, type NudgeButtonHandle } from "@/components/chat/NudgeButton";
import { AboutDialog } from "@/components/AboutDialog";
import { Dialog } from "@/components/Dialog";
import { MenuBar, type MenuDef } from "@/components/friends/MenuBar";
import { EmoticonPicker } from "./EmoticonPicker";
import { FormatBar } from "./FormatBar";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { hhmm, MessageList } from "./MessageList";
import { Avatar, ChatLayout } from "./ChatLayout";
import { TypingIndicator } from "./TypingIndicator";
import { conversation, earlierCursor, emptyConversation, type MessageRow } from "@/lib/chat/conversation";
import { EARLIER_PAGE_SIZE, loadEarlier, loadHistory, markConversationRead, sendEncryptedMessage, trustFriendKey } from "@/lib/chat/api";
import { SafetyNumber } from "./SafetyNumber";
import { readWireRow, readWireRows, type ReadKey, type WireRow } from "@/lib/chat/wire";
import { useMyKeys } from "@/lib/crypto/useMyKeys";
import { conversationText, copyText } from "@/lib/chat/copy";
import { useChatView } from "@/lib/chat/useChatView";
import { hasNowPlaying, shouldShowField, shownNowPlaying } from "@/lib/profile/render";
import { useChatChannel } from "@/lib/realtime/chat";
import { useFriendPresence } from "@/lib/realtime/presence";
import { ignoreUser, isIgnoredByMe, unignoreUser, useIgnorers } from "@/lib/friends/ignore";
import { playNudgeSound, shakeChatWindow } from "@/lib/nudge/effects";
import { getProfile, type PublicProfile } from "@/lib/friends/api";
import { useProfileUpdates } from "@/lib/friends/profileFeed";
import { mergeOne, type ProfileFields } from "@/lib/friends/profileMerge";
import { onSend as typingOnSend, type TypingState } from "@/lib/typing/state";
import { receiveTypingSignal, type TypingSignal } from "@/lib/typing/broadcast";
import { reportActivity } from "@/lib/realtime/activity";
import { sendNudgeToInbox } from "@/lib/realtime/inbox";
import { clearAttention, closeWindow } from "@/lib/tauri/windows";

/** Req 17.9 */
export function offlineLine(friendName: string): string {
  return `${friendName} is offline. Your messages will be waiting when they sign in.`;
}

type ChatDialogKind = "profile" | "ignore" | "about";

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
  const nudgeRef = useRef<NudgeButtonHandle>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const { view, update: updateView } = useChatView();
  const [dialog, setDialog] = useState<ChatDialogKind | null>(null);
  /** A short note under the header, e.g. "Copied." or a failure. */
  const [note, setNote] = useState<string | null>(null);
  const [ignored, setIgnored] = useState(false);
  // True after a send was stopped because the friend's key changed (ADR 0010, E3.1).
  const [keyChanged, setKeyChanged] = useState(false);
  const loadingEarlierRef = useRef(false);
  // The Buddy List window makes my encryption key; this window only reads it (ADR 0010).
  const myKeys = useMyKeys(me, "reader");
  const keysLoading = myKeys.status === "loading";
  const readKey: ReadKey = myKeys.status === "ready" ? { id: me, privateKey: myKeys.keys.privateKey } : null;
  const readKeyRef = useRef<ReadKey>(readKey);
  const sendKeys = myKeys.status === "ready" ? myKeys.keys : myKeys.status === "unavailable" ? ("unavailable" as const) : null;
  const keysRef = useRef(sendKeys);
  useEffect(() => {
    readKeyRef.current = readKey;
    keysRef.current = sendKeys;
  });

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
        if (!active) return;
        ignoredRef.current = v;
        setIgnored(v);
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
  const formatRef = useRef(view.myFormat);
  useEffect(() => {
    presenceRef.current = presence;
    formatRef.current = view.myFormat;
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
      .then((rows) => readWireRows(rows, readKeyRef.current))
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
    // History is read once the key is known, so Encrypted Messages show as text.
    if (!keysLoading) void reload();
    return () => {
      active = false;
    };
  }, [me, friendId, reload, keysLoading]);

  // The friend's new Status or Now Playing reaches the header without a reload (buzz-trigger R0).
  const friendIds = useMemo(() => [friendId], [friendId]);
  const onFriendProfile = useCallback((p: ProfileFields) => setFriend((cur) => mergeOne(cur, p)), []);
  useProfileUpdates(`profiles:chat:${me}:${friendId}`, friendIds, onFriendProfile);

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
    (wire: WireRow) => {
      void readWireRow(wire, readKeyRef.current).then((message) => {
        dispatch({ type: "messageArrived", message });
        if (message.sender_id !== friendId) return; // my own send, seen from another instance
        setFriendTyping((s) => typingOnSend(s));
        markReadIfActive();
      });
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
        format: formatRef.current,
      };
      dispatch({ type: "sendStarted", message: row });
      // Encrypts on this device first; the text never goes to the database (ADR 0010).
      return sendEncryptedMessage({
        me,
        friendId,
        friendName,
        body,
        format: formatRef.current,
        id: row.id,
        delivered: presenceRef.current !== "offline",
        keys: keysRef.current,
      }).then((res) => {
        dispatch(res.ok ? { type: "sendConfirmed", id: row.id } : { type: "sendFailed", id: row.id });
        setNote(res.ok ? null : res.message);
        setKeyChanged(!res.ok && res.reason === "changed");
        return res.ok;
      });
    },
    [me, friendId, friendName],
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

  // View > Show Earlier Messages and F3 (Req 17.6).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const showEarlier = useCallback(() => {
    const s = stateRef.current;
    if (loadingEarlierRef.current || s.reachedStart) return;
    loadingEarlierRef.current = true;
    loadEarlier(me, friendId, earlierCursor(s))
      .then((rows) => readWireRows(rows, readKeyRef.current))
      .then((rows) => {
        dispatch({ type: "earlierLoaded", messages: rows, pageSize: EARLIER_PAGE_SIZE });
        setNote(null);
      })
      .catch(() => setNote("Couldn't load earlier messages. Try again."))
      .finally(() => {
        loadingEarlierRef.current = false;
      });
  }, [me, friendId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        showEarlier();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEarlier]);

  const copyConversation = useCallback(async () => {
    const time = view.showTimestamps ? hhmm : null;
    const text = conversationText(stateRef.current.items, { mine: myName, friend: friendName }, time);
    setNote((await copyText(text)) ? "Conversation copied." : "Couldn't copy the conversation.");
  }, [myName, friendName, view.showTimestamps]);

  const copySelection = useCallback(async () => {
    const text = inputRef.current?.selectedText() || window.getSelection()?.toString() || "";
    if (text) setNote((await copyText(text)) ? null : "Couldn't copy.");
  }, []);

  const selectAll = useCallback(() => {
    const log = logRef.current;
    const sel = window.getSelection();
    if (!log || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(log);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const setIgnoring = useCallback(
    async (on: boolean) => {
      const res = on ? await ignoreUser(me, friendId) : await unignoreUser(me, friendId);
      setDialog(null);
      if (!res.ok) return setNote(res.message);
      ignoredRef.current = on;
      setIgnored(on);
      setNote(on ? `You're ignoring ${friendName}.` : `You're no longer ignoring ${friendName}.`);
    },
    [me, friendId, friendName],
  );

  const menus: MenuDef[] = [
    {
      label: "Conversation",
      items: [
        { label: "Copy Conversation", onSelect: () => void copyConversation() },
        { label: "Close", onSelect: () => void closeWindow() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Copy", shortcut: "Ctrl+C", onSelect: () => void copySelection() },
        { label: "Select All", onSelect: selectAll },
        { label: "Clear Window", onSelect: () => dispatch({ type: "cleared" }) },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Show Timestamps", checked: view.showTimestamps, onSelect: () => updateView({ showTimestamps: !view.showTimestamps }) },
        { label: "Show Earlier Messages", shortcut: "F3", disabled: state.reachedStart, onSelect: showEarlier },
        {
          label: "Show Friends' Fonts",
          checked: view.showFriendsFonts,
          onSelect: () => updateView({ showFriendsFonts: !view.showFriendsFonts }),
        },
      ],
    },
    {
      label: "Actions",
      items: [
        { label: "Buzz!", shortcut: "Ctrl+G", disabled: presence === "offline", onSelect: () => nudgeRef.current?.send() },
        { label: "View Profile", onSelect: () => setDialog("profile") },
        ignored
          ? { label: "Stop Ignoring", onSelect: () => void setIgnoring(false) }
          : { label: "Ignore...", onSelect: () => setDialog("ignore") },
      ],
    },
    { label: "Help", items: [{ label: "About Buzz", onSelect: () => setDialog("about") }] },
  ];

  return (
    <WindowFrame title={`${friendName} - Instant Message`} icon={<PresenceDot state={presence} size={14} />}>
      <ChatLayout
        rootRef={rootRef}
        menu={<MenuBar menus={menus} label="Chat menu" />}
        header={
          <>
            <PresenceDot state={presence} />
            <strong className="ym-truncate">{friendName}</strong>
            <span className="ym-truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {friend?.statusMessage ? `"${friend.statusMessage}"` : presenceLabel(presence)}
            </span>
            {hasNowPlaying(friend?.nowPlaying) ? (
              <span className="ym-truncate" style={{ fontSize: 12 }} title={friend?.nowPlaying ?? undefined}>
                <span aria-hidden="true">♪ </span>
                {shownNowPlaying(friend?.nowPlaying ?? "")}
              </span>
            ) : null}
          </>
        }
        notice={
          <>
            {loadError ? (
              <p role="alert" style={{ color: "var(--buzz-red)", fontSize: 12, margin: "4px 8px" }}>
                Couldn&apos;t load your earlier messages. We&apos;ll try again when you&apos;re back online.
              </p>
            ) : null}
            <p role="status" aria-live="polite" style={{ fontSize: 12, margin: note ? "4px 8px" : 0 }}>
              {note ?? ""}
            </p>
            {keyChanged && myKeys.status === "ready" ? (
              <div role="alert" style={{ fontSize: 12, margin: "4px 8px" }}>
                <SafetyNumber myPublicKey={myKeys.keys.publicKey} friendId={friendId} friendName={friendName} />
                <button
                  type="button"
                  className="ym-button mt-1"
                  onClick={() => {
                    void trustFriendKey(me, friendId).then((ok) => {
                      setKeyChanged(!ok);
                      setNote(ok ? `You trust ${friendName}'s new key. Send your message again.` : "Couldn't update the key. Try again.");
                    });
                  }}
                >
                  I checked it. Trust the new key.
                </button>
              </div>
            ) : null}
          </>
        }
        list={
          <MessageList
            items={state.items}
            myName={myName}
            friendName={friendName}
            showTimestamps={view.showTimestamps}
            showFriendsFonts={view.showFriendsFonts}
            reachedStart={state.reachedStart}
            footerLine={presence === "offline" ? offlineLine(friendName) : null}
            logRef={logRef}
          />
        }
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
            <NudgeButton ref={nudgeRef} friendId={friendId} friendPresence={presence} onNudge={handleNudge} />
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
        input={
          <>
            <FormatBar format={view.myFormat} onChange={(myFormat) => updateView({ myFormat })} />
            <MessageInput ref={inputRef} onSend={handleSend} onTyping={sendTyping} format={view.myFormat} />
          </>
        }
        pictures={
          <>
            <Avatar name={friendName} url={friend?.avatarUrl ?? null} />
            <Avatar name={myName} url={mine?.avatarUrl ?? null} />
          </>
        }
      />
      {dialog === "about" ? <AboutDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "profile" ? (
        <Dialog title={`${friendName}'s profile`} onClose={() => setDialog(null)}>
          <p className="m-0 font-bold">{friendName}</p>
          {shouldShowField(friend?.statusMessage) ? <p className="m-0 text-xs">{friend?.statusMessage}</p> : null}
          {hasNowPlaying(friend?.nowPlaying) ? <p className="m-0 text-xs">♪ {friend?.nowPlaying}</p> : null}
          {myKeys.status === "ready" ? (
            <SafetyNumber myPublicKey={myKeys.keys.publicKey} friendId={friendId} friendName={friendName} />
          ) : null}
          <button type="button" className="ym-button mt-2" onClick={() => setDialog(null)}>
            Close
          </button>
        </Dialog>
      ) : null}
      {dialog === "ignore" ? (
        <Dialog title={`Ignore ${friendName}`} role="alertdialog" onClose={() => setDialog(null)}>
          <p className="m-0 text-xs">
            Ignore {friendName}? They won&apos;t be able to message you, Buzz you, or send you friend requests, and
            they&apos;ll see you as offline. Buzz won&apos;t tell them.
          </p>
          <div className="mt-2 flex gap-1">
            <button type="button" className="ym-button" onClick={() => void setIgnoring(true)}>
              Ignore
            </button>
            <button type="button" className="ym-button" data-autofocus onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </Dialog>
      ) : null}
    </WindowFrame>
  );
}
export default ChatWindow;
