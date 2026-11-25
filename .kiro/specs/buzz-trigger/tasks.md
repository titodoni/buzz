# Implementation Plan: Buzz Trigger

Rules: one task at a time, in order. After each task run `tsc --noEmit`,
lint, and tests, then verify with two users in two running app instances.
If a check fails, fix that task before moving on. Task 1 of spec.md is
already done (spec.md section 12).

Calendar: today is 20 Nov 2026. Submit on 4 Dec. Feature freeze 1 Dec.
`[~]` means code done, two-user check still open.

## Phase 0. Setup (20 Nov)

- [x] 0.1 Add `.kiro/specs/buzz-trigger/` (spec, requirements, design, tasks). `.kiro` is not in `.gitignore`.
- [x] 0.2 Create two test accounts that are friends. Confirm two app instances run side by side.

## Phase 1. Presence-first Buddy List: trigger 1 (20 to 21 Nov)

- [x] 1.1 Sort Available, Away, Busy, Offline, name; `countOnline` helper; unit tests. _R1.1, R1.2_
- [x] 1.2 "N online now" line above the groups in `FriendList`. _R1.2_
- [x] 1.3 "No one is around right now." when friends exist, none online, and no search is active. _R1.3_
- [x] 1.4 Two-user check: change Presence, list re-sorts within 2 seconds; count and empty state follow. _R1.4_
- [x] Checkpoint: commit.

## Phase 2. Live profiles and Up for Chat: triggers 1 and 2 (22 to 24 Nov)

- [~] 2.0 Live profile updates: `useProfileUpdates` (`lib/friends/profileFeed.ts`), merged into Buddy List and Chat Window header. Closes old task 18.1. Two-user check: Status change shows within 5 seconds. _R0_ Realtime path checked 20 Nov by script with two test accounts (Status 498 ms, Now Playing 303 ms); in-app UI check still open.
- [x] 2.1 `lib/status/upForChat.ts` with timer, restore rules, stale-on-start clear; unit tests. _R2.2, R2.4_
- [x] 2.2 Toggle in the Buddy List header; sets Status and Available. _R2.1_
- [x] 2.3 Highlighted row and "Say hi" button; double-tap guard; message goes through the normal send path. _R2.1, R2.3_
- [~] 2.4 (local-stack check `1` passed in `docs/two-user-check.md` on `8395cd2`; hosted-DB two-user check still open) Two-user check: highlight, Say hi sends once, toggle and timer restore the old Status.
- [x] Checkpoint: Up for Chat added to `GLOSSARY.md`.

## Phase 3. Hangout: trigger 2 (25 to 28 Nov)

- [x] 3.1 (25 Nov: applied to the project with the MCP, history row `20250101001700` recorded; 25 checks run as rolled-back SQL through the MCP and all pass; `get_advisors` shows no new security finding. `npm run test:rls` itself not run, no database URL) Migration `hangouts` with RLS, partial unique index, publication, cron expiry. Extend `test:rls`: cross-user read denied, forged `sender_id` fails, second pending fails, ignored sender fails. _R3.6, R6.1, R6.2_
- [x] 3.2 (`templates.ts`, `state.ts`, `api.ts`, 29 unit tests; types match the live schema) Regenerate DB types; add `lib/hangout/templates.ts`, `state.ts`, `api.ts` with unit tests (transitions, 15 min expiry on read, line text). _R3.1, R3.5_
- [~] 3.3 (Built, checked on local stack in `docs/two-user-check.md` steps 2, 3, 8, 9, 10; hosted-DB check still open) Chat Window Hangout button and `HangoutPicker`: templates, custom field, pending guard, Busy hint, Offline disabled with reason. _R3.1, R3.6 to R3.8_
- [~] 3.4 (Built, checked on local stack in `docs/two-user-check.md` step 2; hosted-DB check still open) `useHangouts` and `HangoutBanner` in Buddy List and Chat Window. Banner within 2 seconds. _R3.2_
- [~] 3.5 (Built, checked on local stack in `docs/two-user-check.md` steps 3, 9; decline and hosted-DB check still open) Accept, Decline, expiry, system lines for both sides. Verify all three paths. _R3.3 to R3.5_
- [x] Checkpoint (glossary and ADR 0011 written; commit pending the migration check): Hangout in `GLOSSARY.md`; ADR 0011 "Hangouts are stored, Nudges are not" (0010 is encryption); commit.

