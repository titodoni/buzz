# Implementation Plan: Buzz

## Overview

Buzz is a Yahoo Messenger revival built as a **Tauri desktop app** for
Windows, Linux, and macOS. The client is a Next.js App Router + TypeScript
(strict) application built as a **static export** (`output: 'export'`)
loaded into Tauri's native webview — WebView2 on Windows, WebKitGTK on
Linux, WKWebView on macOS. There is no Vercel and no Next.js server
runtime: no Server Components, no middleware, no server actions. Supabase
(Auth, Postgres, Realtime, Storage) is the only backend, accessed through a
single typed browser client (publishable key only; the service-role key
never ships in the app). Supabase Auth manages the session client-side,
persisted in webview storage. Tailwind CSS provides styling.

The Buddy List is the main Tauri window (route `/`); each opened chat
opens its own OS window at `/chat?friendId=<id>` via a Tauri IPC call
(Requirement 5.6). Windows are frameless with a custom in-app purple
gradient title bar (the YM-era Skin).

The build order honors the design's layering: the Tauri shell and Next.js
static-export scaffold come first, then the Supabase schema/RLS
foundation, then the pure-logic layer (`lib/`) — built and property-tested
first because it has no I/O and is the entire property-test surface. The
Supabase browser client and the database schema (RLS, triggers, storage,
`pg_cron`) are integration boundaries. UI components are then built
leaf-first, composed into the chat shell, and finally wired to Realtime
(presence, chat, typing, nudge) and the offline-message delivery flow.
Nudge is an ephemeral Realtime broadcast with client-side cooldown —
there is no `nudges` table. Presence is never stored in Postgres; the
`presence:global` channel is owned by the Buddy List window only, so chat
windows do not create duplicate presence entries.

Each task references the requirements it satisfies. Property tests are
one sub-task per design Correctness Property, placed next to the
implementation they test. Test sub-tasks are marked optional with `*`;
implementation sub-tasks are not. Integration tests run between two
running desktop app instances (or two app windows), per `tech.md`.

## Tasks

- [x] 1. Set up the Tauri shell, Next.js static export, and Supabase foundation
  - [x] 1.1 Scaffold the Next.js App Router + TypeScript (strict) project with Tailwind CSS, configured as a static export (`output: 'export'`); add `@supabase/supabase-js` and `fast-check`; configure the test runner (Vitest) and a `typecheck` script
    - Client Components only; no server runtime, no middleware, no Server Components; Supabase Auth session persisted client-side in webview storage
    - _Requirements: 1.1_
  - [x] 1.2 Scaffold the Tauri Rust shell (`src-tauri/`): the native window manager, the main window (Buddy List) loading the static export, frameless-window config for custom decorations, and the webview setup for WebView2 (Windows), WebKitGTK (Linux), and WKWebView (macOS); define the Tauri IPC command that opens a chat at `/chat?friendId=<id>` in its own OS window
    - The Buddy List is the main window; each chat opens its own window via IPC (Req 5.6)
    - _Requirements: 5.6_
  - [x] 1.3 Generate `lib/supabase/database.types.ts` with `supabase typegen` and implement `lib/supabase/browser-client.ts` (`createBrowserClient(URL, ANON_KEY)`, publishable key only) as the ONLY Supabase access point; components never call Supabase directly, they go through this client and the `lib/` pure-logic modules
    - No server client and no service-role key in the app (the app is a static export with no server runtime)
    - _Requirements: 1.4_
  - [x] 1.4 Create database schema migrations with RLS enabled on every table: `profiles` (with a `BEFORE INSERT` trigger setting `display_name = left(split_part(email,'@',1),50)` and a default avatar), `friendships` (with the unique unordered-pair index), and `messages` (with a `CHECK` that `body` length <= 1000); add RLS policies (profiles readable by any signed-in user, writable only by owner; friendships and messages visible/writable only to the two parties and only for an accepted pair); create the public `avatars` Storage bucket (png/jpeg/webp, 2 MB limit); schedule the daily `pg_cron` job that deletes undelivered messages older than 30 days
    - One `messages` insert both persists and broadcasts; visibility follows the friendship `status` so unfriend hides history and re-friend restores it
    - _Requirements: 1.3, 2.4, 2.5, 3.5, 3.6, 5.4, 9.6_

