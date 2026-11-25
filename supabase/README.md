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
| `20250101000500_friend_search_and_rerequest.sql` | exact-email `search_users`, re-request after removal |
| `20250101000600_realtime_private_channels.sql` | Realtime Authorization for the private chat and inbox channels |
| `20250101000700_realtime_friendships.sql` | `friendships` in the Realtime publication |
| `20250101000800_groups_and_ignore.sql` | `contact_groups`, `contact_group_members`, `ignored_users`, RLS |
| `20250101000900_groups_friends_only_and_realtime.sql` | group members must be accepted friends; groups in the Realtime publication |
| `20250101001000_ignore_enforcement.sql` | ignore blocks messages, friend requests, and channels; `is_ignored_by`, `ignorers_of_me` |
| `20250101001100_is_ignored_by_uses_index.sql` | `is_ignored_by` rewritten to use the primary key index |
| `20250101001200_message_format.sql` | `messages.format` (font, size, color, bold, italic, underline) with a `CHECK`; the receipt guard also freezes `format` |
| `20250101001400_privacy_hardening.sql` | `profiles` select limited to self, accepted friends, pending parties, and ignored users; `avatar_url` host/path check; drop `avatars` bucket listing |
| `20250101001401_revoke_handle_new_user.sql` | revoke `execute` on `handle_new_user()` from `public`, `anon`, and `authenticated` |
| `20250101001500_user_keys.sql` | `user_keys`: one public key per account, readable by accepted friends only |
| `20250101001600_encrypted_messages.sql` | Encrypted Messages columns (`encrypted`, `cipher_receiver`, `cipher_sender`) and cipher guards (step 1, additive) |
| `20250101001601_message_sender_key.sql` | `sender_public_key` on `messages` so key rotation does not break older readable messages |
| `20250101001602_message_sender_key_required.sql` | require non-null `sender_public_key` on encrypted rows |
| `20250101001700_hangouts.sql` | `hangouts`: one pending per pair, guarded status changes, RLS, Realtime publication, `pg_cron` expiry (ADR 0011) |
| `20261124082027_require_encrypted_messages.sql` | Encrypted Messages cutover (step 2): refuse new plaintext `messages` inserts (ADR 0010) |
| `20261124124350_security_hardening.sql` | server-enforced timestamps, 15m hangout acceptance guard, 3+ char name search (max 20), FK/cron indexes, revoke `anon` table privileges |
| `20261124124357_rate_limits.sql` | database-enforced rate limits (60 messages/min, 10 hangouts/10min, 20 friend requests/hr, 1h declined re-request cooldown) |
| `20261124124401_private_presence_and_sender_key.sql` | private `presence:<userId>` Realtime policies and trigger verifying `sender_public_key` matches `user_keys` |
| `20261124124656_messages_keep_delivered_stamp.sql` | preserve sender-set `delivered_at` (clamped to server clock) for online recipients |
| `20261125034400_signup_display_name.sql` | `handle_new_user()` reads optional `display_name` from auth user metadata |
| `20261125120000_cancel_friend_request.sql` | allow the requester to cancel (`pending -> removed`) a sent friend request |

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
- `tests/rls.sql` holds two-user verification queries to run manually; `tests/rls-check.mjs` runs the automated 109-check rollback suite.
- All 27 migrations (`20250101000000` through `20261125120000`) are applied on the hosted project (`mkeozqwudranxrdferai`). Four `SECURITY DEFINER` helpers (`search_users`, `is_friend_of_me`, `is_ignored_by`, `ignorers_of_me`) intentionally remain callable by `authenticated` with `anon` revoked (see `docs/adr/0013-cto-technical-debt-and-delivery-baseline.md`).

## Realtime Authorization

Chat (`chat:<pair>`), inbox (`inbox:<userId>`) and presence
(`presence:<userId>`) channels are all joined as **private** channels.
Migrations `20250101000600_realtime_private_channels.sql` and
`20261124124401_private_presence_and_sender_key.sql` add the RLS policies on
`realtime.messages` that decide who may join, broadcast and track (only the
owner tracks on their presence topic; only accepted friends who are not
ignored may listen).

Builds before the private presence change still use the public
`presence:global` channel. Once every tester runs a build with private
presence, turn **off** "Allow public access" in Project Settings → Realtime,
so no channel works without these policies (docs/adr/0003).

## Local stack (Docker)

`supabase/config.toml` configures a local stack that applies every migration
on a fresh database. This is the safe place to try a migration before it
touches the hosted project (the `supabase-local` Kiro Power's workflow).

```sh
npx supabase start                # needs Docker; first run pulls about 7 GB of images
npx supabase migration list --local
npx supabase stop
```

To run the RLS checks against it, use a copy of the script without the SSL
option (the local database does not offer SSL) and the local URL
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`. To run the app
against it, put the local URL and publishable key from `npx supabase status`
in `.env.local` (git-ignored) and delete that file before any shipping build.

## Checking RLS

`npm run test:rls` runs `supabase/tests/rls-check.mjs` against the database
in `SUPABASE_DB_URL`. It creates three throwaway users inside a transaction,
exercises the policies and triggers as each of them, prints PASS/FAIL per
check, and rolls everything back. `supabase/tests/rls.sql` holds the same
scenarios as commented SQL for running by hand.

Since migration `20261124082027` (the cutover; it was `20250101001610` in the repo until it was renamed to match the hosted project's migration history), the database refuses plaintext messages, so
the message checks insert the encrypted shape. The old plaintext `format`
column is checked on stored rows inserted as the table owner.

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
