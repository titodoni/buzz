# Requirements: Buzz Trigger

Source of truth for wording and edge cases: [spec.md](./spec.md) (copy of
`docs/buzz-trigger-spec.md`). This file restates the requirements as
acceptance criteria so tasks can cite them. Steering, `GLOSSARY.md`, and
ADRs 0001 to 0009 win over this spec on conflict.

## Goal

Give Buzz a reason to open: "I want to know who is here right now."
Positioning line: *WhatsApp is for sending messages. Buzz is for meeting
people.* Every requirement serves one of three triggers: (1) bored and want
to talk, (2) want to do something now, (3) pulled in by a Nudge.

Deadline: submit 4 Dec 2026.

## R1. Buddy List sorted by Presence

1. WHEN the Buddy List opens, THEN friends inside each Group are ordered Available, Away, Busy, Offline, then by Display Name.
2. WHEN at least one friend is online, THEN the header shows "N online now". Invisible friends count as Offline.
3. WHEN friends exist and none is online, THEN the list shows "No one is around right now." and no green dot. It must not show when the list is empty for another reason (no friends, search with no match, Show Offline off).
4. WHEN a friend's Presence changes, THEN the list re-sorts within 2 seconds with no polling.

## R2. Up for Chat

1. WHEN the user taps "Up for Chat", THEN Status becomes "Up for chat, say hi!", Presence becomes Available, and friends see the row highlighted.
2. WHEN the user taps it again or 60 minutes pass, THEN the previous Status is restored (empty if none). If the user changed Status or Presence meanwhile, the timer does nothing.
3. WHEN a friend is Up for Chat, THEN their row shows "Say hi". One tap opens the Chat Window and sends "Hi! Saw you're up for chat :)" through the normal Message path. A second tap within 60 seconds only opens the window.
4. No new column. Start time lives in `localStorage`; on next start, a state older than 60 minutes is cleared.

## R3. Hangout

1. The Chat Window header has a Hangout button with templates "Play a game?", "Just talk for a bit?", "Study together?", "Hop in a call elsewhere?", and one custom field (max 60 characters).
2. WHEN a Hangout is sent, THEN the friend sees a banner at the top of the Buddy List and the Chat Window within 2 seconds, with Accept and Decline.
3. WHEN accepted, THEN the Chat Window opens and both see "[Name] accepted: <text>".
4. WHEN declined, THEN the banner goes away and the sender sees only "Hangout declined".
5. WHEN unanswered for 15 minutes, THEN it expires on both sides and the sender sees "Hangout expired".
6. WHEN a Hangout is pending for the pair, THEN no second one can be sent (enforced by the database), and the button says why.
7. WHEN the friend is Busy, THEN they still receive it and the sender sees "Your friend is busy".
8. WHEN the friend is Offline, THEN the button is disabled with the reason.

## R4. Nudge, extended

1. WHEN a Nudge arrives on `inbox:<userId>`, THEN it is added to Recent Nudges and the friend's row shakes.
2. WHEN the Chat Window cannot open or take focus, THEN the row shows a red count badge that clears when that chat opens.
3. The bell in the Buddy List header opens Recent Nudges: last 10, newest first, sender, time, "Nudge back". Empty: "No Nudges yet. Nudge a friend first."
4. "Nudge back" is a normal Nudge (same cooldown, same Offline rule).
5. WHEN the user has sent 5 Nudges in 10 minutes to anyone, THEN the next is blocked with "Wait a moment before Nudging again". The 10 second per-friend cooldown stays.
6. The log and the limit live in `localStorage`. They are not secure against a modified client and the UI and docs must not call them enforced.

## R5. Now Playing and Status as conversation starters

1. WHEN a friend has Now Playing, THEN the row shows it under the name, cut to 40 characters for display. The stored limit stays 140.
2. WHEN a Chat Window opens, THEN its header shows the friend's Now Playing.

## R6. Safety and privacy

1. Only the two people in a Hangout can read it (RLS, same pattern as `messages`).
2. A user on someone's Ignore List, or a removed friend, cannot send that person a Hangout or Nudge (ADR 0009 helper).
3. Hangout broadcasts only on private channels.
4. Never claim end-to-end encryption.

## Out of scope

Group chat, calls, mobile, push, feed or recommendations, file sharing,
"last online" history, a `nudges` table, any storage of Nudges on the
server, listening history, Spotify account login or the Spotify Web API.

## R0. Live profile updates (prerequisite)

Today a friend's Status and Now Playing change only reaches the Buddy List
after a reload (old spec task 18.1 is partial). R2 and R7 depend on it.

1. WHEN a friend changes Display Name, Avatar, Status, or Now Playing, THEN the Buddy List row and any open Chat Window header update within 5 seconds, with no reload and no polling (`postgres_changes` on `profiles` UPDATE, filtered to friend ids).

## R7. Automatic Now Playing

Buzz reads what the computer is playing (Spotify, a music player, or a
video in a browser or video player) and puts it in Now Playing.

1. A setting "Share what I'm playing" exists. It is off by default. Nothing is read from the OS while it is off.
2. WHEN it is on and a player starts playing a track, THEN Now Playing becomes "Artist - Title" (or just the title when there is no artist), cut to the 140 character limit, within 5 seconds.
3. WHEN playback pauses or stops for 30 seconds, THEN Now Playing is cleared, or restored to the hand-typed line if there was one.
4. WHEN the user types Now Playing by hand, THEN that line wins until the next track change.
5. Profile writes happen only on a real change, at most once every 10 seconds.
6. Only the artist and title leave the computer. Never file paths, URLs, window titles, or the player's process list.
7. Platform support is stated honestly: Linux (MPRIS) and Windows (system media controls) read any player that reports to the OS. On macOS only Spotify and Apple Music are read, through AppleScript, because macOS 15.4 and later blocks the general now-playing API for third-party apps. Elsewhere the setting is hidden.
8. The friend sees it through R0, with the existing music note. No new column.
