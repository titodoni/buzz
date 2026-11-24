# Two-user check

The gate before any encryption claim, the public repo, and the demo video.
Nothing in the app's client logic changes until this is done. Fill in the
results table at the bottom and keep the rows honest: **PASS**, **FAIL**, or
**NOT RUN**. Never tick a row you did not see work.

## Set up two instances on one Linux computer

Two copies of the app share one set of saved sign-ins unless each gets its own
data folder. The folders below keep user A and user B apart. Each user's
encryption key still lands in the OS keychain, keyed by account, so they do not
clash.

1. Build the app once. `--debug --no-bundle` makes a runnable binary with the
   web files inside it (a plain `cargo build` would look for the dev server):

   ```sh
   npm run tauri build -- --debug --no-bundle
   ```

2. Start user A and user B, each in its own terminal:

   ```sh
   # A
   mkdir -p ~/.buzz-test/a/{data,config,cache}
   XDG_DATA_HOME=$HOME/.buzz-test/a/data XDG_CONFIG_HOME=$HOME/.buzz-test/a/config \
     XDG_CACHE_HOME=$HOME/.buzz-test/a/cache src-tauri/target/debug/buzz

   # B
   mkdir -p ~/.buzz-test/b/{data,config,cache}
   XDG_DATA_HOME=$HOME/.buzz-test/b/data XDG_CONFIG_HOME=$HOME/.buzz-test/b/config \
     XDG_CACHE_HOME=$HOME/.buzz-test/b/cache src-tauri/target/debug/buzz
   ```

3. Sign A in with `BUZZ_TEST_A_*` and B with `BUZZ_TEST_B_*` from
   `.env.test.local` (git-ignored). If they are not friends yet, send a request
   from one and accept it in the other.
4. Put the two Buddy Lists side by side. Both users need to be signed in on a
   desktop with a keychain (the browser has none, so Encrypted Messages are
   off there and cannot be tested in a browser tab).

When done, delete `~/.buzz-test` to remove both test profiles.

### Running against a local database

To test without touching the hosted project, start the local stack
(`supabase/README.md`, "Local stack"), create two users and make them friends,
put the local URL and key in `.env.local`, then build the app in step 1. The app's
Content Security Policy only allows the hosted project, so a build for the local
stack must also allow `127.0.0.1:54321`. Pass an override at build time and leave
`tauri.conf.json` alone. Save this as `/tmp/tauri-local.json`:

```json
{"app":{"security":{"csp":{
"img-src":"'self' data: blob: http://127.0.0.1:54321",
"connect-src":"'self' ipc: http://ipc.localhost http://127.0.0.1:54321 ws://127.0.0.1:54321"}}}}
```

Then build with `npm run tauri build -- --debug --no-bundle --config /tmp/tauri-local.json`.
Without it, sign-in fails with "Something went wrong. Please try again." Delete
`.env.local` and rebuild without the override before any shipping build.

## Checks

### A. Encrypted Messages (buzz-encryption 2.4 and 3.2)

| # | Do this | Pass when |
| --- | --- | --- |
| E1 | A sends B a message. | B reads it in the open chat. |
| E2 | B closes the chat and reopens it, then reloads the Buddy List. | The history is still readable on both sides. |
| E3 | Sign B out. A sends a message. Sign B back in. | B gets the Offline Message and can read it. |
| E4 | A rereads the message A sent. | A can read their own sent message. |
| E5 | Reset B's key (see the Safety Number or key-changed text in the chat). | A sees the key-changed warning and must confirm before sending. |
| E6 | Compare the Safety Numbers on A and on B. | They match before the reset and differ after it. |

### B. The ten steps from `buzz-trigger` spec section 9

| # | Do this | Pass when |
| --- | --- | --- |
| 1 | A taps "Up for Chat". | B sees A highlighted with "Up for chat, say hi!". |
| 2 | B opens A's chat and picks the Hangout "Just talk for a bit?". | A sees the banner in the Buddy List within 2 seconds. |
| 3 | A taps Accept. | Both see "[Name] accepted: Just talk for a bit?". |
| 4 | A closes the chat and Nudges B. | B's row shakes and B hears the sound. |
| 5 | B opens the chat. | The red count clears. See the note below. |
| 6 | B opens Recent Buzzes and taps "Nudge back". | A receives it. |
| 7 | A Nudges B repeatedly. | The 10 second cooldown shows between tries, and the sixth Buzz within 10 minutes is blocked with the limit message. |
| 8 | B signs off. | A sees B go Offline, and the Buzz and Hangout buttons are disabled with a reason. |
| 9 | B returns. A sends a Hangout and B does nothing for 15 minutes. | It expires on both sides ("Hangout expired"). |
| 10 | B puts A on the Ignore List. | A cannot send B a Hangout or a Buzz. |