- [x] 2. Implement the validation and profile-render pure-logic modules
  - [x] 2.1 Implement `lib/validation/profile.ts`: `isValidEmail` (local-part@domain), `isValidPassword` (8..128 chars), `displayNameFromEmail` (prefix before first `@`, truncated to 50), `isValidDisplayName` (non-empty after trim), `isValidStatus` (<=140), `isValidNowPlaying` (<=140), `isValidMessageBody` (non-empty, non-whitespace-only, <=1000), `checkAvatar({size,type})` (ok iff size <= 2_097_152 and type is png/jpeg/webp)
    - No I/O; pure functions only
    - _Requirements: 1.2, 1.3, 1.8, 2.1, 2.2, 2.4, 2.5, 5.4, 7.3_
  - [x]* 2.2 Write property test for email format validation
    - **Property 1: Email format validation**
    - **Validates: Requirements 1.2, 1.8**
  - [x]* 2.3 Write property test for password length validation
    - **Property 2: Password length validation**
    - **Validates: Requirements 1.2, 1.8**
  - [x]* 2.4 Write property test for display name derivation from email
    - **Property 3: Display name derivation from email**
    - **Validates: Requirements 1.3**
  - [x]* 2.5 Write property test for profile field length limits
    - **Property 4: Profile field length limits**
    - **Validates: Requirements 2.1, 7.3**
  - [x]* 2.6 Write property test for required, non-whitespace display name
    - **Property 5: Display name is required and non-whitespace**
    - **Validates: Requirements 2.2**
  - [x]* 2.7 Write property test for avatar upload validation
    - **Property 6: Avatar upload validation**
    - **Validates: Requirements 2.4, 2.5**
  - [x]* 2.8 Write property test for message body validation
    - **Property 11: Message body validation**
    - **Validates: Requirements 5.4**
  - [x] 2.9 Implement `lib/profile/render.ts`: `shouldShowField(value)` (false for empty/whitespace-only so the field is cleared, not shown) and `hasNowPlaying(value)` (true iff non-empty, gating the music-note glyph)
    - No I/O; pure functions only
    - _Requirements: 7.2, 7.4_
  - [x]* 2.10 Write property test for status and Now_Playing display
    - **Property 20: Status and Now_Playing display**
    - **Validates: Requirements 7.2, 7.4**

- [x] 3. Implement the emoticon pure-logic module
  - [x] 3.1 Implement `lib/emoticons/shortcode.ts`: `SHORTCODE_MAP` (>=30 classic-style entries, the classic YM 5.5 set with 35 visible plus hidden emoticons, mapping unique shortcodes to unique image paths), `renderMessage(body)` (splits body into `text` and `emoticon` tokens; unrecognized shortcode-shaped strings stay text; concatenation reconstructs `body`), and `insertAtCursor(text, pos, shortcode)` (returns `{ text: text.slice(0,pos)+shortcode+text.slice(pos), pos: pos+shortcode.length }`)
    - No I/O; pure functions only
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x]* 3.2 Write property test for emoticon pack validity
    - **Property 16: Emoticon pack validity**
    - **Validates: Requirements 8.1**
  - [x]* 3.3 Write property test for emoticon insertion at cursor
    - **Property 17: Emoticon insertion at cursor**
    - **Validates: Requirements 8.2**
  - [x]* 3.4 Write property test for shortcode rendering and fallback
    - **Property 18: Emoticon shortcode rendering and fallback**
    - **Validates: Requirements 8.3, 8.5**

