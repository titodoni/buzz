/** The system the app reads what is playing from (the Rust `now_playing_platform` command). */
export type NowPlayingPlatform = "linux" | "windows" | "macos" | "other"

/**
 * The line shown after the "Share What I'm Playing" switch changes. It says
 * what is actually read: on a Mac only Spotify and Apple Music, because
 * macOS 15.4 and later blocks the general now-playing API for other apps
 * (buzz-trigger R7.7).
 */
export function sharingNote(enabled: boolean, platform: NowPlayingPlatform): string {
  if (!enabled) return "Buzz stopped sharing what you're playing."
  const base = "Friends now see what you're playing. Only the artist and title are shared."
  if (platform === "macos") {
    return `${base} On a Mac Buzz reads Spotify and Apple Music only, and macOS may ask you to allow it the first time.`
  }
  return base
}
