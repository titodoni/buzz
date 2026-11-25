# Test report: Buzz 0.1.3 beta

Build: tag `v0.1.3`, commit `c0af424` (25 Nov 2026). Installers are attached to
the **draft** release on GitHub; it is not public yet.

Results are **PASS**, **FAIL**, or **NOT RUN**. A row is PASS only if someone saw
it work. Nothing below was run on Windows or macOS yet.

## Summary

| Area | Result |
| --- | --- |
| Code checks (types, lint, unit tests, Rust tests) | PASS |
| CI build of all installers (Windows, macOS x2, Linux) | PASS |
| Database security rules (RLS) on the hosted project | PASS (105/109, the 4 misses are test-script issues, fixed) |
| Friend requests and accept, two accounts, Linux desktop app | PASS (tester: Tito, 25 Nov, on 0.1.2) |
| Windows desktop app | NOT RUN on 0.1.3. On 0.1.2 it FAILED (see "Bugs fixed") |
| macOS desktop app | NOT RUN |

**Beta decision:** do not publish 0.1.3 until section 4 (Windows) has been run
and every row is PASS.

## 1. Code checks

Run on the `v0.1.3` tag in a clean checkout of that commit.

| Check | Result | Detail |
| --- | --- | --- |
| `tsc --noEmit` | PASS | no errors |
| `eslint .` | PASS | no errors |
| `vitest run` | PASS | 60 files, 393 tests |
| `cargo fmt --check`, `cargo clippy` | PASS | no warnings |
| `cargo test` | PASS | 23 passed, 1 ignored |

## 2. CI

| Workflow | Run | Result |
| --- | --- | --- |
| `ci` on `main` (`c0af424`) | 45563045460 | PASS |
| `beta-build` on `v0.1.3` | 45563049976 | PASS |

Installers built: `Buzz_0.1.3_x64-setup.exe`, `Buzz_0.1.3_x64_en-US.msi`,
`Buzz_0.1.3_aarch64.dmg`, `Buzz_0.1.3_x64.dmg` (plus `.app.tar.gz` for each),
`Buzz_0.1.3_amd64.deb`, `Buzz_0.1.3_amd64.AppImage`, `Buzz-0.1.3-1.x86_64.rpm`.
Built by CI only; none is code signed (see `docs/beta-install.md`).

## 3. Database security rules (hosted project `mkeozqwudranxrdferai`)

All checks from `supabase/tests/rls-check.mjs`, plus two new ones for cancelling a
friend request, ran on 25 Nov as SQL through the Supabase MCP, inside one
transaction that was rolled back. Afterwards no test users or rows were left.

| Group | Result |
| --- | --- |
| Messages: only friends read and write, no forging, receiver can only mark read | PASS |
| Friend requests: re-request after removal, ignore blocks requests, declined waits an hour | PASS |
| Cancel a sent request (new): sender can, receiver cannot | PASS |
| Groups and Ignore List: owner only, friends only | PASS |
| Profiles and avatars: strangers see nobody, avatar must be in your own folder | PASS |
| Public keys: friends read, only the owner writes | PASS |
| Encrypted Messages shape rules | PASS |
| Hangouts: parties only, one pending per pair, guarded answers | PASS |
| Rate limits: messages, Hangouts, friend requests | PASS |
| Presence topics: only you track yours | PASS |

Total 109 checks, 105 passed. The 4 that did not:

- 2 checks expected a "check constraint" error, but the newer sender-key
  check refused the row first. The database refused the bad row in both
  cases, which is the right outcome.
- 2 name-search checks found 2 people instead of 1, because a real user on the
  hosted project also has "ann" in their name.

All 4 were test-script problems, fixed in `c1288a9`. Not re-run since.

## 4. Windows, two accounts: TO RUN before publishing

Tester fills this in. Use the draft release's `Buzz_0.1.3_x64-setup.exe`. Account
A on Windows, account B on Linux or a second Windows PC.

| # | Do this | Pass when | Result | Notes |
| --- | --- | --- | --- | --- |
| W1 | A double-clicks B in the Buddy List. | A chat window opens with B's name and the message box, not an empty box. | NOT RUN | |
| W2 | A sends B a message, B replies. | Each side reads the other's message. | NOT RUN | |
| W3 | B signs out, then signs back in, while A's app runs. | A sees B go Offline, then Online again; A's app never freezes; the "is now online" popup appears and goes away. | NOT RUN | |
| W4 | After W3, A opens B's chat. | It opens normally (not an empty box). | NOT RUN | |
| W5 | A clicks BUZZ! in the chat. | B's chat shakes with "BUZZ!!!" and a sound. | NOT RUN | |
| W6 | A closes the Buddy List (X), then starts Buzz from the Start menu. | The same Buddy List comes back; no second copy, no freeze. | NOT RUN | |
| W7 | A picks Exit from the tray icon, then starts Buzz again. | Buzz starts normally and A is still signed in. | NOT RUN | |
| W8 | B sends A a friend request; A cancels a request A sent to someone else. | A can Accept B's request; the cancelled one disappears from A's list. | NOT RUN | |

## 5. Bugs fixed in 0.1.3

| Bug (reported on 0.1.2) | Cause | Fix | Verified |
| --- | --- | --- | --- |
| Windows: chat window does not open, or opens as an empty box and hangs | Chat and popup windows were created in synchronous Rust commands, which deadlock on Windows (Tauri documents this) | Both commands are `async` (`a2d2d96`) | Code review and Rust tests only; W1, W4 |
| Windows: friend shows Offline after coming back online | The "is now online" popup hit the same deadlock and froze the Buddy List | Same fix | W3 |
| Windows: app hangs when started again after exit | The frozen app never quit, so a new start waited on it | Same fix, plus single instance (`762ce75`) | W6, W7 |
| Starting Buzz again opened a second copy on the same account | No single-instance guard | `tauri-plugin-single-instance` 2.5.5 (`762ce75`) | Linux: second start exited, first kept running. Windows: W6 |
| No way to take back a friend request you sent | The database only let the receiver change it | Migration `20261125120000` (applied to hosted) and a Cancel button (`b9b1334`) | RLS checks PASS; W8 |
| Search offered Add for an ignored person who had sent a request, and Add then failed | Search hid their request | Search shows "Ignored" (`b9b1334`) | Code review only |
| Sign-up stuck after picking a picture that can't be used | The old error kept blocking submit | Error clears on submit (`a8ae23f`) | Unit tests only |
| Sign-up gave no message when the picture upload failed | Nothing carried the message to Profile | Profile shows it once (`a8ae23f`) | Unit tests only |

## 6. Not in this build

- Preferences window and Buzz! options (`f87f493`): built after the tag, not yet
  checked between two running apps. Goes into a later release.
- macOS: built by CI, never run.
- Now Playing on Windows and macOS: written, never run.
- The automated two-user browser check (task 29.1): not written. It would drive
  the app in a browser, not the desktop app, so it would not catch Windows bugs
  like the ones above.
