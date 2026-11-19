# Requirements Document

## Introduction

Buzz revives Yahoo Messenger as a native desktop app for Windows,
Linux, and macOS. A signed-in user sees
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
- **Message_Store**: persistent message storage in Supabase Postgres that survives a window reload.
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
2. WHEN a visitor submits the sign-up form with an email in the format local-part@domain and a password between 8 and 128 characters, THE Auth_Service SHALL create a new account and start a session.
3. WHEN a new account is created, THE Profile_Service SHALL create a profile with a Display_Name set to the portion of the email address preceding the @ symbol, up to a maximum of 50 characters, and a default Avatar.
4. WHEN a signed-in user reloads the app window, THE Auth_Service SHALL restore the session and keep the user signed in.
5. WHEN a signed-in user signs out, THE Auth_Service SHALL end the session.
6. WHEN the session ends, THE Buzz SHALL show the sign-in page.
7. WHEN a returning visitor submits the sign-in form with an email and password matching an existing account, THE Auth_Service SHALL authenticate the visitor and start a session.
8. IF a visitor submits the sign-up form with an email not in the format local-part@domain, a password outside 8 to 128 characters, or an email already associated with an existing account, THEN THE Auth_Service SHALL reject the sign-up and indicate the reason for rejection.
9. IF a visitor submits the sign-in form with credentials that do not match an existing account, THEN THE Auth_Service SHALL reject the sign-in and indicate the credentials are invalid.

### Requirement 2: Profile

**User Story:** As a user, I want to edit my profile, so that friends see how I present myself.

#### Acceptance Criteria

1. WHEN a user opens the profile page, THE Profile_Service SHALL present the Display_Name, the Avatar, the Status, and the Now_Playing as editable fields, where the Display_Name accepts at most 50 characters, the Status accepts at most 140 characters, and the Now_Playing accepts at most 140 characters.
2. IF a user saves a profile with a Display_Name that is empty or contains only whitespace, THEN THE Profile_Service SHALL retain the previous Display_Name and display an error message indicating that the Display_Name is required.
3. WHEN a user saves a profile, THE Profile_Service SHALL make the change visible to friends within 5 seconds without reloading the window.
4. WHERE an Avatar is uploaded, THE Profile_Service SHALL accept only an image of at most 2 MB in png, jpeg, or webp format.
5. IF an uploaded Avatar exceeds 2 MB or is not in png, jpeg, or webp format, THEN THE Profile_Service SHALL reject the upload, retain the previous Avatar, and display an error message indicating the size or format constraint.

### Requirement 3: Friends

**User Story:** As a user, I want to find and add friends, so that I can chat with the people I know.

#### Acceptance Criteria

1. WHEN a user searches by email or Display_Name, THE Friend_Service SHALL list at most 50 users whose email or Display_Name contains the search term case-insensitively, excluding the user performing the search.
2. WHEN a user sends a friend request to a recipient who is not already a friend and has no existing pending request, THE Friend_Service SHALL show the request in the recipient's pending list.
3. WHEN a user accepts a friend request, THE Friend_Service SHALL add both users to each other's friend list and remove the request from the recipient's pending list.
4. WHEN a user declines a friend request, THE Friend_Service SHALL remove the request from the recipient's pending list without creating a friendship.
5. WHEN a user removes an existing friend, THE Friend_Service SHALL remove the friendship in both directions and make the chat history for the pair not visible to either user.
6. WHEN two users whose chat history is hidden become friends again, THE Friend_Service SHALL restore the previously hidden chat history for the pair.
7. IF a user sends a friend request to themselves, to an existing friend, or to a recipient who already has a pending request from that user, THEN THE Friend_Service SHALL reject the request with an error indication that the request cannot be sent and shall not create a pending request.

### Requirement 4: Presence

**User Story:** As a user, I want to see who is online, so that I know who is around to talk to.

#### Acceptance Criteria

1. WHILE the app is open and the user has interacted with the app within the last 5 minutes, THE Presence_Service SHALL report the user as online to friends within 5 seconds.
2. WHILE the app is open and the user has had no interaction with the app for 5 minutes, THE Presence_Service SHALL report the user as away to friends within 10 seconds.
3. WHILE a user has set the busy state, THE Presence_Service SHALL report the user as busy to friends within 5 seconds.
4. WHEN a user closes the app, THE Presence_Service SHALL report the user as offline to friends within 30 seconds.
5. WHEN a friend's Presence changes, THE Friend_Service SHALL update the friend list without reloading the window within 5 seconds.
6. IF a user's connection to the Presence_Service is lost without the app being closed, THEN THE Presence_Service SHALL report the user as offline to friends within 60 seconds.

### Requirement 5: 1:1 real-time chat

**User Story:** As a user, I want to chat with a friend in real time, so that the conversation flows.

#### Acceptance Criteria

1. WHEN two friends open a chat, THE Chat_Service SHALL display the most recent 50 messages of the shared message history for the pair.
2. WHILE the friend is connected, WHEN a user sends a message, THE Chat_Service SHALL deliver the message to the friend in under 2 seconds without reloading the window.
3. WHEN a user sends a message that is not rejected, THE Message_Store SHALL store the message so the message survives a window reload.
4. IF a user sends a message that is empty, only whitespace, or longer than 1,000 characters, THEN THE Chat_Service SHALL reject the message, display an error indication to the sender, and not store the message.
5. IF the friend is not connected when a user sends a message, THEN THE Chat_Service SHALL retain the message so it appears in the friend's message history when the friend next opens the chat.
6. WHEN a user opens a chat with a friend, THE Chat_Service SHALL open the conversation in a window separate from the Buddy List window.

