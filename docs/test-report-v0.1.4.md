# Test report: Buzz 0.1.4 beta

Build: tag `v0.1.4` (26 Nov 2026). Installers for Windows, macOS, and Linux
are built by `.github/workflows/beta-build.yml` and attached to the GitHub
Release.

Results are **PASS**, **FAIL**, or **NOT RUN**. A row is PASS only if a person
or an automated check directly observed it pass. Nothing has been run on macOS.

## Summary

| Area | Result |
| --- | --- |
| Code checks (`tsc`, `eslint`, `vitest`, `cargo fmt/clippy/test`, `next build`) | PASS |
| Database security rules (`npm run test:rls`) on hosted `mkeozqwudranxrdferai` | PASS (`109/109 ALL PASS`) |
| Two-user check, Windows desktop app (`e2e/two-user.mjs`, `T1`–`T15`) | PASS (`15/15 PASS`, runs `45630265349` & `45631553402`) |
| Two-user check, Linux desktop app (`E2E_FRESH=1`, `T1`–`T15`, 5 runs in a row) | PASS (`15/15 PASS` x 5 runs) |
| Hosted interactive checks (`E6`, `B1`–`B3`, `B6`–`B8`, `B10`, `pg_cron` jobs) | PASS |
| Responsive layout checks (`/forgot/`, `/toast/`) | PASS (`0` overflow / `0` clipped controls) |
| Windows by a person (`W1`–`W5`, installer, shake & sound, tray) | NOT RUN (`#5`) |
| Hosted audio/shake (`B4`–`B5`), 15-min Hangout expiry (`B9`), Now Playing (`N1`–`N3`) | NOT RUN (`#13`) |
| macOS desktop app | NOT RUN (`#9`) |

## 1. Code checks (on `v0.1.4` release tree)

| Check | Result | Detail |
| --- | --- | --- |
| `npm run typecheck` | PASS | no errors |
| `npm run lint` | PASS | no errors or warnings |
| `npm test` | PASS | `61` test files, `403` tests (includes `APP_VERSION === "0.1.4"`) |
| `npm run build` | PASS | Next.js static export (`out/`) |
| `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` | PASS | no warnings |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | `23` passed, `1` ignored (keychain integration check) |

## 2. Database security rules (`npm run test:rls` on hosted `mkeozqwudranxrdferai`)

Ran `npm run test:rls` (`supabase/tests/rls-check.mjs`) against the live hosted
project (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) inside a rolled-back
transaction on 26 Nov 2026:

- **109 / 109 checks (`0`–`108`) returned `ALL PASS`** (`exit 0`).
- Covers `messages` (encrypted shape, sender-key enforcement, receiver receipts, rate limits), `friendships` (requests, removal, ignore blocks, cancel sent request), `hangouts` (one pending per pair, guarded transitions, rate limits), `profiles`/`avatars`, `user_keys`, `contact_groups`/`ignored_users`, `ANON`/privileges, and `realtime.messages` presence policies.
- Active `pg_cron` jobs (`purge_undelivered_messages` and `expire_pending_hangouts`) verified `succeeded` in `cron.job_run_details`.

## 3. Automated two-user checks (`T1`–`T15`, issue `#7` & `#10`)

User A runs in the real Buzz desktop app (WebView2 on Windows, WebKitGTK on
Linux), and user B runs the static `out/` export in headless Chrome against the
hosted Supabase project.

| Target | Notes | Result |
| --- | --- | --- |
| Linux (`main` `6fcb9ca`, 5x consecutive `E2E_FRESH=1`) | Fresh accounts created per run (`a0912c`, `6ae678`, `488efb`, `7af15b`, `71f5eb`); `T5` keychain readable from both Buddy List and chat on all 5 runs | **15/15 PASS** (5/5 runs) |
| Windows CI `45630265349` (`6fcb9ca`, fresh throwaways) | Includes Preferences & `Allow Buzz!` toggles (`T13`–`T15`) | **15/15 PASS** |
| Windows CI `45631553402` (`6fcb9ca`, fixed CI secrets) | Reused fixed CI accounts `073a09`; zero new `auth.users` rows created | **15/15 PASS** |

Checks `T1`–`T15` verify: presence (`Online`/`Busy`/`Available`/`Offline`), real
chat window creation + OS keychain readiness (`T5`), encrypted message delivery &
history across reconnects (`T6`–`T8`, `T12`), Buzz! delivery (`T9`), resilience
across B disconnect/reconnect (`T10`–`T11`), single-instance Preferences window
(`T13`), live `Show Timestamps` updates across open windows (`T14`), and live
`Allow Buzz!` drop & restore (`T15`).

## 4. Hosted interactive `buzz-trigger` & Safety Number checks (`mkeozqwudranxrdferai`)

Executed with real desktop Buzz + headless Chrome against hosted Supabase:

| Check | Result | Detail |
| --- | --- | --- |
| `E6` Safety Number | PASS | Identical 30-digit Safety Number displayed on A and B |
| `B1` Up for Chat | PASS | A toggles Up for Chat -> B sees `up for chat` and `Say hi` button |
| `B2`–`B3` Hangouts | PASS | B sends `"Just talk for a bit?"` -> A accepts -> `[Name] accepted: ...` shown on both |
| `B6` Recent Buzzes | PASS | A opens Recent Buzzes -> `Nudge back` delivers `BUZZ!!!` to B |
| `B7` Buzz rate limit | PASS | `Buzz again in` 10s cooldown + 6th-in-10m `"Wait a moment before Nudging again"` |
| `B8` Offline disable | PASS | Closing B disables `BUZZ!` and `Hangout` on A with offline reason |
| `B10` Ignore List | PASS | B ignores A -> focus refresh disables `BUZZ!`/`Hangout` on A -> `Stop Ignoring` restores |

## 5. What fixes shipped in `0.1.4` (since `v0.1.3`)

- Async OS keychain Tauri commands (`src-tauri/src/key_store.rs`), write read-back verification (`lib/crypto/identity.ts`), owner retry + `localStorage` readiness signal (`lib/crypto/useMyKeys.ts`), and bounded key wait before send (`components/chat/ChatWindow.tsx`) — resolves `#7`.
- First-sight friend key trust now pins the friend's currently published `user_keys` row (ADR 0010 Option 1, `lib/crypto/trust.ts`) — resolves `#8`.
- Preferences window (`Messenger > Preferences...`) with live setting sync across open windows and Buzz! options (`#10`).
- Automated `T13`–`T15` E2E coverage and optional fixed CI account secrets (`E2E_A_*` / `E2E_B_*`, `#11`).

## 6. Manual checks still required on `0.1.4` installer

| # | Check | Target | Status |
| --- | --- | --- | --- |
| W1–W5 | Install `.exe`, Buddy List, Buzz! shake + sound, close/relaunch single instance, tray Exit, cancel sent request (`#5`) | Windows PC | NOT RUN |
| B4–B5, B9, N1–N3 | Desktop audio & visual window shake, 15-min Hangout expiry, Linux/Windows/macOS Now Playing (`#13`) | Desktop | NOT RUN |
| M1 | First run of `.dmg` installers (`#9`) | macOS | NOT RUN |