- [x] 4. Implement the presence, nudge, and typing pure-logic modules
  - [x] 4.1 Implement `lib/presence/state.ts`: `PresenceState` (`online|away|busy|offline`) and `nextPresenceState(current, event)` where `activity`/`setOnline` -> `online`, `idleTimeout` with `now - lastActivityAt >= 5 min` -> `away`, `setBusy` -> `busy` (persists until `activity`/`setOnline`/`disconnect`), `disconnect`/`heartbeatMissed` -> `offline`
    - No I/O; pure functions only
    - _Requirements: 4.1, 4.2, 4.3, 4.6_
  - [x]* 4.2 Write property test for the presence state machine
    - **Property 9: Presence state machine**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**
  - [x] 4.3 Implement `lib/nudge/cooldown.ts`: `isInCooldown(s, now)` (true iff `lastNudgeAt != null` and `now - lastNudgeAt < 10_000`) and `onNudgeResult(s, now, delivered)` (sets `lastNudgeAt = now` only when `delivered`; a failed delivery leaves `lastNudgeAt` unchanged so the button stays enabled)
    - No I/O; pure functions only
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [x]* 4.4 Write property test for nudge availability and cooldown
    - **Property 14: Nudge availability and cooldown**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
  - [x] 4.5 Implement `lib/typing/state.ts`: `shouldShowTyping(s, now)` (true iff `lastKeystrokeAt != null`, `now - lastKeystrokeAt < 3000`, and `sent` is false), `onKeystroke(s, now)` (sets `lastKeystrokeAt = now`, `sent = false`), `onSend(s)` (sets `sent = true`, clearing the indicator)
    - No I/O; pure functions only
    - _Requirements: 10.1, 10.2, 10.3_
  - [x]* 4.6 Write property test for the typing indicator state machine
    - **Property 15: Typing indicator state machine**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 5. Implement the friends, chat, and offline pure-logic modules
  - [x] 5.1 Implement `lib/friends/search.ts`: `searchUsers(users, query, selfId, limit=50)` (case-insensitive contains on email or display_name, excludes self, capped at 50), `canonicalPair(a, b)` and `pairKey(a, b)` (`<min>_<max>`), and `canSendRequest(rel, selfId, recipientId)` (ok false when recipient is self, or status is `accepted` or `pending`; in those cases no pending request is created)
    - No I/O; pure functions only
    - _Requirements: 3.1, 3.7_
  - [x]* 5.2 Write property test for friend search filtering
    - **Property 7: Friend search filtering**
    - **Validates: Requirements 3.1**
  - [x]* 5.3 Write property test for friend request gating
    - **Property 8: Friend request gating**
    - **Validates: Requirements 3.7**
  - [x] 5.4 Implement `lib/chat/messages.ts`: `loadRecentMessages(all, limit=50)` (the 50 messages with greatest `created_at`, ordered oldest-first; returns all when `|M| <= 50`) and `isOfflineMessage(m)` (true iff `delivered_at` is null)
    - No I/O; pure functions only
    - _Requirements: 5.1, 5.5, 9.1_
  - [x]* 5.5 Write property test for most-recent message loading
    - **Property 10: Most-recent message loading**
    - **Validates: Requirements 5.1**
  - [x] 5.6 Implement `lib/offline/retention.ts`: `shouldRetain(m, now)` (true iff `delivered_at` is null and `created_at > now - 30 days`) and `orderOfflineMessages(messages)` (ascending `created_at`)
    - No I/O; pure functions only
    - _Requirements: 5.5, 9.1, 9.2, 9.5, 9.6_
  - [x]* 5.7 Write property test for offline-message classification and retention cutoff
    - **Property 12: Offline-message classification and retention cutoff**
    - **Validates: Requirements 5.5, 9.1, 9.5, 9.6**
  - [x]* 5.8 Write property test for offline-message delivery order
    - **Property 13: Offline-message delivery order**
    - **Validates: Requirements 9.2**

