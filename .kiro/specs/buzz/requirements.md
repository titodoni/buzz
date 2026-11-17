# Requirements Document

## Introduction

Buzz revives Yahoo Messenger for the modern web. A signed-in user sees
which friends are online, sets a Status and a Now_Playing line, and chats
with one friend at a time in real time. The signature interaction is the
Nudge: a shake and a sound sent to a friend's chat window, with a cooldown
that prevents spam. Buzz is built around presence, not content: there is no
feed, no algorithm, no infinite scroll, and no recommendations. Only friends
see each other; there is no public profile and no stranger discovery beyond
a direct friend request. Buzz does not implement end-to-end encryption and
must never claim to.

Out of scope: voice or video calls, group chat, file sharing beyond small
Avatar images, a native mobile app, and any end-to-end encryption claim.

## Glossary

- **Buzz**: the web chat application as a whole.
- **Auth_Service**: email authentication and session management, backed by Supabase Auth.
- **Profile_Service**: manages a user's Display_Name, Avatar, Status, and Now_Playing.
- **Friend_Service**: user search, friend requests, and the friend list.
- **Presence_Service**: live presence state over a Supabase Realtime channel; states are online, away, busy, and offline. Presence is never stored in Postgres.
- **Chat_Service**: one-to-one real-time messaging between two friends.
- **Message_Store**: persistent message storage in Supabase Postgres that survives a page reload.
- **Nudge_Service**: sending, rendering, and cooldown of a Nudge.
- **Emoticon_Service**: the Emoticon picker and Shortcode-to-image rendering.
- **Typing_Indicator**: a real-time broadcast event showing that a friend is typing.
- **Offline_Message_Service**: stores a message when the recipient is offline and delivers the stored messages when the recipient returns.
- **Presence**: a friend's live state: online, away, busy, or offline.
- **Status**: a short custom message shown under a friend's name.
- **Now_Playing**: a manually typed song or artist line shown like a Status, with a music note.
- **Nudge**: a shake plus a sound sent to one chat window, with a cooldown.
- **Offline_Message**: a chat message sent while the friend is offline, delivered when the friend returns.
- **Display_Name**: the name shown for a user.
- **Avatar**: a small profile image.
- **Skin**: the YM-era visual theme: purple, rounded corners, slightly glossy, with readable contrast.
- **Emoticon**: a classic-style image rendered from a Shortcode.
- **Shortcode**: a text token such as `:)` that maps to an Emoticon image.

## Requirements

### Requirement 1: Email sign-in

**User Story:** As a visitor, I want to sign in and sign up with an email and password, so that I can use Buzz.

#### Acceptance Criteria

1. WHEN a visitor opens the app, THE Buzz SHALL show a sign-in page with an email field, a password field, and a sign-up link.
2. WHEN a new user submits the sign-up form with a valid email and password, THE Auth_Service SHALL create a new account.
3. WHEN a new account is created, THE Profile_Service SHALL create a profile with a default Display_Name derived from the email prefix and a default Avatar.
4. WHEN a signed-in user reloads the page, THE Auth_Service SHALL restore the session and keep the user signed in.
5. WHEN a signed-in user signs out, THE Auth_Service SHALL end the session.
6. WHEN the session ends, THE Buzz SHALL show the sign-in page.

### Requirement 2: Profile

**User Story:** As a user, I want to edit my profile, so that friends see how I present myself.

#### Acceptance Criteria

1. WHEN a user opens the profile page, THE Profile_Service SHALL allow editing the Display_Name, the Avatar, the Status, and the Now_Playing.
2. WHEN a user saves a profile with an empty Display_Name, THE Profile_Service SHALL keep the previous Display_Name and show an error.
3. WHEN a user saves a profile, THE Profile_Service SHALL make the change visible to friends without a page reload.
4. WHERE an Avatar is uploaded, THE Profile_Service SHALL accept only an image of at most 2 MB in png, jpeg, or webp format.

### Requirement 3: Friends

**User Story:** As a user, I want to find and add friends, so that I can chat with the people I know.

#### Acceptance Criteria

