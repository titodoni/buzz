# Buzz Trigger Spec

Kiroween 2026, category Resurrection. Buzz is a Yahoo Messenger revival.
Deadline: submit 4 Dec 2026, not 5 Dec, to keep a buffer.

## How to use this file in Kiro

This is an incremental spec. The Buzz app already runs. Do not rebuild it.

1. Open the existing `buzz` repo.
2. Copy this file to `.kiro/specs/buzz-trigger/spec.md` (keep `.kiro` in version control).
3. Implement the tasks in Section 7 in order. Do not skip ahead.
4. After each task, run `tsc --noEmit` and lint. Then verify manually with two test users in two running desktop app instances.
5. This spec wins over `.kiro/specs/buzz/` only for the trigger features below. The steering files (`product`, `tech`), `GLOSSARY.md`, and ADRs 0001 to 0009 win over this spec if they conflict. Everything else stays as built.

## 0. Revision notes (what changed from the first draft)

The first draft assumed a web app on Vercel and a stored `nudges` table. The repo says otherwise. Changes made:

| First draft | Now | Why |
|---|---|---|
| Web app, Vercel, browser windows | Tauri desktop app, two app instances | `tech` steering, ADR 0001 |
| Table `nudges` plus inbox query | No table. Recent Nudges is a local log on the receiver's machine | ADR 0007: a Nudge is never stored |
| 5 Nudges per 10 minutes enforced "in the write path" | Enforced by the sender's client, like the 10 second cooldown | ADR 0007: no server write path exists |
| "Lobby" | Buddy List (existing window) | `GLOSSARY.md` |
| "Invite" | "Hangout" | Glossary reserves "Invite" as an avoided word for Friend Request |
| "Lagi gabut" as a new status | Status preset "Up for Chat", sets Available | Presets today set Busy; this one must not |
| "Block or remove friend" | Ignore List, or removed friendship | Glossary; ADR 0009 |
| "Nudge last online friend" button | Removed | Presence is never history (glossary), and no data holds "last online" |
| Nudge shakes a row and a badge persists until chat opens | Nudge still pops the Chat Window open and shakes it. Row shake and badge are added only for when the window cannot take focus | ADR 0007, existing behaviour |
| Indonesian UI copy | English UI copy, YM-era tone | Existing app copy is English. Confirmed, Section 10 |
| Group by presence in a flat list | Sort inside each Buddy List Group | Groups already exist (`lib/friends/arrange.ts`) |

## 1. Context, what already exists

Stack is locked (see `tech` steering): Next.js App Router, TypeScript strict, static export wrapped by Tauri. Supabase is the only backend (Auth, Postgres, Realtime, Storage). No Vercel, no custom server, no second database.

Already built and working:
- Email sign in, profiles with Display Name, Avatar, Status, Now Playing typed by hand.
- Buddy List with live Presence: Available, Away, Busy, Offline (and Invisible shown as Offline). Away after 5 minutes idle. Groups, Ignore List, Preset Statuses.
- One-to-one chat, one OS window per chat, Typing Indicator, Offline Messages.
- Nudge: ephemeral broadcast on `chat:<pairKey>` and the friend's `inbox:<friendId>`. Pops the Chat Window open, shakes it, plays a Web Audio sound. 10 second cooldown per friend kept in `localStorage`. Disabled for Offline friends. No `nudges` table (ADR 0007).
- Classic Emoticon pack, YM-era Skin.
- Tables `profiles`, `friendships`, `messages` (plus group tables), all under Row Level Security. Presence lives in the `presence:global` Realtime channel, never in Postgres.
- A `pg_cron` job already exists (`20250101000400_retention_cron.sql`), so a scheduler is available.

## 2. Problem

The app works, but it has no clear reason to open. WhatsApp already owns the trigger "I have a message to send". Buzz needs a different trigger: "I want to know who is here right now".

Positioning, locked for this spec:
- WhatsApp is for sending a message.
- Buzz is for meeting a person who is present now.

Nostalgia alone is not a trigger. Nostalgia gets one signup. Presence plus Nudge gets a return visit.