- [x] 6. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the Skin, window chrome, and shared UI components
  - [x] 7.1 Implement `SkinProvider` and the skin color tokens: a purple base color (`--ym-purple` to `--ym-purple-deep` gradient), rounded corners, and a glossy surface highlight, maintaining a minimum text-to-background WCAG contrast ratio of 4.5:1
    - Applies the YM-era Skin across all windows
    - _Requirements: 8.4_
  - [x]* 7.2 Write property test for skin contrast ratio
    - **Property 19: Skin contrast ratio**
    - **Validates: Requirements 8.4**
  - [x] 7.3 Implement the custom frameless window decorations: each Tauri window (Buddy List, Chat, Sign-in, Profile) is frameless with an in-app purple gradient title bar (linear-gradient `--ym-purple` to `--ym-purple-deep`), rounded top corners, a 1px border, the YM title text, and standard min/max/close window controls
    - This is the "rounded corners, glossy surface highlight" of Req 8.4; makes each window look like a classic YM window rather than a browser tab
    - _Requirements: 8.4_
  - [x] 7.4 Implement `PresenceDot` (the color-coded presence smiley for online, away, busy, offline)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Implement authentication UI and client-side session
  - [x] 8.1 Implement `/login` and `/signup` pages with `SignInForm` and `SignUpForm`: email + password fields, client-side format hints using `isValidEmail`/`isValidPassword`, a sign-up link, and server error display (duplicate email, invalid credentials)
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9_
  - [x] 8.2 Implement the client-side auth/session guard (NOT Next.js middleware — the app is a static export with no server runtime): a client-side route guard that reads the Supabase session from webview storage, redirects unauthenticated users from `/`, `/profile`, and `/chat?friendId=<id>` to `/login`, restores the session on window reload (keeping the user signed in), and implements sign-out (ending the session and returning to the sign-in page)
    - Session is managed client-side by Supabase Auth, persisted in webview storage
    - _Requirements: 1.4, 1.5, 1.6_
  - [ ]* 8.3 Write integration tests for auth (two running app instances): sign up creates a profile with the email-prefix display name, sign in, reload restores the session, sign out, and the duplicate-email and invalid-credentials rejection paths
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9_

- [ ] 9. Implement the profile UI
  - [x] 9.1 Implement `/profile` with `ProfileEditor`: editable Display_Name (max 50), Status (max 140), and Now_Playing (max 140) with live char counters; save via the browser client, rejecting empty/whitespace display name (retaining the previous value with an error) and over-limit Status/Now_Playing (retaining the existing value with an error); empty Status/Now_Playing clears the field
    - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.3, 7.4_
  - [x] 9.2 Implement `AvatarUpload`: drag/click upload with a client size+MIME check via `checkAvatar`, a preview, and upload to the `avatars` Storage bucket scoped per user; reject (>2 MB or not png/jpeg/webp) by retaining the previous avatar and showing the constraint error
    - _Requirements: 2.4, 2.5_
  - [ ]* 9.3 Write unit tests for the char counters at the 50/140 limit boundaries and the `checkAvatar` accept/reject paths
    - _Requirements: 2.1, 2.4, 2.5, 7.3_

