/** False for null, undefined, empty, or whitespace-only values. */
export function shouldShowField(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** True iff now-playing is non-empty after trim (gates the music-note glyph). */
export function hasNowPlaying(value: string | null | undefined): boolean {
  return shouldShowField(value);
}

/** Longest Now Playing shown in a Buddy List row or chat header; the stored limit stays 140. */
export const NOW_PLAYING_SHOWN_MAX = 40;

/** Now Playing cut for display, with "..." when cut. Never splits a character. */
export function shownNowPlaying(value: string): string {
  const chars = [...value.trim()];
  if (chars.length <= NOW_PLAYING_SHOWN_MAX) return chars.join("");
  return chars.slice(0, NOW_PLAYING_SHOWN_MAX - 3).join("").trimEnd() + "...";
}
