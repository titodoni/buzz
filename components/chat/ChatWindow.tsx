"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { PresenceDot } from "@/components/PresenceDot";
import { NudgeButton, type NudgeButtonHandle } from "@/components/chat/NudgeButton";
import { ChatMenuBar, type ChatDialogKind } from "./chatMenus";
import { ChatDialogs } from "./ChatDialogs";
import { ChatHeader } from "./ChatHeader";
import { KeyChangedNotice } from "./KeyChangedNotice";
import { EmoticonPicker } from "./EmoticonPicker";
import { FormatBar } from "./FormatBar";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { hhmm, MessageList } from "./MessageList";
import { Avatar, ChatLayout } from "./ChatLayout";
import { TypingIndicator } from "./TypingIndicator";
import { conversation, earlierCursor, emptyConversation, type MessageRow } from "@/lib/chat/conversation";
import { EARLIER_PAGE_SIZE, ensureFriendTrust, hasFriendKeyChanged, loadEarlier, loadHistory, markConversationRead, sendEncryptedMessage, trustFriendKey } from "@/lib/chat/api";
import { readWireRow, readWireRows, type ReadKey, type WireRow } from "@/lib/chat/wire";
import { useMyKeys } from "@/lib/crypto/useMyKeys";
import type { KeyPair } from "@/lib/crypto/box";
import { trustReceivedKey } from "@/lib/crypto/trust";
import { conversationText, copyText } from "@/lib/chat/copy";
import { useChatView } from "@/lib/chat/useChatView";
import { useChatChannel } from "@/lib/realtime/chat";
import { useFriendPresence } from "@/lib/realtime/presence";
import { ignoreUser, isIgnoredByMe, unignoreUser, useIgnorers } from "@/lib/friends/ignore";
import { playNudgeSound, shakeChatWindow } from "@/lib/nudge/effects";
import { shouldAcceptNudge } from "@/lib/prefs/prefs";
import { readPrefs } from "@/lib/prefs/usePrefs";
import { getProfile, type PublicProfile } from "@/lib/friends/api";
import { useProfileUpdates } from "@/lib/friends/profileFeed";
import { mergeOne, type ProfileFields } from "@/lib/friends/profileMerge";
import { onSend as typingOnSend, type TypingState } from "@/lib/typing/state";
import { receiveTypingSignal, type TypingSignal } from "@/lib/typing/broadcast";
import { reportActivity } from "@/lib/realtime/activity";
import { sendNudgeToInbox } from "@/lib/realtime/inbox";
import { NUDGE_LIMIT_MESSAGE, canNudge } from "@/lib/nudge/limiter";
import { announceChatSeen, loadSentLog, recordDeliveredNudge } from "@/lib/nudge/store";
import { clearAttention, closeWindow, raiseWindow } from "@/lib/tauri/windows";
import { HangoutBanner } from "@/components/hangout/HangoutBanner";
import { HangoutButton } from "@/components/hangout/HangoutButton";
import { chatLines, hasPendingWith, incomingPending } from "@/lib/hangout/state";
import { useHangouts } from "@/lib/hangout/useHangouts";

