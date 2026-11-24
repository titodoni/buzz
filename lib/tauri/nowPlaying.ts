// Thin wrapper over the Rust now_playing module (src-tauri/src/now_playing.rs).
// Safe no-ops in a plain browser.
import type { OsTrack } from "@/lib/nowPlaying/auto"
import type { NowPlayingPlatform } from "@/lib/nowPlaying/note"
import { isTauri, onShellEvent } from "./windows"

/** Must match EVENT_NOW_PLAYING in src-tauri/src/now_playing.rs. */
export const NOW_PLAYING_EVENT = "buzz://now-playing"

/** Which system the app reads from, so the wording can say what is read. */
export async function nowPlayingPlatform(): Promise<NowPlayingPlatform> {
  if (!isTauri()) return "other"
  const { invoke } = await import("@tauri-apps/api/core")
  const p = await invoke<string>("now_playing_platform").catch(() => "other")
  return p === "linux" || p === "windows" || p === "macos" ? p : "other"
}

/** True when this desktop build can read what is playing (Linux, Windows, macOS). */
export async function nowPlayingSupported(): Promise<boolean> {
  if (!isTauri()) return false
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<boolean>("now_playing_supported").catch(() => false)
}

/** Starts or stops reading the OS media players. Nothing is read while off. */
export async function setNowPlayingEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { invoke } = await import("@tauri-apps/api/core")
  await invoke("set_now_playing_enabled", { enabled })
}

function isOsTrack(v: unknown): v is OsTrack {
  if (v === null) return true
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    (v[0] === null || typeof v[0] === "string") &&
    typeof v[1] === "string"
  )
}

/** Calls `handler` on each track change; returns an unsubscribe function. */
export function onNowPlaying(handler: (t: OsTrack) => void): Promise<() => void> {
  return onShellEvent(NOW_PLAYING_EVENT, (payload) => {
    if (isOsTrack(payload)) handler(payload)
  })
}