## 3. Trigger principle

Three triggers, in priority order:

1. Bored and want to talk. The user opens Buzz at night with no message to send, just to see who is around.
2. Want to do something now. Play a game, study together, talk for a bit. The user needs the other person present, not just reachable later.
3. Being Nudged by a friend. The user is pulled in by a Nudge from someone else.

Every feature in this spec must serve one of those three triggers. If it does not, do not build it.

Trigger 3 has a limit. Buzz is a desktop app with no push service, so a Nudge only reaches a friend whose app is running. That is the accepted trade-off: the app stays signed in and sits in the tray.

## 4. Scope

In scope:
- Buddy List sorted by Presence, with an online count.
- One tap "Up for Chat" Status.
- Hangout: a fixed-template proposal to do something now.
- Nudge improvements: row feedback in the Buddy List, a Recent Nudges panel, and a rate limit.

Out of scope, do not build:
- Group chat, voice or video calls, mobile app, push notifications.
- Feed, algorithm, follower counts, recommendations.
- File sharing.
- "Last online" history of any kind.
- A `nudges` table or any storage of Nudges on the server.
- End to end encryption claims. Never claim it.

## 5. New and changed terms

Add to `GLOSSARY.md` as each is built (no implementation detail there):

- **Up for Chat**: A Status a user turns on with one tap to say they want company now. Friends see it highlighted under the name. It clears itself after an hour.
- **Hangout**: A short, fixed-wording proposal from one friend to another to do something together right now, such as "Play a game?". The friend accepts or declines. It lapses if unanswered.
- **Recent Nudges**: The last few Nudges you received, kept on your own computer so you can Nudge back.

Update the **Nudge** entry: also a small shake and badge on the friend's row when the Chat Window cannot take focus.

## 6. Requirements

Use WHEN/THEN form. Done means the behavior happens in a two instance manual test.

### R1. Buddy List sorted by Presence

- WHEN a user opens the Buddy List, THEN inside each Group friends are sorted Available, Away, Busy, then Offline, and alphabetically by Display Name inside each state. (Check `arrangeBuddyList` first. Change only what differs.)
- WHEN at least one friend is online, THEN the header shows the total, for example "3 online now".
- WHEN no friend is online, THEN the list shows "No one is around right now." and no green dot of any kind.
- WHEN a friend's Presence changes, THEN the list re-sorts within 2 seconds, using the existing presence channel.

### R2. Up for Chat

- WHEN a user taps "Up for Chat", THEN their Status becomes "Up for chat, say hi!", their Presence is Available, and friends see the row highlighted.
- WHEN they tap it again, or 60 minutes pass, THEN the Status returns to the previous Status, or empty if there was none. If the user picked another Status or Presence meanwhile, the timer does nothing.
- WHEN a friend is Up for Chat, THEN their row shows a "Say hi" button. One tap opens the Chat Window and sends the Message "Hi! Saw you're up for chat :)" through the normal Message path (client-generated id, Offline Message rules, Ignore List checks). A second tap within 60 seconds only opens the window, so it cannot send twice.
- Not stored as a new column. It is a normal Status value plus a client timer. If the app closes, the status is cleared on next start when older than 60 minutes (store the start time in `localStorage`).

### R3. Hangout

- WHEN a user opens a Chat Window, THEN the header has a Hangout button with templates "Play a game?", "Just talk for a bit?", "Study together?", "Hop in a call elsewhere?" and one custom field, max 60 characters. (Calls are out of scope in Buzz. The last template means "go to another app".)
- WHEN a user sends a Hangout, THEN the friend sees a banner at the top of their Buddy List and of the Chat Window: "[Name] wants to hang out: Play a game?" with Accept and Decline.
- WHEN the friend taps Accept, THEN the Chat Window opens and a system line appears for both: "[Name] accepted: Play a game?".
- WHEN the friend taps Decline, THEN the banner goes away. The sender sees only the system line "Hangout declined". No other notification.
- WHEN a Hangout is not answered in 15 minutes, THEN it expires, the banner goes away, and the sender sees "Hangout expired".
- WHEN a Hangout is already pending between the pair, THEN the sender cannot send another until it is answered or expires. The button shows why.
- WHEN the friend is Busy, THEN they still receive it, and the sender sees "Your friend is busy" as a hint.
- WHEN the friend is Offline, THEN the Hangout button is disabled with the reason, same as Nudge. A Hangout needs a present friend.

