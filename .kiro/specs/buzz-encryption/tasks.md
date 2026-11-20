# Implementation Plan: Encrypted Messages

Rules: one task at a time, in order. After each task run `tsc --noEmit`, lint, and tests. `[~]` means code done, two-user check still open.
Calendar: today is 20 Nov 2026. Freeze 1 Dec, submit 4 Dec. If the freeze comes first, keep Phase 0 and drop the rest. Do not claim encryption in that case.

## Phase 0. Security hardening (E0)

- [ ] 0.1 Migration `...001300_privacy_hardening.sql`: `profiles` select limited to self, accepted friends, pending parties; `avatar_url` check; drop `avatars_read_all`. Extend `test:rls`: a stranger sees only themselves, cannot list avatars, cannot set a foreign avatar URL. _E0.1 to E0.3_
- [ ] 0.2 Content Security Policy in `src-tauri/tauri.conf.json`; check the app still loads Supabase, avatars, fonts. _E0.4_
- [ ] 0.3 README and ADR 0003: say plainly that presence is public and spoofable. _E0.5_
- [ ] Checkpoint: commit.

## Phase 1. Keys (E1)

- [ ] 1.1 Approve and add the libsodium package (name it, say why). `lib/crypto/box.ts`, `payload.ts` with unit tests: round trip, wrong key fails, 1000 character limit, size limit. _E1, E2.6_
- [ ] 1.2 `lib/crypto/safetyNumber.ts` and `trust.ts` with unit tests. _E3_
- [ ] 1.3 Approve and add the keychain package. `keyStore.ts` for desktop and dev. Check on Linux, Windows, macOS. _E1.2, E1.3_
- [ ] 1.4 Migration `...001400_user_keys.sql`, `keys.ts`, create and publish on first open. Extend `test:rls`: friend reads key, stranger cannot, nobody writes another's key. _E1.1, E1.4_
- [ ] Checkpoint: commit.

## Phase 2. Send and read (E2)

- [ ] 2.1 Migration `...001500_encrypted_messages.sql` written but not applied. Extend `test:rls`. _E2.1, E4.2_
- [ ] 2.2 Encrypt on send and decrypt on read in `api.ts`, `conversation.ts`, `chat.ts`, `ChatWindow`. Unreadable-row line. Old rows unchanged. _E2.1, E2.2, E2.7_
- [ ] 2.3 "Say hi" uses the same encrypt step. Block with "[Name] hasn't set up encryption yet." _E2.3, E2.5_
- [ ] 2.4 Two-user check: send, reload history, Offline Message on return, sender rereads own message.
- [ ] Checkpoint: commit. Release the app, then apply 2.1.

## Phase 3. Trust and wording (E3, E4)

- [ ] 3.1 Key-changed warning and confirm in the chat; Safety Number on the friend profile. _E3_
- [ ] 3.2 Two-user check: reset one account's key, the other sees the warning and the Safety Numbers differ.
- [ ] 3.3 README, in-app text and submission text use only the sentence in product steering. Add Hangouts-style note on what is not hidden. _E4.3_
- [ ] 3.4 Add ADR link and the glossary terms to the README status table. Commit.
