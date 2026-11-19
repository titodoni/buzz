# Supabase

Schema changes live in `migrations/` as timestamped SQL files. Do not use the
dashboard SQL editor to change the schema.

## Apply migrations

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Then regenerate types (replaces the hand-written file):

```sh
supabase gen types typescript --linked > lib/supabase/database.types.ts
```

## Migrations

| File | Contents |
| --- | --- |
| `20250101000000_profiles.sql` | `profiles`, signup trigger, `updated_at` trigger, RLS |
| `20250101000100_friendships.sql` | `friendships`, unique pair index, transition trigger, RLS |
| `20250101000200_messages.sql` | `messages`, indexes, receipt-only update trigger, RLS, Realtime publication |
| `20250101000300_storage_avatars.sql` | public `avatars` bucket and owner-folder policies |
| `20250101000400_retention_cron.sql` | `pg_cron` daily purge of undelivered messages older than 30 days |

## Notes

- Status transitions on `friendships` and receipt-only updates on `messages`
  are enforced by triggers, because RLS cannot compare old and new rows. The
  triggers are skipped when `auth.uid()` is null (service role, migrations).
- Re-requesting after `removed`/`declined` is allowed only for the original
  `requester_id`. If the original addressee wants to re-friend, the app needs a
  follow-up decision (swap roles or relax the rule).
- The default avatar URL set at signup is the app asset path
  `/avatars/default.png`. The app must bundle that file, or change the trigger.
- `pg_cron` must be enabled on the project (Database > Extensions) if
  `create extension` is not permitted by your plan.
- The service-role key is never used by the app. Only the project URL and
  publishable key are public build inputs.
- `tests/rls.sql` holds two-user verification queries to run manually.
- None of this SQL has been executed yet (no local Postgres/Supabase available
  when written).

## Realtime Authorization

Chat (`chat:<pair>`) and inbox (`inbox:<userId>`) channels are joined as
**private** channels. Migration `20250101000600_realtime_private_channels.sql`
adds the RLS policies on `realtime.messages` that decide who may join and
broadcast. Private channels need no extra dashboard setting; leaving
"Allow public access" on keeps `presence:global` working (see
`docs/adr/0003` for its known gap).

## Checking RLS

`npm run test:rls` runs `supabase/tests/rls-check.mjs` against the database
in `SUPABASE_DB_URL`. It creates three throwaway users inside a transaction,
exercises the policies and triggers as each of them, prints PASS/FAIL per
check, and rolls everything back. `supabase/tests/rls.sql` holds the same
scenarios as commented SQL for running by hand.

The Realtime Authorization policies (`realtime.messages`) are not covered by
this script, because they only apply to live Realtime connections. Check
them with two signed-in app instances: a non-friend must fail to join
`chat:<pair>` or send to `inbox:<id>`.

## Password recovery email (required for "Forgot your password?")

Buzz is a desktop app, so a reset *link* has nowhere to open. The app asks for
the one-time **code** instead (`resetPasswordForEmail`, then
`verifyOtp({ type: "recovery" })`). Supabase's default "Reset password" email
only contains a link, so change it once in the dashboard:

1. Authentication → Emails → Templates → **Reset password**.
2. Put the code in the message, for example:
   `<p>Your Buzz code is <strong>{{ .Token }}</strong>. It expires soon.</p>`
3. Save.

The app accepts codes of 6 to 10 digits (Supabase's default is 6). The built-in
email service only sends a few emails per hour; configure your own SMTP server
before real users rely on this.
