"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NUDGE_COOLDOWN_MS,
  isInCooldown,
  isNudgeEnabled,
  onNudgeResult,
  type NudgeCooldown,
} from "@/lib/nudge/cooldown";
import type { PresenceState } from "@/lib/presence/state";

export function NudgeButton(props: {
  friendPresence: PresenceState;
  onBuzz: () => Promise<boolean>;
}) {
  const { friendPresence, onBuzz } = props;
  const [cooldown, setCooldown] = useState<NudgeCooldown>({ lastNudgeAt: null });
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sendingRef = useRef(false);

  const inCooldown = isInCooldown(cooldown, now);
  const offline = friendPresence === "offline";
  const enabled = isNudgeEnabled(friendPresence, cooldown, now) && !sending;

  // UI countdown only; no network involved.
  useEffect(() => {
    if (!inCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [inCooldown]);

  const stateRef = useRef({ onBuzz, friendPresence, cooldown });
  useEffect(() => {
    stateRef.current = { onBuzz, friendPresence, cooldown };
  });

  const buzz = useCallback(async () => {
    const cur = stateRef.current;
    const t = Date.now();
    if (sendingRef.current || !isNudgeEnabled(cur.friendPresence, cur.cooldown, t)) {
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    let delivered = false;
    try {
      delivered = await cur.onBuzz();
    } catch {
      delivered = false;
    }
    const after = Date.now();
    setCooldown((c) => onNudgeResult(c, after, delivered));
    setNow(after);
    setFailed(!delivered);
    sendingRef.current = false;
    setSending(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        void buzz();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buzz]);

  const remaining =
    inCooldown && cooldown.lastNudgeAt != null
      ? Math.max(
          1,
          Math.ceil((NUDGE_COOLDOWN_MS - (now - cooldown.lastNudgeAt)) / 1000),
        )
      : 0;

  let status = "";
  if (offline) status = "Your friend is offline.";
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
        onClick={() => void buzz()}
      >
        Buzz!
      </button>
      <span id="nudge-status" role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}
