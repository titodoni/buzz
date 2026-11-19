// Cross-window activity: chat windows tell the Buddy List window (which owns
// presence) that the user is active, so chatting never counts as idle
// (Req 4.1, 4.2). All windows share one origin and its localStorage, and a
// `storage` event fires in every *other* window when a key changes.

const ACTIVITY_KEY = "buzz:lastActivityAt";

/** Minimum gap between activity reports from one window. */
export const ACTIVITY_REPORT_MS = 5_000;

let lastReportAt = 0;

/** Records that the user did something in this window (throttled). */
export function reportActivity(now: number = Date.now()): void {
  if (now - lastReportAt < ACTIVITY_REPORT_MS) return;
  lastReportAt = now;
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    // Storage can be unavailable (private mode, quota); activity is best effort.
  }
}

/**
 * Calls `onActivity` whenever another window reports activity.
 * Returns an unsubscribe function.
 */
export function onRemoteActivity(onActivity: (at: number) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== ACTIVITY_KEY || e.newValue === null) return;
    const at = Number(e.newValue);
    if (Number.isFinite(at)) onActivity(at);
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