### Requirement 6: Nudge

**User Story:** As a user, I want to nudge a friend, so that I can get their attention in a playful way.

#### Acceptance Criteria

1. WHEN a user clicks Nudge in a chat, THE Nudge_Service SHALL shake the friend's chat window for 600 ms and play a sound lasting at most 1 second.
2. WHEN a Nudge is sent, THE Nudge_Service SHALL show a system line "You nudged <Display_Name>" in the chat.
3. WHILE fewer than 10 seconds have passed since the last Nudge in that chat, THE Nudge_Service SHALL disable the Nudge button for that chat until the cooldown ends.
4. IF the friend is offline, THEN THE Nudge_Service SHALL disable the Nudge button and show a message indicating the friend is offline.
5. IF a Nudge cannot be delivered due to a connection failure, THEN THE Nudge_Service SHALL show a message indicating the nudge was not delivered and leave the Nudge button enabled without starting the cooldown.
6. WHEN a Nudge is received while the friend's chat window is closed and the recipient is signed in, THE Nudge_Service SHALL open that chat window and shake it with the Nudge sound.

### Requirement 7: Status and Now_Playing

**User Story:** As a user, I want to set a status and a now playing line, so that friends see my personality.

#### Acceptance Criteria

1. WHEN a user sets a Status message, THE Profile_Service SHALL show the Status under the user's name to friends.
2. WHEN a user sets a Now_Playing line, THE Profile_Service SHALL show the Now_Playing with a music note to friends.
3. IF a user sets a Status or Now_Playing line longer than 140 characters, THEN THE Profile_Service SHALL reject the change, retain the existing Status or Now_Playing value, and display an error message indicating that the line exceeds the 140-character limit.
4. WHEN a user sets an empty Status or Now_Playing line, THE Profile_Service SHALL remove the Status or Now_Playing so that it is no longer shown to friends.

### Requirement 8: Emoticons and Skin

**User Story:** As a user, I want classic emoticons and the YM-era look, so that Buzz feels like the original Messenger.

#### Acceptance Criteria

1. WHEN a user opens the Emoticon picker, THE Emoticon_Service SHALL show a classic-style Emoticon pack of at least 30 Emoticons matching the original Messenger era visual style.
2. WHEN a user picks an Emoticon, THE Emoticon_Service SHALL insert the matching Shortcode at the cursor position in the message box.
3. WHEN a message contains a recognized Shortcode, THE Emoticon_Service SHALL render the Shortcode as the corresponding Emoticon image.
4. WHEN the app loads, THE Buzz SHALL apply the Skin: a purple base color, rounded corners, and a glossy surface highlight, maintaining a minimum text-to-background contrast ratio of 4.5:1.
5. IF a message contains a string matching the Shortcode format but no corresponding Emoticon exists, THEN THE Emoticon_Service SHALL display the string as plain text without rendering an Emoticon image.

### Requirement 9: Offline messages

**User Story:** As a user, I want to send a message to an offline friend, so that the friend receives it when they return.

#### Acceptance Criteria

1. WHEN a user sends a message to an offline friend, THE Offline_Message_Service SHALL store the message.
2. WHEN the offline friend comes online, THE Offline_Message_Service SHALL deliver the stored messages in the chronological order in which they were received.
3. WHEN the recipient opens a stored message, THE Offline_Message_Service SHALL mark the message as read.
4. IF the Offline_Message_Service cannot store the message due to a storage error, THEN THE Offline_Message_Service SHALL return an error message indicating the message was not sent.
5. IF delivery of a stored message fails when the recipient comes online, THEN THE Offline_Message_Service SHALL retain the message for a subsequent delivery attempt.
6. IF stored messages remain undelivered for more than 30 days, THEN THE Offline_Message_Service SHALL delete the stored messages.

### Requirement 10: Typing indicator

**User Story:** As a user, I want to see when a friend is typing, so that I know a reply is coming.

#### Acceptance Criteria

1. WHILE a user is entering text in the chat message input, THE Typing_Indicator SHALL display "<Display_Name> is typing..." to the other participant in the conversation.
2. WHEN the user stops typing for 3 seconds, THE Typing_Indicator SHALL clear the indicator.
3. WHEN the user sends the message, THE Typing_Indicator SHALL clear the typing indicator for the other participant.

### Requirement 11: Responsive window layout

**User Story:** As a user, I want every Buzz window to stay usable at any size I drag it to, so that Buzz fits my screen and my habits.

#### Acceptance Criteria

1. WHEN a user resizes a window anywhere between its minimum size and a maximized window, THE Buzz SHALL keep every control visible and reachable without horizontal scrolling.
2. WHILE a chat window is narrower than 400 px, THE Buzz SHALL hide the pictures column so the conversation keeps the full width.
3. WHILE a window is at least 900 px wide, THE Buzz SHALL limit its content to a readable column of at most 720 px and center that column.
4. WHILE a window is shorter than 340 px, THE Buzz SHALL reduce vertical spacing so the newest message and the message input stay visible.
5. WHEN the Emoticon picker opens in a window narrower than the picker, THE Emoticon_Service SHALL fit the picker inside the window width.
6. IF a Display_Name, Status, or Now_Playing line is longer than the space available, THEN THE Buzz SHALL truncate it with an ellipsis instead of wrapping it or overflowing the window.
