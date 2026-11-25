# Messages are encrypted with a static key per user

Message bodies are encrypted on the sender's device and decrypted on the friend's device, so the database holds only ciphertext. Each user has one long-lived keypair (libsodium `crypto_box`, X25519), and each message is stored twice in one row: once for the friend and once for the sender so the sender can reread their own history. We chose this over a Double Ratchet because it is a fraction of the code for a one-person project with a fixed deadline.

## What this protects, and what it does not

- It protects message text from anyone who can read the database: a Supabase admin, a leaked backup, a breached project.
- A friend can always read and share what you send. Someone using your unlocked device can read what the app shows.
- Who talks to whom, when, and Presence, Status, Now Playing, Hangouts and the Up for Chat line are not hidden.
- **No forward secrecy.** Whoever steals a user's private key can read every message ever encrypted to it.
- **Key swap.** Public keys are served by the same server. Someone with write access to the project could swap a friend's key. The app remembers each friend's key and warns when it changes, and friends can compare a Safety Number. Without that comparison a swap is only caught if the user notices the warning.
- The 1000 character limit is enforced by the app. The database can only limit the size of the stored payload, because it cannot read the text.

## Decisions that follow

- Each Encrypted Message row carries the sender's public key as it was when the message was sent. A friend who later starts fresh therefore does not make their older messages to you unreadable; only the person who started fresh loses their own history. Authenticity is as strong as the trust in that key (see Key swap above).
- On a computer that has never seen a friend's key yet (no local pin), first-sight trust pins the friend's **currently published key** (`user_keys`) rather than auto-pinning an older key from chat history (Issue `#8`, CTO decision). That matches what sending already does, so newer messages from a reinstalled friend open cleanly while pre-rotation history shows the unverified warning instead of locking out current chat.
- One key per account, kept in the OS keychain on desktop. A new device or reinstall starts a fresh key, and older Encrypted Messages cannot be read there. No recovery in the first version. A recovery file can be added later without changing the message format.
- No plaintext fallback. If a friend has no key yet, or this computer has no keychain, sending is blocked with a clear message. A Linux machine without a Secret Service (gnome-keyring, KWallet) therefore cannot send messages.
- Messages stored before this change stay as they are and are marked not encrypted. They remain readable by anyone with database access. The database refuses new plaintext inserts once the app ships.
- Body and format are encrypted together as one payload.
- Product wording: "Messages are encrypted on your device. Only you and your friend can read them." Buzz makes this claim only after the feature ships and passes the two-user check.