- [ ] 10. Implement the friends UI
  - [x] 10.1 Implement `FriendSearch`: search by email or Display_Name using `searchUsers` over a Friend_Service query, listing results (excluding self, capped at 50)
    - _Requirements: 3.1_
  - [x] 10.2 Implement `PendingRequests` (accept adds both users to each other's list and removes the request; decline removes it) and friend request sending gated by `canSendRequest`, rejecting self, existing friend, and existing pending request with an error
    - _Requirements: 3.2, 3.3, 3.4, 3.7_
  - [x] 10.3 Implement `FriendList` and `FriendListItem`: each row shows avatar, Display_Name, a `PresenceDot`, and Status/Now_Playing (Now_Playing with a music note, empty fields not shown); clicking a friend opens the chat in a new Tauri OS window via the IPC command (Req 5.6); include removing a friend (unfriend hides chat history for both directions; re-friend restores it)
    - _Requirements: 3.3, 3.5, 3.6, 4.5, 5.6, 7.1, 7.2_
  - [ ]* 10.4 Write unit tests for `FriendListItem` rendering: Now_Playing shows the music note iff non-empty, and empty/whitespace Status or Now_Playing is not rendered
    - _Requirements: 7.2, 7.4_
  - [ ]* 10.5 Write integration tests for friends (two running app instances): search, send/accept/decline, unfriend hides history, and re-friend restores it
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 11. Wire presence
  - [~] 11.1 Implement the `usePresence` hook over the `presence:global` Realtime channel, owned by the Buddy List window only: track `{ user_id, presence_state }`, run a 25s heartbeat, report online on activity, away after 5 min idle, busy when set, and offline on explicit untrack (sign-out/app close) or a missed heartbeat; drive transitions through `nextPresenceState` and expose friends' presence to the friend list
    - Presence is never written to Postgres; chat windows do not join this channel (avoids duplicate presence entries)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 11.2 Write integration tests for presence between two running app instances: online on activity, away after 5 min idle, busy when set, offline within 30s of app close, and offline within ~60s of a dropped connection
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 12. Implement the chat UI and Realtime
  - [~] 12.1 Implement `MessageInput`: textarea with a char counter, send on Enter, an Emoticon picker slot, and a send flow that validates the body with `isValidMessageBody` and rejects empty/whitespace/>1000-char messages with an error (storing nothing)
    - _Requirements: 5.4_
  - [~] 12.2 Implement `MessageBubble`: sender/receiver styling, emoticon rendering via `renderMessage`, and system lines (e.g. "You nudged <Display_Name>")
    - _Requirements: 5.1, 6.2, 8.3_
  - [~] 12.3 Implement `EmoticonPicker`: a grid of >=30 classic-style emoticons that inserts the matching shortcode at the cursor via `insertAtCursor`
    - _Requirements: 8.1, 8.2_
  - [~] 12.4 Implement the `useChatChannel` hook for `chat:<pairKey>` (postgres_changes on `messages` INSERT filtered to the pair, plus broadcast for `typing` and `nudge`); chat windows join only this channel (not `presence:global`); sending inserts a `messages` row so one write both persists and broadcasts; if the friend is offline the row is stored with `delivered_at = null`
    - Messages are the source of truth; the subscription is reattached on reconnect so missed inserts recover from Postgres
    - _Requirements: 5.2, 5.3, 5.5_
  - [~] 12.5 Implement `ChatWindow` (header with friend name, presence, and Nudge button slot) and `MessageList` (renders the most recent 50 via `loadRecentMessages` then appends), composing `MessageInput`, `MessageBubble`, `EmoticonPicker`, `NudgeButton`, `TypingIndicator`, and the `useChatChannel`/`usePresence` hooks; the chat route `/chat?friendId=<id>` renders in its own Tauri OS window opened via the IPC command (Req 5.6)
    - _Requirements: 5.1, 5.2, 5.4, 5.6_
  - [ ]* 12.6 Write integration tests for chat (two running app instances): opening a chat shows the most recent 50, a sent message reaches a connected friend in under 2s, reload preserves history, and an offline friend's message is delivered on return in chronological order and marked read on open
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.2, 9.3_

- [ ] 13. Implement nudge
  - [~] 13.1 Implement `NudgeButton`: disabled with a "friend is offline" message when presence is offline; on click broadcast `nudge` on `chat:<pairKey>` and show "You nudged <Display_Name>" locally; do not start the cooldown until delivery is confirmed; on confirmed delivery enter a 10s cooldown with a visible countdown; on delivery failure show a "nudge was not delivered" message and leave the button enabled with no cooldown, all driven by `isInCooldown`/`onNudgeResult`
    - Nudge is ephemeral; there is no `nudges` table
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  - [~] 13.2 Implement the `useNudgeReceiver` hook: on a received `nudge` broadcast, add a 600 ms shake CSS class to the chat window and play a <=1s Web Audio sound
    - _Requirements: 6.1_
  - [ ]* 13.3 Write integration tests for nudge (two running app instances): shake plus sound on the receiver, the 10s cooldown, disabled for an offline friend, and the not-delivered message on a forced failure (button stays enabled, no cooldown)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 14. Implement the typing indicator
  - [~] 14.1 Implement `TypingIndicator`: broadcast `typing` on keystroke (driven by `onKeystroke`), clear after 3s idle (`shouldShowTyping`), and clear on send (`onSend`); render "<Display_Name> is typing..." to the other participant
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 14.2 Write an integration test for typing (two running app instances): the indicator appears while typing, clears after 3s idle, and clears on send
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 15. Wire offline messages
  - [~] 15.1 Implement the `useOfflineMessages` hook: on connect, query `messages` where `receiver_id = me AND delivered_at IS NULL` ordered by `created_at` (via `orderOfflineMessages`), render them, and set `delivered_at = now`; if that update fails the row stays `delivered_at = null` and is retried on the next connect; when the user opens a stored message set `read_at`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 15.2 Write an integration test for offline messages (two running app instances): store when the friend is offline, deliver on return in chronological order, mark read on open, surface a "message was not sent" error on a storage failure, and retain the message for retry when delivery fails
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [~] 16. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Configure the Tauri build and distribution
  - [~] 17.1 Configure the Tauri build config and bundlers to produce per-OS installers: `.msi`/`.exe` (Windows), `.deb`/`.AppImage` (Linux), and `.dmg`/`.app` (macOS); the build loads the Next.js static export into the native webview
    - This is a coding/config task; release artifacts are desktop installers, not a Vercel deploy
    - _Requirements: 5.6_

- [ ] 18. Final integration
  - [~] 18.1 Wire the profiles-feed subscription (postgres_changes on `profiles` UPDATE) so a changed Display_Name, Avatar, Status, or Now_Playing appears in the friend list and chat headers without a reload
    - _Requirements: 2.3, 4.5, 7.1, 7.2_
  - [ ]* 18.2 Write integration tests for RLS (two running app instances: a user cannot read another user's hidden profile updates, a stranger's messages, or a friendship they are not party to) and profile live update (a change appears in the friend's list within ~5s without reload)
    - _Requirements: 2.3, 3.5, 4.5_

- [~] 19. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- The design uses TypeScript throughout (Next.js App Router + TypeScript strict) as a static export, so all code examples and tasks are TypeScript; no language selection step was needed.
- The client is a Tauri desktop app, not a Vercel deployment: there is no Next.js server runtime, no middleware, no Server Components, no server actions, and no server-side Supabase client. The service-role key never ships in the app.
- Supabase Auth manages the session client-side, persisted in webview storage; auth-gating is a client-side route guard, not Next.js middleware.
- The Buddy List is the main Tauri window; each chat opens its own OS window via a Tauri IPC call (Req 5.6). The `presence:global` channel is owned by the Buddy List window only; chat windows join only `chat:<pairKey>` (plus typing/nudge broadcast) to avoid duplicate presence entries.
- Tasks marked with `*` are optional tests and can be skipped for a faster MVP, but property tests are what verify the 20 design Correctness Properties, so skipping them drops that safety net.
- Each implementation task references the granular requirement clauses it satisfies; each property test references its design property number and the requirements it validates.
- Nudge is an ephemeral Realtime broadcast with client-side cooldown; there is no `nudges` table. Presence is never stored in Postgres.
- Build order: Tauri shell + Next.js static-export scaffold + Supabase schema/RLS foundation -> pure-logic `lib/` modules + property tests -> Skin/window chrome + shared UI -> auth (client-side) -> profile -> friends -> presence -> chat (leaf components, `useChatChannel`, `ChatWindow` composition, multi-window) -> nudge -> typing -> offline delivery -> Tauri build config -> final integration tests.
- This plan contains only coding tasks (writing, modifying, and testing code, plus Tauri build config). Deployment to app stores, the Devpost write-up, and the demo video are intentionally excluded.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "2.9", "3.1", "4.1", "4.3", "4.5", "5.1", "5.4", "5.6", "7.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.10", "3.2", "3.3", "3.4", "4.2", "4.4", "4.6", "5.2", "5.3", "5.5", "5.7", "5.8", "7.2", "7.3", "7.4"] },
    { "id": 3, "tasks": ["8.1", "8.2", "9.1", "9.2", "10.1", "10.2", "10.3", "11.1", "12.1", "12.2", "12.3", "12.4", "13.1", "13.2", "14.1"] },
    { "id": 4, "tasks": ["8.3", "9.3", "10.4", "10.5", "11.2", "12.5", "15.1", "17.1"] },
    { "id": 5, "tasks": ["12.6", "13.3", "14.2", "15.2", "18.1"] },
    { "id": 6, "tasks": ["18.2"] }
  ]
}
```
