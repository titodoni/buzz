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
- **Alert_Service**: sounds, toasts, taskbar flashing, and the tray icon that tell the user something happened while Buzz is in the background.
- **Preferences_Service**: the Preferences window and the per-device settings it saves.
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
- **Availability**: the state a user chose or was given: Available, Busy, Away, Invisible, or Offline.
- **Status_Icon**: the small picture that shows an Availability: a yellow smiley for Available, an orange busy sign for Busy, a clock for Away, and a faded smiley for Offline.
- **Preset_Status**: one of the ready-made status lines: Be Right Back, Not at My Desk, Not in Office, On the Phone, On Vacation, Out to Lunch, Stepped Out.
- **Group**: a named, collapsible section of the Buddy List that one user keeps their friends in.
- **Ignore_List**: the people a user has blocked.
- **Toast**: a small notice that slides in at the bottom-right of the screen.

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

### Requirement 12: Availability and Status_Icon

**User Story:** As a user, I want my Availability to change my icon everywhere, so that friends can tell whether to expect a reply.

#### Acceptance Criteria

1. THE Presence_Service SHALL support the Availability values Available, Busy, Away, Invisible, and Offline.
2. WHEN a user chooses Available or Busy, THE Presence_Service SHALL show the matching Status_Icon for that user in the user's own Buddy List header at once, and in each friend's Buddy List and in the title bar of each chat window with that user within 5 seconds, or within 30 seconds when the user has already changed Availability four times in the last 30 seconds (Supabase allows at most five presence updates per client in 30 seconds).
3. WHEN a user chooses a Preset_Status, THE Profile_Service SHALL set the Status to the Preset_Status text and THE Presence_Service SHALL set the Availability to Busy.
4. WHEN a user saves a custom Status, THE Profile_Service SHALL let the user choose Available or Busy for it and SHALL save the Status text and the Availability together.
5. WHEN a user chooses Available while the Status is a Preset_Status text, THE Profile_Service SHALL clear that Status.
6. WHEN a user signs in, THE Presence_Service SHALL set the user's Availability to Available, or to Invisible when the user chose to sign in as invisible.
7. WHILE a user is Invisible, THE Presence_Service SHALL show the user as Offline to every friend and SHALL keep delivering friends' presence and messages to that user.
8. WHILE a user is Invisible, THE Buzz SHALL show the user's own Status_Icon with a marker that tells the user that friends see them as Offline.
9. THE Buzz SHALL show the same Status_Icon for the same Availability in the Buddy List, in chat window title bars, in chat window headers, and in the tray icon.

### Requirement 13: Sign-in options

**User Story:** As a user, I want to choose how Buzz signs me in, so that I can skip typing and control how I appear.

#### Acceptance Criteria

1. WHEN a user signs in with "Remember my ID" checked, THE Auth_Service SHALL fill in the email on the next start and SHALL NOT store the password.
2. WHEN a user signs in with "Sign in automatically" checked, THE Auth_Service SHALL restore the session on the next start and SHALL skip the sign-in window.
3. WHEN a user signs in with "Sign in automatically" unchecked, THE Auth_Service SHALL require the user to sign in again the next time Buzz starts.
4. WHEN a user signs in with "Sign in as invisible to everyone" checked, THE Presence_Service SHALL start the user as Invisible.
5. WHEN a user chooses "Forgot your password?" and enters an email address, THE Auth_Service SHALL send a recovery email that contains a 6-digit code.
6. WHEN a user enters a valid recovery code and a new password of 8 to 128 characters, THE Auth_Service SHALL set the new password and sign the user in.
7. IF a user enters a wrong or expired recovery code, THEN THE Auth_Service SHALL reject it and show a message that the code did not work.
8. WHEN a user chooses About Buzz from the Messenger menu, THE Buzz SHALL show the version, the copyright line, and a statement that Buzz is not affiliated with Yahoo.

### Requirement 14: Buddy List groups and contacts

