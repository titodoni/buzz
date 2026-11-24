const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID such as a Supabase user id. The Rust shell enforces the same rule (src-tauri/src/ids.rs). */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}
