# CTO Technical Debt Register & Delivery Baseline

This record captures deliberate shortcuts, accepted platform constraints, and the single source of truth for delivery tracking through the Kiroween 2026 submission (5 Dec 2026 05:00 WIB / 4 Dec 2026 14:00 PT).

## Deliberate technical debt (financing, not accidental decay)

1. **Static per-user encryption keys without forward secrecy or recovery ([ADR 0010](0010-messages-are-encrypted-with-a-static-key-per-user.md)).**
   - *Trade:* `libsodium` `crypto_box` + OS keychain instead of X3DH/Double Ratchet and cloud key backup.
   - *Interest:* Reinstalling or losing the OS keychain creates a new keypair and leaves older messages unreadable on that device. Peer first-sight trust was updated per Issue `#8` (Option 1) to pin the friend's currently published key (`user_keys`) rather than an older history row.
   - *Paydown:* Post-submission sprint (encrypted key export/recovery first, then ratcheted sessions if needed).
2. **Client-side Nudge rate limits and Recent Nudges ([ADR 0007](0007-nudge-is-a-broadcast-with-client-cooldown.md)).**
   - *Trade:* Ephemeral Realtime broadcasts with `localStorage` cooldowns/5-in-10m limiter and receive-side `INBOUND_MIN_GAP_MS` guard, instead of a `nudges` table.
   - *Interest:* A modified client can still spoof sender or send past client limits; UI and docs never claim server enforcement.
   - *Paydown:* Only if abuse occurs in public beta; would require a rate-limited Edge Function or database relay.
3. **Intentional `SECURITY DEFINER` RPCs and disabled leaked-password protection.**
   - *Context:* Supabase `get_advisors` (`security`) warns on four `SECURITY DEFINER` RPCs (`ignorers_of_me`, `is_friend_of_me`, `is_ignored_by`, `search_users`) and on `auth_leaked_password_protection` being disabled.
   - *Decision:* The four RPCs are intentionally callable by `authenticated` (`anon` and `public` revoked) because they enforce search constraints and RLS helper checks without exposing underlying tables. Enabling HaveIBeenPwned leaked-password protection depends on the hosted Supabase Auth plan/dashboard toggle and is deferred to the owner's Auth settings review.
4. **Cross-OS verification asymmetry (`macOS` and `Now Playing`).**
   - *Context:* `ci.yml` and `beta-build.yml` compile and lint Rust targets for Linux, Windows, and macOS, and `e2e.yml` verifies Windows WebView2 end-to-end. No macOS runtime hardware or WebDriver exists for automated testing (`#9`).
   - *Decision:* Keep Windows/macOS installers honestly marked `"Beta, untested"` on the landing page until human verification passes (`#5`, `#9`), and do not block the Dec 4 submission on macOS verification.
5. **Single live tracker & dependency freeze through Dec 4.**
   - *Context:* Static `.kiro/specs/*/tasks.md` checklists drifted behind git commits and GitHub Issues (`#5`–`#11`).
   - *Decision:* GitHub Issues (`docs/agents/issue-tracker.md`) is the single live task board from `v0.1.3` onward; `.kiro/specs/` remains the architectural/acceptance baseline. Dependabot PRs (`#1`–`#4`, including `#3` `typescript@7.0.2` which fails `ci`) are frozen until after Dec 4 unless a critical security advisory lands.
