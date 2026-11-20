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

- [~] 2.0 Live profile updates: `useFriendProfiles`, merged into Buddy List and Chat Window header. Closes old task 18.1. Two-user check: Status change shows within 5 seconds. _R0_
- [ ] 2.1 `lib/status/upForChat.ts` with timer, restore rules, stale-on-start clear; unit tests. _R2.2, R2.4_
- [ ] 2.2 Toggle in the Buddy List header; sets Status and Available. _R2.1_
- [ ] 2.3 Highlighted row and "Say hi" button; double-tap guard; message goes through the normal send path. _R2.1, R2.3_
- [ ] 2.4 Two-user check: highlight, Say hi sends once, toggle and timer restore the old Status.
- [ ] Checkpoint: add Up for Chat to `GLOSSARY.md`, commit.

## Phase 3. Hangout: trigger 2 (25 to 28 Nov)

- [ ] 3.1 Migration `hangouts` with RLS, partial unique index, publication, cron expiry. Extend `test:rls`: cross-user read denied, forged `sender_id` fails, second pending fails, ignored sender fails. _R3.6, R6.1, R6.2_
- [ ] 3.2 Regenerate DB types; add `lib/hangout/templates.ts`, `state.ts`, `api.ts` with unit tests (transitions, 15 min expiry on read, line text). _R3.1, R3.5_
- [ ] 3.3 Chat Window Hangout button and `HangoutPicker`: templates, custom field, pending guard, Busy hint, Offline disabled with reason. _R3.1, R3.6 to R3.8_
- [ ] 3.4 `useHangouts` and `HangoutBanner` in Buddy List and Chat Window. Banner within 2 seconds. _R3.2_
- [ ] 3.5 Accept, Decline, expiry, system lines for both sides. Verify all three paths. _R3.3 to R3.5_
- [ ] Checkpoint: Hangout in `GLOSSARY.md`; ADR 0010 "Hangouts are stored, Nudges are not"; commit.

## Phase 4. Nudge, extended: trigger 3 (29 to 30 Nov)

- [ ] 4.1 Pass `receivedAt` from `useNudgeInbox`; row shake; badge when the window cannot take focus. _R4.1, R4.2_
- [ ] 4.2 `lib/nudge/recent.ts` and `RecentNudgesPanel` with the bell; "Nudge back". _R4.3, R4.4_
- [ ] 4.3 `lib/nudge/limiter.ts`, 5 per 10 minutes, message on the sixth. Wire into every Nudge entry point. _R4.5_
- [ ] 4.4 Two-user check with the Chat Window closed; badge clears on open.

## Phase 5. Now Playing: automatic, and as a conversation starter (30 Nov to 1 Dec)

Dependencies approved 20 Nov: `mpris` (Linux only), `windows` (Windows only). macOS needs none.

- [ ] 5.1 40 character display cut in the row; Now Playing in the Chat Window header. _R5_
- [ ] 5.2 `lib/nowPlaying/auto.ts` pure rules with unit tests: format, 140 cut, 30 s pause grace, manual line wins, 10 s write throttle. _R7.2 to R7.5_
- [ ] 5.3 Rust `now_playing` module, Linux first (MPRIS). Commands and `now-playing` event. `cargo fmt`, `cargo clippy`. _R7.2, R7.6_
- [ ] 5.4 Setting "Share what I'm playing" (off by default) and `useAutoNowPlaying` in the Buddy List window. _R7.1, R7.8_
- [ ] 5.5 Two-user check on Linux: play Spotify, then a YouTube video in a browser, then pause. Friend sees each change and the clear. _R7_
- [ ] 5.6 Windows (SMTC) and macOS (AppleScript) readers. Verify on real machines or in CI builds; anything unverified is marked so in the README. _R7.7_

**Feature freeze 1 Dec.** If behind, cut 5.6 first, then 4.2, never 5.3 to 5.5 (the demo uses them).

## Phase 6. Polish and submission (2 to 4 Dec)

- [ ] 6.1 Empty states, Busy hint, no fake green dots. Update `GLOSSARY.md` (Nudge entry, new terms) and README Status table.
- [ ] 6.2 Full verification: `tsc --noEmit`, lint, unit tests, `test:rls`, `cargo clippy`, installers (CI beta build).
- [ ] 6.3 Ten-step checklist in spec.md section 9 with two installed builds, plus: B plays a song, A sees it under B's name.
- [ ] 6.4 Record the under-3-minute demo (spec.md section 11). Rehearse twice.
- [ ] 6.5 Submission text, including how Kiro was used: specs, steering, ADRs, glossary.
- [ ] 6.6 Submit on 4 Dec.