**User Story:** As a user, I want my friends sorted into groups I control, so that I can find people quickly.

#### Acceptance Criteria

1. THE Friend_Service SHALL show friends inside collapsible Groups, each headed by the Group name and "(online/total)" counts.
2. WHEN a user creates, renames, or deletes a Group, THE Friend_Service SHALL save the change for that user only.
3. WHEN a user deletes a Group, THE Friend_Service SHALL move that Group's friends to the default Group named "Friends".
4. WHEN a user moves a friend to a Group, THE Friend_Service SHALL show the friend under that Group for that user only.
5. THE Friend_Service SHALL list Available, Busy, and Away friends before Offline friends within each Group.
6. THE Friend_Service SHALL show Available, Busy, and Away friends in bold with their Status_Icon, and Offline friends in normal weight, dimmed.
7. WHEN a user collapses or expands a Group, THE Buzz SHALL remember that state on that device.
8. WHEN a user turns off "Show Offline Contacts", THE Friend_Service SHALL hide Offline friends and SHALL keep the total in each Group's count.
9. WHEN a user types in the Buddy List search box, THE Friend_Service SHALL show only friends whose Display_Name contains the text, ignoring case.
10. WHEN a user types an email address into the search box and presses Enter, THE Friend_Service SHALL open the add-a-friend search with that address filled in.
11. THE Buzz SHALL show an Add a Friend button at the start of the Buddy List toolbar.
12. THE Buzz SHALL show the user's Display_Name, Availability, Status, and Now_Playing in the Buddy List header, with a menu to change the Availability.

### Requirement 15: Ignore list

**User Story:** As a user, I want to block someone, so that they can't bother me.

#### Acceptance Criteria

1. WHEN a user ignores a person, THE Friend_Service SHALL add the person to that user's Ignore_List.
2. WHILE a person is on a user's Ignore_List, THE Chat_Service SHALL reject messages from that person to that user.
3. WHILE a person is on a user's Ignore_List, THE Nudge_Service SHALL drop Nudges from that person to that user.
4. WHILE a person is on a user's Ignore_List, THE Friend_Service SHALL reject friend requests from that person to that user.
5. WHILE a person is on a user's Ignore_List, THE Buzz SHALL show that user as Offline to that person.
6. WHEN a user removes a person from the Ignore_List, THE Friend_Service SHALL let that person contact the user again.
7. THE Buzz SHALL NOT tell a person that they have been ignored.
8. THE Preferences_Service SHALL list the Ignore_List with a Remove button for each person.

### Requirement 16: Incoming messages and alerts

**User Story:** As a user, I want Buzz to tell me when something arrives, so that I don't miss a conversation.

#### Acceptance Criteria

1. WHEN a message arrives from a friend whose chat window is closed, THE Alert_Service SHALL open that chat window behind the other windows without taking keyboard focus, flash its taskbar entry, and play the message sound.
2. WHEN a message arrives in a chat window that is not focused, THE Alert_Service SHALL flash the taskbar entry and play the message sound.
3. WHEN a chat window gains focus, THE Alert_Service SHALL stop flashing it.
4. WHEN a friend changes from Offline to Available, THE Alert_Service SHALL show a Toast "<Display_Name> is now online" at the bottom-right of the screen for 5 seconds and play the friend-online sound.
5. WHEN a user clicks a Toast, THE Alert_Service SHALL open the chat window with that friend.
6. THE Alert_Service SHALL show a tray icon that uses the Status_Icon of the user's Availability.
7. WHEN a user closes the Buddy List window, THE Buzz SHALL hide it to the tray and keep running.
8. WHEN a user chooses Exit from the tray menu, THE Buzz SHALL set the user Offline and close every window.
9. WHEN a user clicks the tray icon, THE Buzz SHALL show the Buddy List window.
10. WHILE a preference turns a sound or Toast off, THE Alert_Service SHALL NOT play or show it.

