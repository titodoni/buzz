# Reply to the CTO audit report

**To:** CTO
**Re:** Buzz Official Technical Documentation & Kiroween 2026 Audit Report (written at commit `40a4316`)
**State of the repo when this was written:** `main` at `27cd213`. CI was green on all four jobs on that commit: web checks, and the Rust shell on Linux, Windows and macOS.

## 1. What changed since your report

| Commit | Change |
| --- | --- |
| `bb983b4` | Now Playing on Windows and macOS. The Windows reader uses the system media controls (SMTC). The macOS reader asks Spotify and Apple Music only, through `osascript`. The app's wording says what each system reads. |
| `94425e0` | Repo compliance. MIT `LICENSE`. `.github/workflows/ci.yml` runs typecheck, lint, Vitest, `cargo fmt`, clippy and `cargo test` on Linux, Windows and macOS. `supabase/.temp/cli-latest` and the old spec zip are no longer tracked. |
| `27cd213` | CI fix. The first macOS run failed on two macOS-only clippy lints in the new reader. Both are fixed. This was the first time the Windows and macOS code built natively. |

The suite is now 53 test files and 353 tests (the report counted 52 files). The Hangouts database rules (25 checks) are applied and passed on the live project, and `get_advisors` shows no new security finding.

## 2. Your findings, one by one

| Finding | Status |
| --- | --- |
| Private repo | Open on purpose. It stays private until the two-user check (section 4) is done. |
| No LICENSE | Fixed. MIT, copyright Tito Doni. |
| `.kiro/` must stay tracked | Confirmed. It is not git-ignored. |
| Leak check | Done. The full history shows no real secrets and `.env` was never committed. The old zip holds only 11 early spec files. |
| No CI gate | Fixed, except the RLS harness. It needs a real database, so it still runs by hand. |
| Devpost draft drift | Agreed. The rewrite is pending. |
| Client-only nudge limits | Accepted. The limit is documented as a client check in ADR 0007. A receiver-side circuit breaker would help, because the receiving client is the one that shakes. It is still a client check. |
| No key backup or forward secrecy | Accepted. Planned after submission. |
| Large UI files, storage-event sync, window cap, signed releases, no E2E tests | Accepted as post-submission work (roughly your Sprints 2 and 3). |
| Tracked scratch files | Fixed. The auto-updater and notarization are post-submission. |

## 3. Where we disagree

1. **The encryption claim.** The report says encryption is implemented and enforced in the database (`001610`) and advises highlighting it in the Devpost text. Today:
   - `…001610_require_encrypted_messages` is **not applied** to the live database, so the database still accepts plaintext messages.
   - The two-user encryption checks (tasks 2.4 and 3.2 in `.kiro/specs/buzz-encryption/tasks.md`) have **not been run**.
   - Product steering forbids any encryption claim until those pass. After that, only one fixed sentence is allowed.
   - So the draft's "never claim E2EE" is correct for now. It is not drift. The report's jury answer 3, which cites `001610` as proof, would be false today.
2. **"Implemented" for several features.** Hangouts, Nudge extended and Now Playing are built and unit-tested. None has been checked in two running apps. The Windows and macOS Now Playing readers compile in CI, but nobody has played a song on those systems yet.
3. **A live web preview.** The report suggests deploying one. Tech steering says no Vercel and no web build, so the plan is a release link and installers. We have not verified what the Devpost form requires.
4. **The jury scores** (9.5/10 and similar) are estimates with no evidence behind them. We plan around the checklist, not the numbers.

## 4. Open items and risks

1. **The two-user check has not been run.** It decides whether encryption may be claimed at all. It also covers Hangouts, Nudge and Now Playing on Linux (task 5.5). It needs two app instances and the two test accounts.
2. **`001610`** is applied only if that check passes.
3. **Devpost:** the draft is at 2 of 5 steps. The live URL, video and testing instructions are missing.
4. **Kiro write-up:** three answers are still needed from the owner: Kiro CLI or Crew use, MCP use, and Antigravity use.
5. **Windows and macOS Now Playing** are untested on real machines.

## 5. Questions for the CTO

1. Do you agree we make no encryption claim until the two-user check passes and `001610` is applied? If the check fails, do we submit without the claim?
2. Should the receiver-side nudge throttle be built before submission, or after?
3. Is an installer link acceptable for the Devpost "Live URL" field?
4. Should the repo go public right after the two-user check, or earlier, so the license and CI are visible sooner?
5. Do you want a fixed 180-second video script before we record? Which features must appear, given that only checked ones should?
6. If time gets short, what do we cut first: Windows and macOS Now Playing, Hangouts polish, or the web preview?

**What do you need from us?**
