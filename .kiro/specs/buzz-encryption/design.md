# Design: Encrypted Messages

Decisions and limits: ADR 0010. Requirements: [requirements.md](./requirements.md).

## Principles

- Pure crypto helpers in `lib/crypto/` with unit tests. Components call them, never libsodium directly.
- All Supabase access through the typed client in `lib/supabase/`.
- No homemade cryptography. Use libsodium (`crypto_box`, random nonces) through a vetted package.
- The database cannot check what it cannot read. The app owns text rules.

## Data

Migrations, in order (Hangouts in `buzz-trigger` moved to `...001700`):

1. `...001400_privacy_hardening.sql` (E0): narrower `profiles` select policy, `avatar_url` check, drop `avatars_read_all`.
2. `...001500_user_keys.sql`: table `user_keys (user_id pk references profiles, public_key text not null, created_at)`. RLS: select for self and accepted friends, insert and update only for self. Not added to the Realtime publication: the app reads the key right before every send, so a change is noticed then.
3. `...001600_encrypted_messages.sql`, `...001601_message_sender_key.sql`, `...001602_message_sender_key_required.sql` (additive, applied) and `...001610_require_encrypted_messages.sql` (the cutover, not applied). `...001600` adds: on `messages` add `encrypted boolean not null default false`, `cipher_receiver text`, `cipher_sender text`. Make `body` nullable. Check: an encrypted row has both ciphers, a size limit, and a null body. A plaintext row keeps the old body check. Each encrypted row also carries `sender_public_key`, the key it was made with. The cutover `...001610` makes the insert policy require `encrypted = true`; apply it only after the updated app is released, because it makes old clients fail to send.

Each cipher is `base64(nonce || box)` of a JSON payload `{ body, format }`.

## Modules

| Path | Purpose | Tested |
| --- | --- | --- |
| `lib/crypto/box.ts` | Wrap libsodium: generate keypair, encrypt for a public key, decrypt | yes |
| `lib/crypto/payload.ts` | Payload shape, encode and decode, 1000 character check, size limit | yes |
| `lib/crypto/safetyNumber.ts` | Safety Number from two public keys, same on both sides | yes |
| `lib/crypto/keyStore.ts` | Private key per account id: keychain on desktop, `localStorage` in dev | manual |
| `lib/crypto/trust.ts` | Remember a friend's key, detect a change, record confirmation | yes |
| `lib/crypto/keys.ts` | Create and publish my key, fetch friends' public keys via the typed client | via RLS script |

Changes: `lib/chat/api.ts` (`sendMessage`, history), `lib/chat/conversation.ts`, `lib/realtime/chat.ts` (decrypt on arrival), `ChatWindow`, `FriendList` ("Say hi"), the friend profile dialog (Safety Number).

## Flow: send

1. Check the friend's public key exists and matches the remembered one. If missing, block. If changed and unconfirmed, ask.
2. Build the payload `{ body, format }`, check 1000 characters.
3. Encrypt once to the friend's key and once to my key.
4. Insert one row with the client-made id (ADR 0005), `encrypted = true`, both ciphers, and `delivered_at` as today.

## Flow: read

1. Row arrives (history or `postgres_changes`).
2. If `encrypted`, decrypt the copy for the signed-in user. Failure shows the "can't be read on this device" line.
3. If not encrypted, show as before.

## Risks

- Dependencies: a libsodium package and a keychain package are new. Name each and get approval at its task.
- The webview must run libsodium's WebAssembly on Linux, Windows, macOS. Check on all three before relying on it.
- The cutover migration breaks old app builds. Release the app first.
- A key swap by someone with project write access is only caught through the warning and Safety Number (ADR 0010).
