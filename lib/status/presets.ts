/** The ready-made status lines. Each one makes the user Busy (Req 12.3). */
export const PRESET_STATUSES = [
  "Be Right Back",
  "Not at My Desk",
  "Not in Office",
  "On the Phone",
  "On Vacation",
  "Out to Lunch",
  "Stepped Out",
] as const;

export type PresetStatus = (typeof PRESET_STATUSES)[number];

/** The two Availability values a user can attach to a status line. */
export type StatusAvailability = "online" | "busy";

/** A status line and the Availability that goes with it, saved together (Req 12.4). */
export interface StatusChoice {
  /** The Status text, or null when there is none. */
  text: string | null;
  availability: StatusAvailability;
}

const norm = (s: string) => s.trim().toLowerCase();
const PRESET_KEYS: ReadonlySet<string> = new Set(PRESET_STATUSES.map(norm));

/** True when `text` is one of the preset lines (ignoring case and surrounding spaces). */
export function isPresetStatus(text: string | null | undefined): boolean {
  return text != null && PRESET_KEYS.has(norm(text));
}

/** Picking a preset writes its text and makes the user Busy. */
export function applyPreset(name: PresetStatus): StatusChoice {
  return { text: name, availability: "busy" };
}

/**
 * Picking Available clears a Status that came from a preset (it would
 * otherwise say "Out to Lunch" next to a smiley), and keeps one the user wrote.
 */
export function chooseAvailable(currentText: string | null | undefined): StatusChoice {
  const text = currentText?.trim() ? currentText : null;
  return { text: isPresetStatus(text) ? null : text, availability: "online" };
}

/** A status the user wrote, with the Availability they picked beside it. */
export function customStatus(text: string, availability: StatusAvailability): StatusChoice {
  const trimmed = text.trim();
  return { text: trimmed === "" ? null : trimmed, availability };
}