### Requirement 17: Chat window menus, formatting, and history

**User Story:** As a user, I want the chat window to have the tools I remember, so that I can style my words and find old messages.

#### Acceptance Criteria

1. THE Buzz SHALL show the menus Conversation, Edit, View, Actions, and Help at the top of each chat window.
2. WHEN a user chooses a font, a size from 10 to 24, a color, or bold, italic, or underline in the formatting bar, THE Chat_Service SHALL apply that formatting to the messages the user sends.
3. WHEN a message with formatting arrives, THE Chat_Service SHALL show it with that formatting unless the user turned off "Show my friends' fonts".
4. IF a message carries a font, size, or color that Buzz does not allow, THEN THE Chat_Service SHALL show the message in the default format.
5. WHEN a user chooses View then Show Timestamps, THE Chat_Service SHALL show or hide the time next to each message.
6. WHEN a user chooses View then Show Earlier Messages or presses F3, THE Chat_Service SHALL load the 50 messages before the oldest one on screen.
7. WHEN a user chooses Conversation then Copy Conversation, THE Chat_Service SHALL copy the messages on screen to the clipboard as plain text.
8. WHEN a user chooses Edit then Clear Window, THE Chat_Service SHALL remove the messages from the window and SHALL keep them in the stored history.
9. WHILE the friend is Offline, THE Chat_Service SHALL show a line in the chat window that says the friend is offline and will receive the messages when they sign in.
10. THE Buzz SHALL show the friend's Status_Icon, Display_Name, and Status in the chat window header and the friend's Status_Icon in its title bar.

### Requirement 18: Buzz! options

**User Story:** As a user, I want control over Buzz! so that it stays fun for me and my friends.

#### Acceptance Criteria

1. WHEN a Buzz arrives while the chat window is minimized or behind other windows, THE Nudge_Service SHALL bring the window to the front before shaking it.
2. WHERE "Allow Buzz!" is turned off, THE Nudge_Service SHALL drop every Buzz that arrives for that user.
3. WHERE "Play the Buzz! sound" is turned off, THE Nudge_Service SHALL shake the window without playing the sound.
4. WHERE "Shake the window for a Buzz!" is turned off, THE Nudge_Service SHALL play the sound and show the BUZZ!!! line without shaking.
5. IF a second Buzz from the same friend arrives less than 10 seconds after the previous one, THEN THE Nudge_Service SHALL drop it.
6. WHEN a user chooses Actions then Buzz! in the chat window, THE Nudge_Service SHALL send a Buzz with the same rules as the Buzz! button and Ctrl+G.
7. THE Nudge_Service SHALL NOT send a Buzz to a friend who is Offline or Invisible.

### Requirement 19: Preferences

**User Story:** As a user, I want one Preferences window for my settings, so that I can tune Buzz in one place.

#### Acceptance Criteria

1. WHEN a user chooses Preferences from the Messenger menu, THE Preferences_Service SHALL open a Preferences window with the categories General, Alerts and Sounds, Messages, Buzz!, and Ignore List.
2. THE Preferences_Service SHALL offer, under General, "Sign in automatically" and "Show Offline Contacts".
3. THE Preferences_Service SHALL offer, under Alerts and Sounds, on-off switches for the message sound, the friend-online sound, the friend-online Toast, and a master switch for all sounds.
4. THE Preferences_Service SHALL offer, under Messages, the default font, size, and color, "Show Timestamps", and "Show my friends' fonts".
5. THE Preferences_Service SHALL offer, under Buzz!, the switches "Allow Buzz!", "Play the Buzz! sound", and "Shake the window for a Buzz!".
6. WHEN a user changes a preference, THE Preferences_Service SHALL apply it to every open window without a restart.
7. IF the saved preferences are missing or damaged, THEN THE Preferences_Service SHALL use the defaults.
8. THE Preferences_Service SHALL save preferences on the user's device, except the Ignore_List, which belongs to the user's account.