### R4. Nudge, extended

Existing Nudge behavior stays. Added:

- WHEN a Nudge arrives on the `inbox:<userId>` channel, THEN the Buddy List records it in Recent Nudges and the friend's row shakes.
- WHEN the Nudge cannot open or focus the Chat Window, THEN the row also shows a red count badge that clears when that chat is opened.
- WHEN a user opens the Recent Nudges panel (bell in the Buddy List header), THEN they see the last 10 Nudges, newest first, with sender name, time, and a "Nudge back" button. Empty state: "No Nudges yet. Nudge a friend first."
- WHEN a user taps "Nudge back", THEN it is a normal Nudge with the same cooldown and Offline rules.
- WHEN a user has sent 5 Nudges in 10 minutes across all friends, THEN the next attempt is blocked with "Wait a moment before Nudging again". The per-friend 10 second cooldown stays.
- The Recent Nudges log and the rate limit live on the user's computer (`localStorage`). They are not secure against a modified client. This is the ADR 0007 trade-off, accepted for this spec. Do not call it enforced.
- Recent Nudges only holds Nudges received while the app was running.

### R5. Now Playing and Status as a conversation starter

- WHEN a friend has Now Playing, THEN the Buddy List row shows it under the name, truncated to 40 characters (check the current limit first).
- WHEN a Chat Window opens, THEN the header shows the friend's Now Playing if any.

### R6. Safety and privacy, no exceptions

- Only the two people in a Hangout can read it. Row Level Security, same pattern as `messages`.
- WHEN a user is on someone's Ignore List, or the friendship is removed, THEN that person cannot send them a Hangout or a Nudge. Reuse the existing Ignore enforcement (ADR 0009). No new block table.
- Hangout broadcasts go only on private channels (`inbox:<userId>`, `chat:<pairKey>`). Never on public topics.
- Never claim end to end encryption.

## 7. Design

### 7.1 Data model

One new table, `hangouts`, in a new migration file under `supabase/migrations/` (never the dashboard editor).

- `id` uuid primary key, default `gen_random_uuid()`
- `sender_id` uuid not null, references `auth.users`
- `receiver_id` uuid not null, references `auth.users`
- `text` text not null, check `char_length(text) between 1 and 60`
- `status` text not null default `'pending'`, check in (`pending`, `accepted`, `declined`, `expired`)
- `created_at` timestamptz not null default `now()`
- `responded_at` timestamptz null
- check `sender_id <> receiver_id`

Indexes: `(receiver_id, status, created_at)` and `(sender_id, receiver_id, status)`.
A partial unique index on the unordered pair where `status = 'pending'` enforces "one pending Hangout per pair" in the database, not only in the UI.

Row Level Security on:
- Select: sender or receiver.
- Insert: `sender_id = auth.uid()`, an accepted friendship exists, and the receiver has not ignored the sender (reuse the helper from ADR 0009).
- Update: the receiver can move `pending` to `accepted` or `declined`. The sender can move `pending` to `expired` only when older than 15 minutes. Nothing else changes (use a trigger or column checks so `text` and ids are immutable).
- No delete from the client.

Add the table to the generated `lib/supabase/database.types.ts`.

No change to `profiles`, `friendships`, or `messages`. No Nudge table.

Hangout system lines ("accepted", "declined", "expired") are rendered on the client from `hangouts` rows, not inserted into `messages`. This keeps Offline Message retention untouched.

### 7.2 Realtime

