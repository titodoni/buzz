import { SupabaseConfigError } from "./config-error"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

export type BuzzSupabaseClient = SupabaseClient<Database>

let client: BuzzSupabaseClient | null = null

/**
 * The single typed Supabase browser client, shared by every window.
 * Created lazily so importing this module never throws (e.g. during the
 * static build). Uses only the public URL and publishable key.
 */
export function getSupabase(): BuzzSupabaseClient {
  if (client) return client

  // Literal property access is required: Next.js inlines NEXT_PUBLIC_* at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  const missing: string[] = []
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  if (!url || !publishableKey) {
    throw new SupabaseConfigError(missing)
  }

  client = createClient<Database>(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}