1. WHEN a user searches by email or Display_Name, THE Friend_Service SHALL list matching users, excluding the user performing the search.
2. WHEN a user sends a friend request, THE Friend_Service SHALL show the request in the other user's pending list.
3. WHEN a user accepts a friend request, THE Friend_Service SHALL add both users to each other's friend list.
4. WHEN a user declines a friend request or removes a friend, THE Friend_Service SHALL remove the friendship and hide the chat history for the pair until the users are friends again.

### Requirement 4: Presence

**User Story:** As a user, I want to see who is online, so that I know who is around to talk to.

#### Acceptance Criteria

1. WHILE a user is active in the app, THE Presence_Service SHALL report the user as online to friends.
2. WHILE a user has had no activity for 5 minutes, THE Presence_Service SHALL report the user as away to friends.
3. WHILE a user has set the busy state, THE Presence_Service SHALL report the user as busy to friends.
4. WHEN a user closes the app, THE Presence_Service SHALL report the user as offline to friends within 30 seconds.
5. WHEN a friend's Presence changes, THE Friend_Service SHALL update the friend list without a page reload.

### Requirement 5: 1:1 real-time chat

**User Story:** As a user, I want to chat with a friend in real time, so that the conversation flows.

#### Acceptance Criteria

1. WHEN two friends open a chat, THE Chat_Service SHALL show the shared message history for the pair.
2. WHEN a user sends a message, THE Chat_Service SHALL deliver the message to the friend in under 2 seconds without a page reload.
3. WHEN a message is sent, THE Message_Store SHALL store the message so the message survives a page reload.
4. WHEN a user sends a message that is empty or only whitespace, THE Chat_Service SHALL reject the message.

### Requirement 6: Nudge

**User Story:** As a user, I want to nudge a friend, so that I can get their attention in a playful way.

#### Acceptance Criteria

1. WHEN a user clicks Nudge in a chat, THE Nudge_Service SHALL shake the friend's chat window for 600 ms and play a sound lasting at most 1 second.
2. WHEN a Nudge is sent, THE Nudge_Service SHALL show a system line "You nudged <Display_Name>" in the chat.
3. WHILE fewer than 10 seconds have passed since the last Nudge, THE Nudge_Service SHALL disable the Nudge button until the cooldown ends.
4. WHERE the friend is offline, THE Nudge_Service SHALL disable the Nudge button and show a reason.

### Requirement 7: Status and Now_Playing

**User Story:** As a user, I want to set a status and a now playing line, so that friends see my personality.

#### Acceptance Criteria

1. WHEN a user sets a Status message, THE Profile_Service SHALL show the Status under the user's name to friends.
2. WHEN a user sets a Now_Playing line, THE Profile_Service SHALL show the Now_Playing with a music note to friends.
3. WHEN a Status or a Now_Playing line is longer than 140 characters, THE Profile_Service SHALL reject the change and show an error.

### Requirement 8: Emoticons and Skin

**User Story:** As a user, I want classic emoticons and the YM-era look, so that Buzz feels like the original Messenger.

#### Acceptance Criteria

1. WHEN a user opens the Emoticon picker, THE Emoticon_Service SHALL show a classic-style Emoticon pack.
2. WHEN a user picks an Emoticon, THE Emoticon_Service SHALL insert the matching Shortcode at the cursor position in the message box.
3. WHEN a message contains a Shortcode, THE Emoticon_Service SHALL render the Shortcode as the Emoticon image.
4. WHEN the app loads, THE Buzz SHALL apply the Skin: purple, rounded corners, slightly glossy, with readable contrast.

### Requirement 9: Offline messages

**User Story:** As a user, I want to send a message to an offline friend, so that the friend receives it when they return.

#### Acceptance Criteria

1. WHEN a user sends a message to an offline friend, THE Offline_Message_Service SHALL store the message.
2. WHEN the offline friend comes online, THE Offline_Message_Service SHALL deliver the stored messages.
3. WHEN the recipient opens a stored message, THE Offline_Message_Service SHALL mark the message as read.

### Requirement 10: Typing indicator

**User Story:** As a user, I want to see when a friend is typing, so that I know a reply is coming.

#### Acceptance Criteria

1. WHILE a user types in a chat, THE Typing_Indicator SHALL show "<Display_Name> is typing..." to the friend.
2. WHEN the user stops typing for 3 seconds, THE Typing_Indicator SHALL clear the indicator.
