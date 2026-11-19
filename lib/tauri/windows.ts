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
export async function openChatWindow(friendId: string, opts: { nudge?: boolean } = {}): Promise<void> {
  const nudge = opts.nudge ?? false;
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_chat_window", { friendId, nudge });
    return;
  }
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
