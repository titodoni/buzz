// Thin wrapper over @tauri-apps/api so components never import it directly.
// Every function is a safe no-op (or a sensible fallback) when the app runs in a
// plain browser, e.g. `next dev` opened outside the Tauri shell.

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Route used by a chat window. Must match `chat_url` in src-tauri/src/lib.rs.
 * `nudge` marks a window opened by an incoming nudge, so it shakes on load.
 */
export function chatUrl(friendId: string, nudge = false): string {
  const base = `/chat/?friendId=${encodeURIComponent(friendId)}`;
  return nudge ? `${base}&nudge=1` : base;
}

/**
 * Opens (or focuses) the chat window for a friend in its own OS window
 * (Req 5.6). With `nudge`, a window that isn't open yet opens shaking; an open
 * one is only focused because it receives the nudge itself.
 */
export async function openChatWindow(
  friendId: string,
  opts: { nudge?: boolean; focus?: boolean } = {},
): Promise<void> {
  const nudge = opts.nudge ?? false;
  const focus = opts.focus ?? true;
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_chat_window", { friendId, nudge, focus });
    return;
  }
  // In a browser, never pop a window open on its own (blocked, and it steals focus).
  if (!focus) return;
  // Browser fallback for development only: a named popup per friend. Unlike
  // Tauri, reopening an existing popup reloads it (and shakes again if nudge).
  window.open(chatUrl(friendId, nudge), `chat-${friendId}`, "width=420,height=360");
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().minimize();
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export async function startDraggingWindow(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

/** Brings this window back from minimized or hidden and to the front (Req 18.1). */
export async function raiseWindow(): Promise<void> {
  if (!isTauri()) {
    window.focus();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.unminimize();
  await win.show();
  await win.setFocus();
}

/** Opens (or raises) the Preferences window (Req 19.1). */
export async function openPreferencesWindow(): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_preferences_window");
    return;
  }
  // Browser fallback for development only.
  window.open("/preferences/", "buzz-preferences", "width=460,height=520");
}

/**
 * Whether a friend's chat window is closed, open behind others, or focused
 * (Req 16.1, 16.2). In a browser the other windows can't be seen, so null.
 */
export async function chatWindowState(friendId: string): Promise<"closed" | "unfocused" | "focused" | null> {
  if (!isTauri()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const state = await invoke<string>("chat_window_state", { friendId });
  return state === "closed" || state === "unfocused" || state === "focused" ? state : null;
}

/** Flashes an open chat window's taskbar entry (Req 16.2). */
export async function flashChatWindow(friendId: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("flash_chat_window", { friendId });
}

/** Stops this window's taskbar flash (Req 16.3). */
export async function clearAttention(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().requestUserAttention(null);
}

/** Shows a desktop toast; returns false in a browser so the caller can show its own. */
export async function showToast(friendId: string, text: string): Promise<boolean> {
  if (!isTauri()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("show_toast", { friendId, text });
  return true;
}

/** Swaps the tray icon to the user's Availability ("offline" when signed out). */
export async function setTrayStatus(status: string): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_tray_status", { status });
}

/** Quits the whole app (Tauri only). */
export async function quitApp(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("quit_app");
}

/** Events the Rust shell sends to the Buddy List window. */
export const SHELL_EVENTS = { setStatus: "buzz://set-status", exitRequested: "buzz://exit-requested" } as const;

/** Listens to a shell event; returns an unsubscribe function (no-op in a browser). */
export async function onShellEvent(name: string, handler: (payload: unknown) => void): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen(name, (e) => handler(e.payload));
}

