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

Date: ______  Tester: ______  Commit: ______

| Check | Result (PASS / FAIL / NOT RUN / N/A) | Notes |
| --- | --- | --- |
| E1 | | |
| E2 | | |
| E3 | | |
| E4 | | |
| E5 | | |
| E6 | | |
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |
| N1 | | |
| N2 | | |
| N3 | | |

## What the result decides

- **E1 to E6 all PASS:** apply `20250101001610_require_encrypted_messages.sql`
  to the live database, then run the check once more. Only after that may the
  app, README and Devpost use the one sentence in
  `.kiro/steering/product.md`. Say nothing else about encryption.
- **Any E row FAIL or NOT RUN:** make no encryption claim anywhere. Submit
  without it.
- **Any B row FAIL:** fix that task and rerun from that row. Do not move on.
- **N1 to N3:** the Linux Now Playing beat may go in the video only if all
  three PASS.
