# Buzz — Design

## Overview

Next.js App Router + TypeScript frontend, Supabase as the only backend:
Auth for sign-in, Postgres for data, Realtime for chat and presence.
Deployed on Vercel. No custom server, no second database.

## Architecture

- `app/` — routes: `/login`, `/signup`, `/` (friend list + chat shell),
  `/profile`.
- `components/` — `FriendList`, `ChatWindow`, `MessageList`,
  `MessageInput`, `EmoticonPicker`, `PresenceDot`, `NudgeButton`.
- `lib/supabase/` — one browser client, one server client, typed
  with the generated database types.
- `lib/realtime/` — presence channel and message subscription helpers.
- `lib/nudge/` — shake animation, sound, cooldown timer.

## Data model (Supabase Postgres)

### profiles

| column | type | notes |
| --- | --- | --- |
| id | uuid, PK | references auth.users |
| display_name | text | required, max 40 chars |
| avatar_url | text | nullable |
| status_message | text | nullable, max 140 chars |
| now_playing | text | nullable, max 140 chars |
| updated_at | timestamptz | |

### friendships

| column | type | notes |
| --- | --- | --- |
| id | uuid, PK | |
| requester_id | uuid | references profiles |
| addressee_id | uuid | references profiles |
| status | text | pending, accepted, declined, blocked |
| created_at | timestamptz | |
| unique pair | | one row per unordered pair |

### messages

| column | type | notes |
| --- | --- | --- |
| id | uuid, PK | |
| sender_id | uuid | references profiles |
| receiver_id | uuid | references profiles |
| body | text | required, max 2000 chars |
| created_at | timestamptz | |
| read_at | timestamptz | nullable |

### nudges

| column | type | notes |
| --- | --- | --- |
| id | uuid, PK | |
| sender_id | uuid | references profiles |
| receiver_id | uuid | references profiles |
| created_at | timestamptz | |

Presence is NOT stored in Postgres. It lives in a Supabase Realtime
presence channel keyed by user id, with states online, away, busy.
Away is set client-side after 5 minutes without activity.

## Security (Row Level Security, on for every table)

- profiles: anyone signed in can read, a user can update only their own row.
- friendships: a row is visible only to its two users.
- messages: a row is visible only to sender and receiver.
- nudges: a row is visible only to sender and receiver.
- Never expose the Supabase service key in the browser. Only the
  publishable key and URL go in public env vars.

## Realtime

- One Postgres changes subscription per open chat, filtered to messages
  where the user is sender or receiver.
- One presence channel for the friend list, tracking the signed-in user.
- Typing indicator uses a Realtime broadcast event, not a database write.

## Nudge mechanism

1. Click writes one row to `nudges` and broadcasts a `nudge` event.
2. Receiver's chat window adds a CSS shake class for 600 ms and plays
   a short sound (Web Audio, no audio file needed).
3. Sender's button disables for 10 seconds. A row "You nudged <name>"
   is shown as a system line in the chat, not stored as a message.

## Emoticons

A fixed pack of 24 classic-style emoticons, stored as files in
`public/emoticons/` with shortcodes like `:)` `:(` `:D` `;)` `>: (`.
Message rendering replaces shortcodes with `<img>` tags. No user
upload of emoticons in version 1.

## UI screens

1. **Login / signup**: centered card, YM-era purple, email + password,
   error text under the form, no social login in version 1.
2. **Main shell**: left column friend list (avatar, name, presence dot,
   status), right column chat. Mobile: friend list first, chat replaces
   it when a friend is tapped, with a back button.
3. **Profile**: display name, avatar upload, status, now playing, save.

## Testing

- Typecheck (`tsc --noEmit`) and lint must pass after every task.
- Unit tests for: shortcode rendering, nudge cooldown, presence
  state transitions.
- Manual check after each task: sign in as two test users in two
  browser windows and verify the feature works between them.
