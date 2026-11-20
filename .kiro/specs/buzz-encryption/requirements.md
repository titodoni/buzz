# Requirements: Encrypted Messages

Decisions: [ADR 0010](../../../docs/adr/0010-messages-are-encrypted-with-a-static-key-per-user.md).
Terms: Encrypted Message, Safety Number in `GLOSSARY.md`. Steering and ADRs win over this spec on conflict.

## Goal

The database never holds readable message text for new messages. Only the two friends can read them.

Deadline context: today is 20 Nov 2026, feature freeze 1 Dec, submit 4 Dec. This spec is built after the `buzz-trigger` phases and the security hardening in Phase 0 of `tasks.md`, if time allows. Buzz claims encryption only if it ships and passes the two-user check (product steering).

## E0. Security hardening first (no encryption yet)

1. WHEN a signed-in user reads `profiles`, THEN they see only themselves, their accepted friends, and people with a pending request to or from them. Friend search still works (it is a security-definer function).
2. WHEN a user saves `avatar_url`, THEN the database accepts only `/avatars/...` or this project's Storage avatar URL.
3. WHEN a client lists the `avatars` bucket, THEN it gets nothing. Public image URLs still load.
4. The Tauri app ships with a Content Security Policy instead of `null`.
5. The README and ADR 0003 say plainly that `presence:global` is public: strangers can see which user ids are online, and presence can be spoofed.

## E1. Keys

1. WHEN a user opens the updated app and has no key for their account, THEN a keypair is made and the public key is stored for friends to read.
2. The private key stays on the device (OS keychain on desktop). It is kept per account id and survives sign-out.
3. WHEN the app runs in a plain browser (development only), THEN the key may live in `localStorage` and the app does not claim encryption.
4. Only the owner can write their public key. Only the owner and their accepted friends can read it.

## E2. Sending and reading

1. WHEN a user sends a Message, THEN the app encrypts body and format together, once for the friend and once for the sender, and stores both copies in one row. The database never receives the text.
2. WHEN a Chat Window loads history or receives a new row, THEN it decrypts the copy meant for the signed-in user. Rows from before this change show as before.
3. "Say hi" in the Buddy List window uses the same encrypt step.
4. Offline Messages keep working: the row waits as ciphertext and the friend decrypts it on return.
5. WHEN the friend has no public key yet, THEN sending is blocked and the chat says "[Name] hasn't set up encryption yet."
6. The 1000 character limit is checked in the app. The database limits only the stored payload size.
7. WHEN a row cannot be decrypted (for example after a fresh start on a new device), THEN the chat shows "This message can't be read on this device." and nothing else.

## E3. Trust

1. WHEN a friend's public key differs from the one the app remembered, THEN the chat shows "[Name]'s key changed" and asks the user to confirm before the next send.
2. The friend's profile shows a Safety Number that both friends can compare out loud.

## E4. Cutover and claims

1. Messages stored before this change stay as they are, marked not encrypted.
2. After the app ships, the database refuses new plaintext inserts.
3. The submission text, README and in-app wording use only the sentence in product steering. They also say who talks to whom, when, Presence, Status and Now Playing are not hidden.

## Out of scope

Forward secrecy, key recovery, several devices per account, encrypting Status, Now Playing, Up for Chat or Hangout text, attachments.
