import {
  DISPLAY_NAME_MAX,
  NOW_PLAYING_MAX,
  STATUS_MAX,
  isValidDisplayName,
  isValidNowPlaying,
  isValidStatus,
} from "../validation/profile"

export interface ProfileFields {
  display_name: string
  status_message: string | null
  now_playing: string | null
}

export interface ProfileDraft {
  display_name: string
  status_message: string
  now_playing: string
}

export type ProfileField = keyof ProfileFields

export type ProfileSavePlan =
  | { ok: false; field: ProfileField; message: string; keep: ProfileFields }
  | { ok: true; patch: ProfileFields }

export const MSG_NAME_REQUIRED = "Your display name can't be empty."
export const MSG_NAME_TOO_LONG = `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`
export const MSG_STATUS_TOO_LONG = `Status must be ${STATUS_MAX} characters or fewer.`
export const MSG_NOW_PLAYING_TOO_LONG = `Now playing must be ${NOW_PLAYING_MAX} characters or fewer.`

function blankToNull(s: string): string | null {
  return s.trim().length === 0 ? null : s
}

/** Decide what a Save does. Pure: no network. A rejected draft never yields a patch (Req 2.2, 7.3, 7.4). */
export function planProfileSave(previous: ProfileFields, draft: ProfileDraft): ProfileSavePlan {
  const reject = (field: ProfileField, message: string): ProfileSavePlan => ({
    ok: false,
    field,
    message,
    keep: previous,
  })
  if (!isValidDisplayName(draft.display_name)) {
    return reject(
      "display_name",
      draft.display_name.trim().length === 0 ? MSG_NAME_REQUIRED : MSG_NAME_TOO_LONG,
    )
  }
  if (!isValidStatus(draft.status_message)) return reject("status_message", MSG_STATUS_TOO_LONG)
  if (!isValidNowPlaying(draft.now_playing)) return reject("now_playing", MSG_NOW_PLAYING_TOO_LONG)
  return {
    ok: true,
    patch: {
      display_name: draft.display_name.trim(),
      status_message: blankToNull(draft.status_message),
      now_playing: blankToNull(draft.now_playing),
    },
  }
}