Note on step 5: the red count appears only when B's chat window could not take
focus after the Buzz opened it. On a desktop that gives the window focus there
is no count to clear, and that is correct. Record **PASS** only if you saw it
appear and clear. Record **N/A (window took focus)** if it never appeared, and
do not show a badge in the video.

### C. Now Playing on Linux (buzz-trigger 5.5)

| # | Do this | Pass when |
| --- | --- | --- |
| N1 | B turns on Messenger, Share What I'm Playing, and plays Spotify. | A sees the song under B's name within about 5 seconds. |
| N2 | B plays a YouTube video in a browser. | A sees the video title. |
| N3 | B pauses and waits 30 seconds. | A sees it clear. |

## Results

Date: 24 Nov 2026  Tester: Kiro (automated), on the local Supabase stack  Commit: 8395cd2

How this run was done: both app instances ran on a private virtual screen
(Xvfb `:99`, no window manager), driven by xdotool. Every row below was
checked with a screenshot of the app and, where it applies, a query on the
local database. Nothing that needs ears or a moving picture was judged.

| Check | Result (PASS / FAIL / NOT RUN / N/A) | Notes |
| --- | --- | --- |
| E1 | PASS | B read "E1 secret from a". The stored row had no body, two 223-character ciphers, and a sender key. |
| E2 | PASS | B's chat closed, the whole app restarted, chat reopened: history readable. |
| E3 | PASS | B signed out; A's message was stored encrypted and undelivered; after B signed in it was delivered and readable. |
| E4 | PASS | A's chat showed A's own sent messages in plain text. |
| E5 | PASS | B's private key was removed from the keychain (as on a new computer) and B restarted with a new key. A's next send was refused (no row written) with "b's key changed. Check the Safety Number, then confirm to keep chatting." After "I checked it. Trust the new key." the next message went through and B read it. B's old messages show "This message can't be read on this device", which is expected. |
| E6 | PASS | Before: both sides showed 07757 64660 79738 78844 65523 72207. After: both showed 33282 24628 11930 78379 78400 54132. |
| 1 | PASS | B saw A highlighted with "Up for chat, say hi!" and a Say hi button. |
| 2 | PASS | A's Buddy List showed "b wants to hang out: Just talk for a bit?". Screenshot taken 3 s after sending, so "within 2 seconds" was not measured exactly. |
| 3 | PASS | Both chats showed "a accepted: Just talk for a bit?". |
| 4 | PASS (delivery only) | B's chat opened by itself with "BUZZ!!!". The shake and the sound were not judged; a person must watch and listen once. |
| 5 | PASS | The red count 1 appeared on B's row (no window manager, so the window could not take focus) and cleared when B opened the chat. |
| 6 | PASS | B's Recent Buzzes listed A; "Nudge back" reached A ("BUZZ!!!" in A's chat). |
| 7 | PASS | "Buzz again in 8s" after each Buzz; the 6th within 10 minutes showed "Wait a moment before Nudging again" and sent nothing. |
| 8 | PASS | A saw B Offline; BUZZ! and Hangout disabled with "Your friend is offline." and "b is offline, so a Hangout can't be sent." |
| 9 | PASS | Hangout sent 14:21:26 and left alone; at 14:37 the row was `expired` and both chats showed "Hangout expired"; B's banner was gone. |
| 10 | PASS | After B ignored A, A saw B Offline with BUZZ! and Hangout disabled, and no Hangout row was written. Ignore was removed afterwards. |
| N1 | NOT RUN | Needs Spotify playing on this computer. |
| N2 | NOT RUN | Needs a browser video. |
| N3 | NOT RUN | Depends on N1. |

Also checked in this run, after the Tauri permission fix (249f260):

| Check | Result | Notes |
| --- | --- | --- |
| "is now online" toast | PASS | A got "b is now online, Click to say hi" when B signed in. |
| Incoming message opens a closed chat | PASS | B's chat window opened by itself when A's E1 message arrived. |
| Away after idle | PASS | Both users switched to the Away icon after about 5 idle minutes. |
| Tray icon follows status | NOT RUN | The virtual screen has no tray. |
| Buzz shake and sound | NOT RUN | Needs a person to watch and listen. |

Not covered by this run: the hosted database. E1 to E6 passed on the local
stack with the cutover migration applied there. The hosted project has the same migration
(applied as version 20261124082027). Run `npm run test:rls` against it before any claim.

## What the result decides

- **E1 to E6 all PASS:** apply `20261124082027_require_encrypted_messages.sql`
  to the live database, then run the check once more. Only after that may the
  app, README and Devpost use the one sentence in
  `.kiro/steering/product.md`. Say nothing else about encryption.
- **Any E row FAIL or NOT RUN:** make no encryption claim anywhere. Submit
  without it.
- **Any B row FAIL:** fix that task and rerun from that row. Do not move on.
- **N1 to N3:** the Linux Now Playing beat may go in the video only if all
  three PASS.
