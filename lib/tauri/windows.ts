// Thin wrapper over @tauri-apps/api so components never import it directly.
// Every function is a safe no-op (or a sensible fallback) when the app runs in a
// plain browser, e.g. `next dev` opened outside the Tauri shell.

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Route used by a chat window. Must match CHAT_PATH in src-tauri/src/lib.rs. */
export function chatUrl(friendId: string): string {
  return `/chat/?friendId=${encodeURIComponent(friendId)}`;
}

/** Opens (or focuses) the chat window for a friend in its own OS window (Req 5.6). */
export async function openChatWindow(friendId: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_chat_window", { friendId });
    return;
  }
  // Browser fallback for development: open a separate browser window.
  window.open(chatUrl(friendId), `chat-${friendId}`, "width=420,height=360");
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
