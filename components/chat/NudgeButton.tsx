"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  cooldownRemainingMs,
  isNudgeEnabled,
  onNudgeResult,
  readStoredCooldown,
  type NudgeCooldown,
} from "@/lib/nudge/cooldown";
import type { PresenceState } from "@/lib/presence/state";
import { cooldownKey } from "@/lib/nudge/store";

/** Lets the chat window's Actions > Buzz! send through the same cooldown. */
export interface NudgeButtonHandle {
  send: () => void;
}

export const NudgeButton = forwardRef<
  NudgeButtonHandle,
  {
    friendId: string;
    friendPresence: PresenceState;
    onNudge: () => Promise<boolean>;
    /** A message when sending is not allowed right now (the 5-per-10-minutes limit), else null. */
    blockReason?: () => string | null;
  }
>(function NudgeButton(props, ref) {
  const { friendId, friendPresence, onNudge, blockReason } = props;
  // Restored from storage so reopening the chat window keeps the cooldown (Req 6.3).
  // A chat window has one friend for its whole life, so reading once is enough.
  const [cooldown, setCooldown] = useState<NudgeCooldown>(() => {
    try {
      return readStoredCooldown(localStorage.getItem(cooldownKey(friendId)), Date.now());
    } catch {
      return { lastNudgeAt: null }; // storage unavailable
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const remainingMs = cooldownRemainingMs(cooldown, now);
  const inCooldown = remainingMs > 0;
  const offline = friendPresence === "offline";
  const enabled = isNudgeEnabled(friendPresence, cooldown, now) && !sending;

  // UI countdown only; no network involved.
  useEffect(() => {
    if (!inCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [inCooldown]);

  const stateRef = useRef({ onNudge, friendPresence, cooldown, friendId, blockReason });
  useEffect(() => {
    stateRef.current = { onNudge, friendPresence, cooldown, friendId, blockReason };
  });
  // The limit message stays a few seconds, then goes.
  useEffect(() => {
    if (blocked === null) return;
    const id = window.setTimeout(() => setBlocked(null), 5000);
    return () => window.clearTimeout(id);
  }, [blocked]);

  const sendNudge = useCallback(async () => {
    const cur = stateRef.current;
    const t = Date.now();
    if (sendingRef.current || !isNudgeEnabled(cur.friendPresence, cur.cooldown, t)) {
      return;
    }
    const limited = cur.blockReason?.() ?? null;
    if (limited !== null) {
      // Blocked before anything is sent: no cooldown starts and nothing counts.
      setBlocked(limited);
      return;
    }
    setBlocked(null);
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    let delivered = false;
    try {
      delivered = await cur.onNudge();
    } catch {
      delivered = false;
    }
    const after = Date.now();
    setCooldown((c) => onNudgeResult(c, after, delivered));
    if (delivered) {
      try {
        localStorage.setItem(cooldownKey(cur.friendId), String(after));
      } catch {
        // Best effort: the in-memory cooldown still applies.
      }
    }
    setNow(after);
    setFailed(!delivered);
    sendingRef.current = false;
    setSending(false);
  }, []);

  useImperativeHandle(ref, () => ({ send: () => void sendNudge() }), [sendNudge]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        void sendNudge();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sendNudge]);

  const remaining = Math.ceil(remainingMs / 1000);

  let status = "";
  if (blocked) status = blocked;
  else if (offline) status = "Your friend is offline.";
  else if (inCooldown) status = `Buzz again in ${remaining}s`;
  else if (failed) status = "Your buzz wasn't delivered. Try again.";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className="ym-button"
        style={{ minHeight: 28 }}
        title="Buzz! (Ctrl+G)"
        disabled={!enabled}
        aria-describedby="nudge-status"
        onClick={() => void sendNudge()}
      >
        Buzz!
      </button>
      <span id="nudge-status" role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
});
