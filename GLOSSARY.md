# Buzz

A Yahoo Messenger–style desktop chat app where who is around matters more than what was said. Only friends see each other, and talk happens one-to-one.

## People and friendship

**Friend**:
Another user you are connected with; only friends see each other's presence, profile, and chat.
_Avoid_: Contact, buddy, connection

**Friend Request**:
An invitation from one user to another to become friends; it is pending until the other person accepts or declines it. Either person may send a new request after a decline or a removal.
_Avoid_: Invite, add request

**Group**:
A named, collapsible section of the Buddy List that one user keeps their friends in. Groups are private to the user who made them.
_Avoid_: Folder, category, list

**Hangout**:
A one-line invitation from one friend to another, such as "Play a game?". It is pending until the friend accepts or declines it, and expires after 15 minutes. Unlike a Nudge it is stored (ADR 0011). Only one can be pending between two friends.
_Avoid_: Invite, game request, call

**Ignore List**:
The people a user has blocked from messaging, Nudging, or requesting them.
_Avoid_: Block list, blacklist

**Buddy List**:
The home window listing your friends with their presence, status, and now playing.
_Avoid_: Contact list, friend list (for the window), home screen

## Presence

**Presence**:
A friend's live availability: Available, Away, Busy, or Offline. It is never history; only the current state exists. Invisible is how a user chooses to appear, and friends see it as Offline.
_Avoid_: Online status, activity

**Available**:
Signed in and active recently.
_Avoid_: Online (as a user-facing word), active

**Away**:
Signed in but with no activity for five minutes.
_Avoid_: Idle, inactive

**Busy**:
A state the user chooses to say "don't expect a quick reply"; it stays until the user picks Available or signs off, even while they keep working. Picking a Preset Status or a Busy custom status also sets it.
_Avoid_: Do not disturb, DND

**Offline**:
Not signed in or not reachable.
_Avoid_: Signed out

**Invisible**:
A way of signing in or staying signed in where every friend sees you as Offline while you still see them. Only the user sees their own Invisible state.
_Avoid_: Stealth, hidden

**Status Icon**:
The small picture for an Availability, used identically in the Buddy List, chat windows, and the tray.
_Avoid_: Presence dot, smiley, emoticon (an Emoticon is a different thing, inside messages)

**Preset Status**:
One of the ready-made Status lines (Be Right Back, Not at My Desk, Not in Office, On the Phone, On Vacation, Out to Lunch, Stepped Out); each sets the user Busy.
_Avoid_: Away message, canned status

## Profile

**Display Name**:
The name friends see for you.
_Avoid_: Username, nickname, screen name

**Avatar**:
The small picture friends see next to your name.
_Avoid_: Display image, profile picture

**Status**:
A short line you write about yourself that friends see under your name, such as "Out to Lunch".
_Avoid_: Status message, mood, bio

**Now Playing**:
A line you type about the song or artist you're listening to, shown with a music note.
_Avoid_: Current song, music status

## Conversation

**Chat Window**:
The window holding the one-to-one conversation with one friend; each friend gets their own.
_Avoid_: IM window, conversation tab, DM

**Message**:
Text one friend sends another in a chat window, possibly containing emoticons.
_Avoid_: IM, chat (as a noun for one message)

**Encrypted Message**:
A Message that only the two friends can read; what Buzz keeps on its servers is unreadable. It hides what was said, not who spoke to whom or when, and not Presence, Status, or Now Playing. If a user starts fresh on a new device, their old Encrypted Messages can no longer be read there.
_Avoid_: Secure message, private message, E2E message

**Safety Number**:
A short code on a friend's profile that two friends can compare out loud to confirm nobody has swapped the key their Encrypted Messages use. If a friend's key changes, the chat says so and asks you to confirm before sending.
_Avoid_: Fingerprint, security code, key hash

**Offline Message**:
A message sent while the friend was offline; it waits and reaches them when they come back.
_Avoid_: Queued message, pending message

**Nudge**:
A playful attention-getter sent to a friend: their chat window pops open if it was closed, shakes, and makes a sound, then the sender must wait before nudging again. The on-screen label is "Buzz!".
_Avoid_: Buzz (in specs and code), poke, ping

**Typing Indicator**:
The line telling you a friend is currently writing to you.
_Avoid_: Typing notification

## Look and feel

**Emoticon**:
A small smiley picture shown in place of a shortcode in a message.
_Avoid_: Emoji, smiley, sticker

**Shortcode**:
The characters that stand for an emoticon, such as `:)`.
_Avoid_: Emoticon code, text face

**Toast**:
A small notice at the bottom-right of the screen, such as "Ann is now online".
_Avoid_: Popup, notification

**Skin**:
The overall YM-era look: purple glossy title bars, light-gray windows, classic smiley status icons.
_Avoid_: Theme

**IMVironment**:
An optional decorative backdrop behind a chat window's conversation.
_Avoid_: Chat background, wallpaper