- Presence: unchanged. The Buddy List window owns `track()`. Re-sort from presence sync, no polling.
- Hangout delivery: on the `inbox:<userId>` private channel, add a `postgres_changes` binding on `hangouts` (filter `receiver_id=eq.<me>`, and a second binding for `sender_id=eq.<me>` so the sender sees accept, decline, expire). Add a broadcast on `inbox:<friendId>` for an instant banner. The banner must appear within 2 seconds. Add the table to the Realtime publication in the migration.
- Nudge delivery: keep both broadcasts from ADR 0007. The Buddy List already listens on `inbox`. Add the row shake, the badge, and the Recent Nudges log there.
- Chat windows still never `track()` presence (ADR 0003).

### 7.3 UI

No new routes. All Client Components.

Buddy List header: "Buzz", online count, "Up for Chat" toggle, bell with Recent Nudges panel (a small popover, not a window).

Friend row: Avatar, Display Name, Status Icon, Status or Now Playing line, Nudge badge, "Say hi" if Up for Chat.

Chat Window header: friend name, Presence, Now Playing, Hangout button with template picker, existing Nudge button.

Hangout banner: one shared component in the Buddy List (pinned above the list) and the Chat Window (top of the message list).

Styling: the existing Skin. No new design system. Big click targets, plain words.

### 7.4 Expiry

Use the existing `pg_cron`. Add a job in the new migration that marks `pending` Hangouts older than 15 minutes as `expired` every minute. The client also treats any `pending` Hangout older than 15 minutes as expired on read, so the banner disappears on time even if the job lags.

### 7.5 Tests

Unit-test as pure logic in `lib/`: sort order, Up for Chat timer and restore rules, Hangout state transitions and expiry, Recent Nudges log (cap of 10, newest first), the 5-in-10-minutes limiter. Follow the existing `__tests__` layout.

## 8. Tasks, in build order

Do each task fully, then typecheck and lint, then manual test with two users, before the next.

1. Read `lib/friends/arrange.ts`, `lib/realtime/inbox.ts`, `lib/nudge/`, and the ADR 0009 helper. Note what already meets R1 and R5 and skip it.
2. Migration: `hangouts` table, indexes, partial unique index, RLS, publication, cron expiry. Verify with two test users: user A cannot read B's Hangouts to C, a forged `sender_id` insert fails, a second pending insert for the same pair fails, an ignored sender's insert fails.
3. Buddy List sort and online count (R1). Verify a Presence change re-sorts within 2 seconds.
4. Empty state (R1). Verify it shows only with zero friends online.
5. Up for Chat (R2). Verify the other user sees the highlight, and the toggle and timer restore the old Status.
6. Hangout send in the Chat Window (R3): template picker, custom field, pending guard, Busy hint, Offline disabled.
7. Hangout receive: banner in the Buddy List and Chat Window with Accept and Decline. Verify it shows within 2 seconds.
8. Hangout respond and expiry: accept line, decline line for sender, expiry. Verify all three paths with two users.
9. Nudge Buddy List feedback: row shake, badge, Recent Nudges log. Verify with the Chat Window closed and not focusable.
10. Recent Nudges panel and "Nudge back". Verify badge clears when the chat opens.
11. Nudge rate limit: 5 per 10 minutes plus existing cooldown. Verify the message on the sixth attempt.
12. Now Playing in the row and Chat Window header (R5). Verify truncation at 40 characters.
13. Polish: check empty states, Busy hint, no fake green dots, update `GLOSSARY.md`, update README Status, run `tsc --noEmit`, lint, tests, build the installer, run the Section 9 scenario.

## 9. Verification checklist, two user test

Run two app instances, user A and user B, friends, both signed in.

1. A taps "Up for Chat". B sees A highlighted with "Up for chat, say hi!".
2. B opens A's chat, picks the Hangout "Just talk for a bit?". A sees the banner in the Buddy List within 2 seconds.
3. A taps Accept. Both see "[Name] accepted: Just talk for a bit?".
4. A closes the chat and Nudges B. B's row shakes and B hears the sound.
5. B opens the chat. The badge clears.
6. B opens Recent Nudges, sees A's Nudge, taps "Nudge back". A receives it.
7. A Nudges B repeatedly. The 10 second cooldown shows between attempts, and the sixth within 10 minutes is blocked with the limit message.
8. B signs off. A sees B go Offline at the bottom of the list, and the Nudge and Hangout buttons are disabled with a reason.
9. B returns, A sends a Hangout, B does nothing for 15 minutes. It expires on both sides.
10. B puts A on the Ignore List. A cannot send B a Hangout or a Nudge.

