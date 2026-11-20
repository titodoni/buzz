# Implementation Plan: Encrypted Messages

Rules: one task at a time, in order. After each task run `tsc --noEmit`, lint, and tests. `[~]` means code done, two-user check still open.
Calendar: today is 20 Nov 2026. Freeze 1 Dec, submit 4 Dec. If the freeze comes first, keep Phase 0 and drop the rest. Do not claim encryption in that case.

## Phase 0. Security hardening (E0)

- [x] 0.1 (applied 20 Nov to project mkeozqwudranxrdferai via MCP; the 10 checks passed in a rolled-back transaction; also `…001401` revokes `handle_new_user` from anon and authenticated) Migration `...001400_privacy_hardening.sql`: `profiles` select limited to self, accepted friends, pending parties; `avatar_url` check; drop `avatars_read_all`. Extend `test:rls`: a stranger sees only themselves, cannot list avatars, cannot set a foreign avatar URL. _E0.1 to E0.3_
- [x] 0.2 (policy builds; headless Chrome shows no violations and a control shows violations are detected; a real signed-in window is still to be checked in the next two-user run) Content Security Policy in `src-tauri/tauri.conf.json`; check the app still loads Supabase, avatars, fonts. _E0.4_
- [x] 0.3 README and ADR 0003: say plainly that presence is public and spoofable. _E0.5_
- [x] Checkpoint: commit.

## Phase 1. Keys (E1)

- [x] 1.1 `libsodium-wrappers` 0.8.4 approved and added (ships its own types). `lib/crypto/box.ts`, `payload.ts`, `message.ts` with 23 unit tests: round trip, wrong key and tampering fail, 1000 character limit, worst-case size fits `MAX_CIPHER_LENGTH` (6000), two copies. CSP gained `'wasm-unsafe-eval'` (checked in headless Chrome: fails without it, works with it). _E1, E2.6_
- [x] 1.2 `lib/crypto/safetyNumber.ts` and `trust.ts` with unit tests. _E3_
- [~] 1.3 `keyring` 4.2.0 approved and added. Rust `key_store.rs` (4 commands, account and key validation, no file fallback, only the Buddy List and chat windows have permission), `lib/tauri/keyStore.ts`, `lib/crypto/keyStore.ts`. `cargo fmt`, `cargo clippy` clean; real round trip passed on Linux with gnome-keyring (`cargo test key_store -- --ignored`). Not checked: Windows, macOS, and a call from a running app window. _E1.2, E1.3_
- [x] 1.4 (applied; 9 key-table checks passed in a rolled-back transaction) Migration `...001500_user_keys.sql`, `keys.ts`, create and publish on first open. Extend `test:rls`: friend reads key, stranger cannot, nobody writes another's key. _E1.1, E1.4_
- [x] Checkpoint: commit.

## Phase 2. Send and read (E2)

- [x] 2.1 (additive `...001600`, `...001601`, `...001602` applied and checked; found and fixed a null gap in the sender key check; the cutover `...001610` is written but NOT applied, and its SQL was not run on the cloud project because the client cancelled the confirmation) Extend `test:rls`. _E2.1, E4.2_
- [x] 2.2 Encrypt on send and decrypt on read in `api.ts`, `conversation.ts`, `chat.ts`, `ChatWindow`. Unreadable-row line. Old rows unchanged. _E2.1, E2.2, E2.7_
- [x] 2.3 "Say hi" uses the same encrypt step. Block with "[Name] hasn't set up encryption yet." _E2.3, E2.5_
- [ ] 2.4 NOT RUN, needs two running app instances: Two-user check: send, reload history, Offline Message on return, sender rereads own message.
- [x] Checkpoint: commit. Release the app, then apply 2.1.

## Phase 3. Trust and wording (E3, E4)

- [x] 3.1 Key-changed warning and confirm in the chat; Safety Number on the friend profile. _E3_
- [ ] 3.2 NOT RUN, needs two running app instances: Two-user check: reset one account's key, the other sees the warning and the Safety Numbers differ.
- [x] 3.3 (README says plainly that nothing is claimed yet) README, in-app text and submission text use only the sentence in product steering. Say what is not hidden. _E4.3_
- [x] 3.4 Link ADR 0010 and add Encrypted Messages to the README status table. Commit.
