# Buzz — Tasks

Work top to bottom. Check each task off only after typecheck passes.
Do not skip ahead to chat before auth and presence work.

## 1. Project setup

- [ ] 1.1 Create Next.js App Router + TypeScript project, Tailwind CSS,
  ESLint. Confirm `npm run dev` serves the starter page.
- [ ] 1.2 Create Supabase project. Save URL and publishable key in
  `.env.local` (never commit it). Add the typed Supabase clients in
  `lib/supabase/`.
- [ ] 1.3 Create the four tables from design.md with Row Level Security
  on, using a SQL migration file. Verify RLS blocks cross-user reads
  with two test accounts.

## 2. Auth and profiles

- [ ] 2.1 Build `/login` and `/signup` pages with email + password
  (requirements 1).
- [ ] 2.2 On signup, create the `profiles` row with a default display
  name from the email prefix and a default avatar.
- [ ] 2.3 Build `/profile`: edit display name, avatar upload to
  Supabase Storage, status message, now playing (requirements 2, 7).
- [ ] 2.4 Add the app shell layout with the YM-era skin: purple,
  rounded, readable contrast (requirement 8, skin part).

## 3. Friends

- [ ] 3.1 User search by email or display name (requirement 3).
- [ ] 3.2 Send, accept, and decline friend requests with the pending
  list (requirement 3).
- [ ] 3.3 Friend list showing avatar, name, presence dot, and status
  (requirements 3, 4, 7).

## 4. Presence

- [ ] 4.1 Realtime presence channel: online on activity, away after
  5 minutes idle, busy when set, offline on disconnect (requirement 4).
- [ ] 4.2 Friend list updates live when a friend's presence changes,
  no reload (requirement 4).

## 5. Chat

- [ ] 5.1 Chat window with message history for a friend pair
  (requirement 5).
- [ ] 5.2 Send messages over Realtime, delivered in under 2 seconds,
  stored in `messages` (requirement 5).
- [ ] 5.3 Block empty and whitespace-only messages (requirement 5).
- [ ] 5.4 Typing indicator via broadcast, cleared after 3 seconds idle
  (requirement 10).
- [ ] 5.5 Offline messages: stored on send, delivered and marked read
  when the friend returns (requirement 9).

## 6. Nudge

- [ ] 6.1 Nudge button in the chat header, disabled for offline friends
  with a reason shown (requirement 6).
- [ ] 6.2 On click: write a `nudges` row, broadcast the event, show
  "You nudged <name>" as a system line (requirement 6).
- [ ] 6.3 Receiver side: 600 ms window shake plus short Web Audio
  sound (requirement 6).
- [ ] 6.4 10 second cooldown with a visible countdown on the button
  (requirement 6).

## 7. Emoticons

- [ ] 7.1 Add the 24 emoticon files to `public/emoticons/` with a
  shortcode map (requirement 8).
- [ ] 7.2 Emoticon picker inserting the shortcode at the cursor
  (requirement 8).
- [ ] 7.3 Message rendering replacing shortcodes with images
  (requirement 8).

## 8. Polish and ship

- [ ] 8.1 Mobile layout: friend list first, chat with back button
  (design, UI screens).
- [ ] 8.2 Empty states: no friends yet, no messages yet, friend
  offline.
- [ ] 8.3 Deploy to Vercel with env vars set. Verify sign-in and a
  two-window chat on the live URL.
- [ ] 8.4 Write the Devpost Kiro write-up from the real spec, hooks,
  and steering used. Record the demo video (under 3 minutes).
- [ ] 8.5 Final check against the submission checklist in the proposal:
  public repo with `/.kiro` at root and MIT license, live URL with test
  login in the Devpost form, description, video, write-up.
