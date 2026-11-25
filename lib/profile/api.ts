import { getSupabase } from "@/lib/supabase/browser-client"
import type { Database } from "@/lib/supabase/database.types"
import { checkAvatar, isValidNowPlaying } from "../validation/profile"
import { planProfileSave, type ProfileDraft, type ProfileFields } from "./save"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type ProfileResult = { ok: true } | { ok: false; message: string }
export type GetProfileResult = { ok: true; profile: Profile } | { ok: false; message: string }
export type UploadAvatarResult = { ok: true; url: string } | { ok: false; message: string }

export const MSG_PROFILE_LOAD = "We couldn't load your profile. Try again."
export const MSG_PROFILE_SAVE = "We couldn't save your profile. Try again."
export const MSG_AVATAR_UPLOAD = "We couldn't upload your picture. Try again."

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export async function getMyProfile(userId: string): Promise<GetProfileResult> {
  try {
    const { data, error } = await getSupabase()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    if (error || !data) return { ok: false, message: MSG_PROFILE_LOAD }
    return { ok: true, profile: data }
  } catch {
    return { ok: false, message: MSG_PROFILE_LOAD }
  }
}

/** Validates first; a rejected input never reaches Supabase. Blank status/now playing are saved as null. */
export async function updateProfile(
  userId: string,
  draft: ProfileDraft,
  previous?: ProfileFields,
): Promise<ProfileResult> {
  const plan = planProfileSave(
    previous ?? { display_name: "", status_message: null, now_playing: null },
    draft,
  )
  if (!plan.ok) return { ok: false, message: plan.message }
  try {
    const { error } = await getSupabase().from("profiles").update(plan.patch).eq("id", userId)
    if (error) return { ok: false, message: MSG_PROFILE_SAVE }
    return { ok: true }
  } catch {
    return { ok: false, message: MSG_PROFILE_SAVE }
  }
}

/** Writes only Now Playing (automatic Now Playing, buzz-trigger R7). Blank is saved as null. */
export async function setMyNowPlaying(userId: string, line: string | null): Promise<ProfileResult> {
  const value = line && line.trim() !== "" ? line : null
  if (value !== null && !isValidNowPlaying(value)) return { ok: false, message: MSG_PROFILE_SAVE }
  try {
    const { error } = await getSupabase().from("profiles").update({ now_playing: value }).eq("id", userId)
    return error ? { ok: false, message: MSG_PROFILE_SAVE } : { ok: true }
  } catch {
    return { ok: false, message: MSG_PROFILE_SAVE }
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadAvatarResult> {
  const check = checkAvatar(file)
  if (!check.ok) return { ok: false, message: check.reason ?? MSG_AVATAR_UPLOAD }
  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return { ok: false, message: MSG_AVATAR_UPLOAD }
  try {
    const supabase = getSupabase()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type })
    if (up.error) return { ok: false, message: MSG_AVATAR_UPLOAD }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path)
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", userId)
    if (error) return { ok: false, message: MSG_AVATAR_UPLOAD }
    return { ok: true, url: data.publicUrl }
  } catch {
    return { ok: false, message: MSG_AVATAR_UPLOAD }
  }
}