If any step fails, fix that task. Do not move on.

## 10. Decisions

- All UI copy is English. Code uses the term "Hangout".
- Recent Nudges is local only. Syncing it across computers would need a table and a new ADR superseding part of 0007.
- "Say hi" sends a Message (see R2).

## 11. Demo scenario for the video, under 3 minutes

Demo one night, one trigger. Do not walk through features one by one.

Scene 1, 0 to 40 seconds: B is bored at night, opens Buzz, sees two friends around, one Up for Chat.
Scene 2, 40 to 90 seconds: B sends A the Hangout "Just talk for a bit?". A sees the banner, taps Accept, the chat opens.
Scene 3, 90 to 150 seconds: A Nudges B. B's window shakes. B Nudges back from Recent Nudges.
Close, 150 to 180 seconds: one line on screen: "WhatsApp is for sending messages. Buzz is for meeting people."

No group chat, no calls, no feed.

## 12. Task 1 findings (code read, no code changed)

What already exists, and what each task must actually change:

- **R1 sort.** `arrangeBuddyList` (`lib/friends/arrange.ts`) puts online friends (Available, Away, Busy) first, sorted by name only, then Offline sorted by name. Away and Busy are mixed in with Available. Task 3 changes the online sort to Available, Away, Busy, then name. Offline-last already works.
- **R1 count.** The Buddy List shows `Group (online/total)` per group only. There is no overall "N online now" header. Task 3 adds it. The overall count excludes Offline and Invisible-as-Offline friends.
- **R1 empty state.** None exists. Only "No friends yet" (zero friends) and "No friends match" (search). Task 4 adds "No one is around right now." for friends who exist but are all offline, and must not show it when "show offline" hides the list for another reason.
- **R4 nudge inbox.** `useNudgeInbox(me, onNudge)` delivers only the sender id, with no timestamp. `BuddyList` handles it by calling `openChatWindow(sender, { nudge: true })` for friends who are not ignored. Task 9 needs the hook to pass a received time, or the caller to stamp it. Nudges from non-friends and ignored people are already dropped, so the Recent Nudges log gets only those that pass the same check.
- **R4 cooldown.** `lib/nudge/cooldown.ts` is a pure per-friend module (`NUDGE_COOLDOWN_MS` = 10 s), stored as a timestamp string in `localStorage`. The 5-in-10-minutes limiter should be a sibling pure module there, with the same read-from-storage clamping.
- **R5 Now Playing.** The row (`FriendListItem`) already shows it, cut by CSS `truncate`, not at 40 characters. The Chat Window shows it in the body (`ChatWindow.tsx` near line 420), not in the header. The profile limit is 140 characters (`NOW_PLAYING_MAX`). Task 12 adds a display-only 40 character cut for the row and moves it into the header. Do not lower the stored limit.
- **R6 ignore helper.** `is_ignored_by(owner text)` is security definer, takes a text id, checks `ignored_users` for (`owner`, `auth.uid()`), and is used in the `messages` insert policy. The `hangouts` insert policy should call `not public.is_ignored_by(receiver_id::text)` the same way. Ignoring is one-way, so the ignorer can still send.
- **R6 realtime.** Inbox and chat channels are already private with policies in migrations `...000600` and `...001000`. The inbox policies check only the topic and the `broadcast` extension, not the event name, so a `hangout` event on `inbox:<friendId>` needs no new channel policy.
- **IDs.** `profiles.id` is `uuid`. Realtime topics and `is_ignored_by` use text. Cast with `::text` in policies.
- **Presence limits still apply.** Hiding an ignorer's presence is client-side only (ADR 0009). The Hangout Offline-disable check uses the same `hideIgnorers` view of presence.

Nothing in Tasks 1 to 13 needs to be dropped. Task 5 (Up for Chat) has no existing code to reuse. Status is `profiles.status_message` (max 140), so "Up for chat, say hi!" fits.
