/** False for null, undefined, empty, or whitespace-only values. */
export function shouldShowField(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** True iff now-playing is non-empty after trim (gates the music-note glyph). */
export function hasNowPlaying(value: string | null | undefined): boolean {
  return shouldShowField(value);
}
