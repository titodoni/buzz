import { getSupabase } from "../supabase/browser-client"

/** Public keys through the typed client; RLS lets only friends read them (migration 20250101001500). */

export async function fetchPublicKey(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase().from("user_keys").select("public_key").eq("user_id", userId).maybeSingle()
  if (error) throw error
  return data?.public_key ?? null
}

export async function fetchPublicKeys(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map
  const { data, error } = await getSupabase().from("user_keys").select("user_id, public_key").in("user_id", userIds)
  if (error) throw error
  for (const row of data ?? []) map.set(row.user_id, row.public_key)
  return map
}

/** Publishes or replaces my public key. Returns false when the write failed. */
export async function publishPublicKey(me: string, publicKey: string): Promise<boolean> {
  const { error } = await getSupabase().from("user_keys").upsert({ user_id: me, public_key: publicKey })
  return !error
}