/** Req 17.9 */
export function offlineLine(friendName: string): string {
  return `${friendName} is offline. Your messages will be waiting when they sign in.`;
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
  const nudgeRef = useRef<NudgeButtonHandle>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const { view, update: updateView } = useChatView();
  const [dialog, setDialog] = useState<ChatDialogKind | null>(null);
  /** A short note under the header, e.g. "Copied." or a failure. */
  const [note, setNote] = useState<string | null>(null);
  // True after a send was stopped because the friend's key changed (ADR 0010, E3.1).
  const [keyChanged, setKeyChanged] = useState(false);
  const loadingEarlierRef = useRef(false);
  // The Buddy List window makes my encryption key; this window only reads it (ADR 0010).
  const myKeys = useMyKeys(me, "reader");
  const keysLoading = myKeys.status === "loading";
  // History is read again once a late key arrives, so the messages become readable.
  const keysReady = myKeys.status === "ready";
  const readKey: ReadKey =
    myKeys.status === "ready"
      ? {
          id: me,
          privateKey: myKeys.keys.privateKey,
          // A friend's message opens only with a key I accepted (audit S11).
          trustsSender: (senderId, key) => trustReceivedKey(localStorage, me, senderId, key),
        }
      : null;
  const readKeyRef = useRef<ReadKey>(readKey);
  // The friend key whose Safety Number is on screen; that is the key "Trust" may pin.
  const shownKeyRef = useRef<string | null>(null);
  const rememberShownKey = useCallback((key: string | null) => {
    shownKeyRef.current = key;
  }, []);
  const sendKeys = myKeys.status === "ready" ? myKeys.keys : myKeys.status === "unavailable" ? ("unavailable" as const) : null;
  const keysRef = useRef(sendKeys);
  const keyWaitersRef = useRef<Array<(keys: KeyPair | "unavailable" | null) => void>>([]);
  useEffect(() => {
    readKeyRef.current = readKey;
    keysRef.current = sendKeys;
    if (myKeys.status !== "loading" && myKeys.status !== "none") {
      const settled = myKeys.status === "ready" ? myKeys.keys : myKeys.status === "unavailable" ? ("unavailable" as const) : null;
      const waiters = keyWaitersRef.current.splice(0);
      for (const resolve of waiters) resolve(settled);
    }
  });
  useEffect(() => {
    const waitersRef = keyWaitersRef;
    return () => {
      const waiters = waitersRef.current.splice(0);
      for (const resolve of waiters) resolve(null);
    };
  }, []);
  const waitForSendKeys = useCallback((): Promise<KeyPair | "unavailable" | null> => {
    if (keysRef.current !== null) return Promise.resolve(keysRef.current);
    if (myKeys.status !== "loading" && myKeys.status !== "none") return Promise.resolve(null);
    return new Promise((resolve) => {
      const finish = (keys: KeyPair | "unavailable" | null) => {
        window.clearTimeout(timer);
        resolve(keys);
      };
      const timer = window.setTimeout(() => {
        const idx = keyWaitersRef.current.indexOf(finish);
        if (idx >= 0) keyWaitersRef.current.splice(idx, 1);
        resolve(keysRef.current);
      }, 8000);
      keyWaitersRef.current.push(finish);
    });
  }, [myKeys.status]);

  const friendName = friend?.displayName ?? "Your friend";
  const myName = mine?.displayName ?? "Me";
  const livePresence = useFriendPresence(friendId);
  // A friend who ignores me looks Offline (Req 15.5); then the Nudge button is off too.
  const ignorers = useIgnorers(me);
  const presence = ignorers.has(friendId) ? "offline" : livePresence;
  const [ignored, setIgnored] = useState(false);
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

  // When this friend's last Buzz was shown here, for the receive-side gap (Req 18.5).
  const lastNudgeAtRef = useRef<number | undefined>(undefined);
  const receiveNudge = useCallback(() => {
    if (ignoredRef.current) return;
    const prefs = readPrefs();
    const now = Date.now();
    // "Allow Buzz!" off, or a second Buzz too soon: dropped (Req 18.2, 18.5).
    if (!shouldAcceptNudge(prefs, lastNudgeAtRef.current, now)) return;
    lastNudgeAtRef.current = now;
    dispatch({ type: "nudgeReceived", at: new Date(now).toISOString() });
    if (prefs.buzz.sound && prefs.alerts.allSounds) playNudgeSound();
    if (!prefs.buzz.shake) return;
    // A minimized or hidden window comes to the front first, then shakes (Req 18.1).
    void raiseWindow()
      .catch(() => undefined)
      .then(() => shakeChatWindow(rootRef.current));
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
    return Promise.all([
      loadHistory(me, friendId),
      readKeyRef.current ? ensureFriendTrust(me, friendId) : Promise.resolve(),
    ])
      .then(([rows]) => readWireRows(rows, readKeyRef.current))
      .then(async (rows) => {
        dispatch({ type: "historyLoaded", messages: rows });
        if (rows.some((r) => r.unverified) && (await hasFriendKeyChanged(me, friendId))) {
          setKeyChanged(true);
        }
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
  }, [me, friendId, reload, keysLoading, keysReady]);

  // The friend's new Status or Now Playing reaches the header without a reload (buzz-trigger R0).
  const friendIds = useMemo(() => [friendId], [friendId]);
  const onFriendProfile = useCallback((p: ProfileFields) => setFriend((cur) => mergeOne(cur, p)), []);
  useProfileUpdates(`profiles:chat:${me}:${friendId}`, friendIds, onFriendProfile);

  // Hangouts with this friend: the banner, the button's guard, and the system lines (buzz-trigger R3).
  const hangouts = useHangouts(me, `hangouts:chat:${me}:${friendId}`);
  const hangoutNames = useMemo(() => ({ [me]: myName, [friendId]: friendName }), [me, friendId, myName, friendName]);
  const hangoutBanners = incomingPending(hangouts.rows, me, hangouts.now).filter((r) => r.sender_id === friendId);
  const hangoutLines = chatLines(hangouts.rows, me, friendId, hangoutNames, hangouts.now);
  const hangoutPending = hasPendingWith(hangouts.rows, me, friendId, hangouts.now);

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
      void (async () => {
        if (readKeyRef.current) await ensureFriendTrust(me, friendId);
        const message = await readWireRow(wire, readKeyRef.current);
        dispatch({ type: "messageArrived", message });
        if (message.sender_id !== friendId) return;
        if (message.unverified) setKeyChanged(true);
        setFriendTyping((s) => typingOnSend(s));
        markReadIfActive();
      })();
    },
    [me, friendId, markReadIfActive],
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
    async (body: string) => {
      const row: MessageRow = {
        id: crypto.randomUUID(),
        sender_id: me,
        receiver_id: friendId,
        body,
        created_at: new Date().toISOString(),
        format: formatRef.current,
      };
      dispatch({ type: "sendStarted", message: row });
      const activeKeys = keysRef.current ?? (await waitForSendKeys());
      // Encrypts on this device first; the text never goes to the database (ADR 0010).
      return sendEncryptedMessage({
        me,
        friendId,
        friendName,
        body,
        format: formatRef.current,
        id: row.id,
        delivered: presenceRef.current !== "offline",
        keys: activeKeys,
      }).then((res) => {
        dispatch(res.ok ? { type: "sendConfirmed", id: row.id } : { type: "sendFailed", id: row.id });
        setNote(res.ok ? null : res.message);
        setKeyChanged(!res.ok && res.reason === "changed");
        return res.ok;
      });
    },
    [me, friendId, friendName, waitForSendKeys],
  );

  const handleNudge = useCallback(async () => {
    // Chat channel reaches an open window; the inbox opens a closed one. Either is delivery.
    const results = await Promise.all([sendNudge(), sendNudgeToInbox(me, friendId)]);
    const ok = results.some(Boolean);
    if (ok) {
      // A delivered Nudge counts toward the 5-per-10-minutes limit (buzz-trigger R4.5).
      recordDeliveredNudge(friendId);
      dispatch({ type: "nudgeSent", friendName, at: new Date().toISOString() });
    }
    return ok;
  }, [sendNudge, friendId, me, friendName]);

  // Button, Ctrl+G and Actions > Buzz! all reach this check through the Buzz! button.
  const nudgeBlockReason = useCallback(() => (canNudge(loadSentLog(), Date.now()) ? null : NUDGE_LIMIT_MESSAGE), []);

  // Tell the Buddy List this chat is open and in view, so the red Nudge count on its row clears (R4.2).
  useEffect(() => {
    const seen = () => {
      if (document.hasFocus()) announceChatSeen(friendId);
    };
    seen();
    window.addEventListener("focus", seen);
    return () => window.removeEventListener("focus", seen);
  }, [friendId]);

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
    Promise.all([
      loadEarlier(me, friendId, earlierCursor(s)),
      readKeyRef.current ? ensureFriendTrust(me, friendId) : Promise.resolve(),
    ])
      .then(([rows]) => readWireRows(rows, readKeyRef.current))
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

  return (
    <WindowFrame title={`${friendName} - Instant Message`} icon={<PresenceDot state={presence} size={14} />}>
      <ChatLayout
        rootRef={rootRef}
        menu={
          <ChatMenuBar
            state={{ view, reachedStart: state.reachedStart, friendOffline: presence === "offline", ignored }}
            actions={{
              copyConversation: () => void copyConversation(),
              closeWindow: () => void closeWindow(),
              copySelection: () => void copySelection(),
              selectAll,
              clearWindow: () => dispatch({ type: "cleared" }),
              showEarlier,
              sendBuzz: () => nudgeRef.current?.send(),
              stopIgnoring: () => void setIgnoring(false),
              openDialog: setDialog,
              updateView,
            }}
          />
        }
        header={
          <ChatHeader
            friendName={friendName}
            presence={presence}
            statusMessage={friend?.statusMessage}
            nowPlaying={friend?.nowPlaying}
          />
        }
        notice={
          <>
            {hangoutBanners.map((h) => (
              <HangoutBanner key={h.id} id={h.id} fromName={friendName} text={h.text} onAnswered={() => undefined} />
            ))}
            {hangoutLines.length > 0 ? (
              <ul role="status" aria-live="polite" className="m-0 list-none px-2 py-1 text-xs">
                {hangoutLines.map((l) => (
                  <li key={l.id}>{l.text}</li>
                ))}
              </ul>
            ) : null}
            {loadError ? (
              <p role="alert" style={{ color: "var(--buzz-red)", fontSize: 12, margin: "4px 8px" }}>
                Couldn&apos;t load your earlier messages. We&apos;ll try again when you&apos;re back online.
              </p>
            ) : null}
            <p role="status" aria-live="polite" style={{ fontSize: 12, margin: note ? "4px 8px" : 0 }}>
              {note ?? ""}
            </p>
            {keyChanged && myKeys.status === "ready" ? (
              <KeyChangedNotice
                myPublicKey={myKeys.keys.publicKey}
                friendId={friendId}
                friendName={friendName}
                onKey={rememberShownKey}
                onTrust={() => {
                  void trustFriendKey(me, friendId, shownKeyRef.current).then((ok) => {
                    setKeyChanged(!ok);
                    setNote(ok ? `You trust ${friendName}'s new key. Send your message again.` : "Couldn't update the key. Try again.");
                    // Messages that came with the new key can be read now.
                    if (ok) void reload();
                  });
                }}
              />
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
              className="ym-chip"
              title="Emoticons"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static export, tiny local SVG */}
              <img src="/emoticons/smile.svg" alt="" width={18} height={18} />
              <span className="sr-only">Emoticons</span>
            </button>
            <NudgeButton ref={nudgeRef} friendId={friendId} friendPresence={presence} onNudge={handleNudge} blockReason={nudgeBlockReason} />
            <HangoutButton
              me={me}
              friendId={friendId}
              friendName={friendName}
              friendPresence={presence}
              hasPending={hangoutPending}
              onNote={setNote}
            />
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
      <ChatDialogs
        dialog={dialog}
        friendId={friendId}
        friendName={friendName}
        friend={friend}
        myPublicKey={myKeys.status === "ready" ? myKeys.keys.publicKey : null}
        onClose={() => setDialog(null)}
        onIgnore={() => void setIgnoring(true)}
      />
    </WindowFrame>
  );
}
export default ChatWindow;
