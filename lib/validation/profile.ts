export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const DISPLAY_NAME_MAX = 50;
export const STATUS_MAX = 140;
export const NOW_PLAYING_MAX = 140;
export const MESSAGE_BODY_MAX = 1000;
export const AVATAR_MAX_BYTES = 2_097_152;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DEFAULT_DISPLAY_NAME = "buddy";

export function isValidEmail(s: string): boolean {
  if (/\s/.test(s)) return false;
  const parts = s.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

export function isValidPassword(s: string): boolean {
  return s.length >= PASSWORD_MIN && s.length <= PASSWORD_MAX;
}

/** Prefix before the first "@", cut to 50 chars; "buddy" if that is empty. */
export function displayNameFromEmail(email: string): string {
  const at = email.indexOf("@");
  const prefix = at === -1 ? email : email.slice(0, at);
  const name = prefix.slice(0, DISPLAY_NAME_MAX);
  return name.length > 0 ? name : DEFAULT_DISPLAY_NAME;
}

export function isValidDisplayName(s: string): boolean {
  return s.trim().length > 0 && s.length <= DISPLAY_NAME_MAX;
}

export function isValidStatus(s: string): boolean {
  return s.length <= STATUS_MAX;
}

export function isValidNowPlaying(s: string): boolean {
  return s.length <= NOW_PLAYING_MAX;
}

export function isValidMessageBody(s: string): boolean {
  return s.trim().length > 0 && s.length <= MESSAGE_BODY_MAX;
}

export interface AvatarCandidate {
  size: number;
  type: string;
}

export interface AvatarCheck {
  ok: boolean;
  reason?: string;
}

export function checkAvatar(f: AvatarCandidate): AvatarCheck {
  if (!(f.size <= AVATAR_MAX_BYTES)) {
    return { ok: false, reason: "Avatar must be 2 MB or smaller." };
  }
  if (!(AVATAR_TYPES as readonly string[]).includes(f.type)) {
    return { ok: false, reason: "Avatar must be a PNG, JPEG, or WebP image." };
  }
  return { ok: true };
}