## Phase 4. Nudge, extended: trigger 3 (29 to 30 Nov)

- [~] 4.1 (Built, checked on local stack in `docs/two-user-check.md` steps 4–5; hosted-DB check and Windows/macOS focus still open) Pass `receivedAt` from `useNudgeInbox`; row shake; badge when the window cannot take focus. _R4.1, R4.2_
- [~] 4.2 (`recent.ts` done with 14 unit tests; panel built and checked on local stack step 6; hosted-DB check still open) `lib/nudge/recent.ts` and `RecentNudgesPanel` with the bell; "Nudge back". _R4.3, R4.4_
- [~] 4.3 (`limiter.ts` done with 8 unit tests; wired into the button, Ctrl+G, Actions > Buzz! and Nudge back; checked on local stack step 7; hosted-DB check still open) `lib/nudge/limiter.ts`, 5 per 10 minutes, message on the sixth. Wire into every Nudge entry point. _R4.5_
- [~] 4.4 (local-stack Xvfb check passed in `docs/two-user-check.md` step 5; hosted-DB check still open) Two-user check with the Chat Window closed; badge clears on open.

## Phase 5 (moved ahead of Phase 2.1 on 20 Nov, at your request). Now Playing: automatic, and as a conversation starter (30 Nov to 1 Dec)

Dependencies approved 20 Nov: `mpris` (Linux only), `windows` (Windows only). macOS needs none.

- [x] 5.1 40 character display cut in the row; Now Playing in the Chat Window header. _R5_
- [x] 5.2 `lib/nowPlaying/auto.ts` pure rules with unit tests: format, 140 cut, 30 s pause grace, manual line wins, 10 s write throttle. _R7.2 to R7.5_
- [x] 5.3 Rust `now_playing` module, Linux first (MPRIS). Commands and `now-playing` event. `cargo fmt`, `cargo clippy`. _R7.2, R7.6_
- [x] 5.4 Setting "Share what I'm playing" (off by default) and `useAutoNowPlaying` in the Buddy List window. _R7.1, R7.8_
- [~] 5.5 (20 Nov, Linux: test player shown within 5 s, cleared 30 s after stop, Spotify shown 1 s after play; YouTube in a browser not checked yet) Two-user check on Linux: play Spotify, then a YouTube video in a browser, then pause. Friend sees each change and the clear. _R7_
- [~] 5.6 (Written. Windows: compiles and passes clippy for the Windows target, NOT RUN on Windows. macOS: the reader compiles and passes clippy in isolation and the output parser is unit-tested; the full macOS build and `osascript` are NOT RUN on a Mac. The CI beta build compiles both; running them needs a real machine) Windows (SMTC) and macOS (AppleScript) readers. Verify on real machines or in CI builds; anything unverified is marked so in the README. _R7.7_

**Feature freeze 1 Dec.** If behind, cut 5.6 first, then 4.2, never 5.3 to 5.5 (the demo uses them).

## Phase 6. Polish and submission (2 to 4 Dec)

- [~] 6.1 Empty states, Busy hint, no fake green dots. `GLOSSARY.md` (`Up for Chat`, `Recent Nudges`, updated `Nudge`) and `docs/development.md` updated; live release/submission tracking moved to GitHub Issues (`docs/agents/issue-tracker.md`).
- [~] 6.2 Automated gates green (`tsc --noEmit`, lint, Vitest 61 files, Cargo fmt/clippy/test, `beta-build.yml`, 109 RLS checks); `test:rls` re-run and final `v0.1.4` release build still needed after sprint fixes.
- [ ] 6.3 Ten-step checklist in spec.md section 9 with two installed builds on the **hosted** project (`docs/two-user-check.md` passed 1–10 on local stack `8395cd2`; hosted run + N1–N3 + audio/shake still open).
- [ ] 6.4 Record the under-3-minute demo (spec.md section 11). Rehearse twice.
- [ ] 6.5 Submission text, including how Kiro was used: specs, steering, ADRs, glossary.
- [ ] 6.6 Submit on 4 Dec.
