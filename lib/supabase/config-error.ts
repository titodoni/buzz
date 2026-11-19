/** Thrown by getSupabase() when the project URL or publishable key is missing. */
export class SupabaseConfigError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Supabase is not configured: missing ${missing.join(", ")}. ` +
        "Fill in .env (see .env.example) and restart the dev server.",
    );
    this.name = "SupabaseConfigError";
    this.missing = missing;
  }
}
