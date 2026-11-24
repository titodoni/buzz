# Demo video script (175 seconds)

One night, one trigger: someone is bored and wants to talk. The video shows
only what the two-user check (`docs/two-user-check.md`) proved. If a beat's
gate did not PASS, cut the beat and give its time to the next one. The video
ends at 2:55, because the Devpost limit is "under 3 minutes".

**Setup:** two app windows side by side on one screen, user A on the left and
user B on the right, both signed in as friends. The view is dark and quiet, a
night feel. The Buzz sound is the app's own, and the video has no other
music. No Yahoo name, logo or sound anywhere.

Words in quotes on screen are captions added in editing. The app's own text
stays English, as the spec requires. "Lobby" in the video means the Buddy List,
and "Quick Invite" means the Hangout.

| Time | What the viewer sees | Caption | Gate |
| --- | --- | --- | --- |
| 0:00 to 0:10 | Black screen. Type on it: "It's 11 pm. Nobody to talk to." | | none |
| 0:10 to 0:40 | B opens Buzz. The Buddy List shows "2 online now". A's row is highlighted with "Up for chat, say hi!" and a Say hi button. | "Lagi gabut?" then "See who is around." | check 1 |
| 0:40 to 1:20 | B opens A's chat and taps Hangout, then "Just talk for a bit?". On the left, A's banner appears in the Buddy List. A taps Accept. Both chats show "[Name] accepted: Just talk for a bit?". | "Quick Invite." | checks 2 and 3 |
| 1:20 to 2:15 | A closes the chat and sends a Buzz. B's row shakes and the Buzz sound plays. B opens Recent Buzzes and taps Nudge back, and A's window shakes. | "Buzz!" | checks 4 and 6 |
| 2:15 to 2:25 | Only if check 5 showed the red count appear and clear: B opens the chat and the count clears. Otherwise skip, and give these 10 seconds to the Buzz beat. | | check 5 (only if PASS) |
| 2:25 to 2:45 | Optional, only if N1 to N3 all PASS: B plays a song and A sees it under B's name. Otherwise skip and hold on the closing shot. | "What I'm playing." | N1 to N3 |
| 2:45 to 2:55 | Both windows fade. One line on screen: "WhatsApp is for sending messages. Buzz is for meeting people." and the project name. | | none |

If the optional beats are skipped, the Buzz beat runs to about 2:45.

## What the video does not show or say

- Anything about encryption, unless the rules in `docs/two-user-check.md` have
  been met. Even then, only the one sentence from `.kiro/steering/product.md`.
- Windows or macOS Now Playing. They are not run on those systems.
- Group chat, calls, a feed or files. Buzz has none of them.
- The Ignore List, the 5-per-10-minutes limit message, or the limits of the
  client-side checks.
- A web preview. There isn't one.

## Before recording

1. Run the two-user check and fill in the results table.
2. Rehearse the scenes twice with a timer. The spec says to rehearse twice.
3. Record the screen at 1080p and keep the audio of the Buzz sound audible
   over the voice-over. Check the file is under 3:00, ideally 2:55, before uploading.
4. Upload as a public YouTube video and put the link in the Devpost draft.
