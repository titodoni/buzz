# Test report: Buzz 0.1.3 beta

Build: tag `v0.1.3`, commit `c0af424` (25 Nov 2026). Installers are attached to
the **draft** release on GitHub; it is not public yet.

Results are **PASS**, **FAIL**, or **NOT RUN**. A row is PASS only if a person
or the automated check (section 4) saw it work. Nothing was run on macOS.

## Summary

| Area | Result |
| --- | --- |
| Code checks (types, lint, unit tests, Rust tests) | PASS |
| CI build of all installers (Windows, macOS x2, Linux) | PASS |
| Database security rules (RLS) on the hosted project | PASS (105/109, the 4 misses are test-script issues, fixed) |
| Friend requests and accept, two accounts, Linux desktop app | PASS (tester: Tito, 25 Nov, on 0.1.2) |
| Two-user check, Windows desktop app, automated (section 4) | PASS on 0.1.3 (12/12). The same check on 0.1.2 FAILED at the chat window, the bug you reported |
| Two-user check, Linux desktop app, automated | PASS (12/12, three runs in a row) |
| Windows by a person: relaunch, tray Exit, shake and sound, installer | NOT RUN (section 5) |
| macOS desktop app | NOT RUN |

**Beta decision:** the Windows bugs reported on 0.1.2 are fixed in 0.1.3 as far
as an automated check can show. Before publishing, one person should still run
section 5 once on a real Windows PC with the installer.

## 1. Code checks

TypeScript checks were run on a clean checkout of the `v0.1.3` tag. Rust checks
were run on `762ce75`, whose Rust code is the same as the tag's (the release
commit only changed version numbers).

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

## 4. Two-user check, automated (`e2e/two-user.mjs`)

User A runs in the real Buzz desktop app, driven by a WebDriver (msedgedriver on
Windows, tauri-driver on Linux), so A's chat windows are real app windows. User
B runs the same web files in headless Chrome. Both sign in to the hosted
Supabase project with throwaway accounts. How to run it: `e2e/README.md`.

| Run | Build tested | Platform | Result |
| --- | --- | --- | --- |
| GitHub Actions `e2e` 45591478640 | `v0.1.3` | Windows (windows-latest, WebView2) | **12/12 PASS** |
| GitHub Actions `e2e` 45593115100 | `v0.1.2` | Windows | **4/12**: FAIL at T5, the chat window opened blank ("A blank") and never loaded |
| GitHub Actions `e2e` 45591489592 | `main` (`ae70b4c`, includes Preferences) | Windows | 12/12 PASS |
| This computer, three runs in a row | `main` | Linux (Ubuntu 26.04, WebKitGTK) | 12/12 PASS each time |

The 0.1.2 run shows the check catches the bug you reported, and the 0.1.3 run
shows the fix.

Steps of each run:

| # | Step | 0.1.3 on Windows |
| --- | --- | --- |
| T1 | B opens Buzz and sees A in the Buddy List | PASS |
| T2 | A opens the desktop app, signs in, the Buddy List loads | PASS |
| T3 | Each sees the other Online | PASS |
| T4 | A sets Busy, B sees Busy; A goes back to Available | PASS |
| T5 | A double-clicks B: a real chat window opens and loads | PASS (0.4 s) |
| T6 | A sends a message; B's Buddy List shows "1 waiting" | PASS |
| T7 | B opens the chat and reads A's message (encrypted, then decrypted) | PASS |
| T8 | B replies; A's open chat shows it | PASS |
| T9 | A clicks BUZZ!; B's chat shows "BUZZ!!!" | PASS |
| T10 | A closes the chat; B quits; A sees B Offline and the app still answers | PASS |
| T11 | B comes back; A sees B Online, the "is now online" popup opens, no freeze | PASS |
| T12 | A opens B's chat again and sees both earlier messages | PASS |

Not covered by the automated check: the shake you see and the sound you hear,
the tray icon and its Exit, starting Buzz a second time, the installer itself,
and the friend-request Cancel button (its database rule is covered in section 3).

## 5. Windows by a person: still to do once

Use the draft release's `Buzz_0.1.3_x64-setup.exe` on a real Windows PC.

| # | Do this | Pass when | Result | Notes |
| --- | --- | --- | --- | --- |
| W1 | Install with the `.exe`, start Buzz, sign in. | The Buddy List shows your friends. | NOT RUN | |
| W2 | A clicks BUZZ! in a chat with B. | B's chat window shakes and plays the sound. | NOT RUN | Delivery is covered by T9 |
| W3 | A closes the Buddy List (X), then starts Buzz from the Start menu. | The same Buddy List comes back; no second copy, no freeze. | NOT RUN | |
| W4 | A picks Exit from the tray icon, then starts Buzz again. | Buzz starts normally and A is still signed in. | NOT RUN | |
| W5 | A cancels a friend request A sent. | It disappears from A's list. | NOT RUN | |

## 6. Bugs fixed in 0.1.3

| Bug (reported on 0.1.2) | Cause | Fix | Verified |
| --- | --- | --- | --- |
| Windows: chat window does not open, or opens as an empty box and hangs | Chat and popup windows were created in synchronous Rust commands, which deadlock on Windows (Tauri documents this) | Both commands are `async` (`a2d2d96`) | Automated check T5, T12 on Windows: PASS on 0.1.3, FAIL on 0.1.2 |
| Windows: friend shows Offline after coming back online | The "is now online" popup hit the same deadlock and froze the Buddy List | Automated check T10, T11 on Windows: PASS |
| Windows: app hangs when started again after exit | The frozen app never quit, so a new start waited on it | Same fix, plus single instance (`762ce75`) | Section 5, W3 and W4 |
| Starting Buzz again opened a second copy on the same account | No single-instance guard | `tauri-plugin-single-instance` 2.5.5 (`762ce75`) | Linux: second start exited, first kept running. Windows: section 5, W3 |
| No way to take back a friend request you sent | The database only let the receiver change it | Migration `20261125120000` (applied to hosted) and a Cancel button (`b9b1334`) | RLS checks PASS; section 5, W5 |
| Search offered Add for an ignored person who had sent a request, and Add then failed | Search hid their request | Search shows "Ignored" (`b9b1334`) | Code review only |
| Sign-up stuck after picking a picture that can't be used | The old error kept blocking submit | Error clears on submit (`a8ae23f`) | Unit tests only |
| Sign-up gave no message when the picture upload failed | Nothing carried the message to Profile | Profile shows it once (`a8ae23f`) | Unit tests only |

## 7. Not in this build

- Preferences window and Buzz! options (`f87f493`): built after the tag, not yet
  checked between two running apps. Goes into a later release.
- macOS: built by CI, never run.
- Now Playing on Windows and macOS: written, never run.

## 8. Found by the automated check, after 0.1.3

- On Linux, a chat window opened right after a first sign-in on a new computer
  twice showed "Your encryption key isn't ready yet" and could not send. Seen in
  2 of 5 first sign-ins on this computer, once before and once after a change
  on `main` (`8738dae`) that makes the chat window keep looking for the key for
  a minute. So that change is not proven to fix it, and the cause is not
  confirmed. It was not seen in the 4 Windows runs, which are all first
  sign-ins. A restart of Buzz clears it.
- Open question, not fixed: a computer that has never seen a friend's key
  trusts the first key it finds in the chat history, which can be an old one.
  If that friend has since changed keys (new computer, reinstall), newer
  messages then show "came with a key you haven't checked". It needs a decision
  on the trust rule (docs/adr/0010) before a fix.
