# Design: Buzz Trigger

Full detail: [spec.md](./spec.md) sections 7 and 12. This file fixes the
module layout and the order of dependencies.

## Principles

- Pure logic in `lib/` with unit tests next to it (`__tests__`). Components stay thin.
- All Supabase access through `lib/supabase/` typed client. No raw `fetch`.
- No new routes. Client Components only.
- Presence stays in the `presence:global` channel. Chat windows never `track()` (ADR 0003).
- Nudges are never stored (ADR 0007). Hangouts are stored, because they have state (pending, accepted, declined, expired).

## Data

One migration: `supabase/migrations/20250101001300_hangouts.sql`.

- Table `hangouts` (columns, checks, indexes as in spec 7.1).
- Partial unique index on `(least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status = 'pending'`.
- RLS: select for both parties; insert needs `sender_id = auth.uid()`, an accepted friendship, and `not public.is_ignored_by(receiver_id::text)`; update by trigger-guarded transitions only (receiver: pending to accepted or declined; sender: pending to expired when older than 15 min; `text`, `sender_id`, `receiver_id`, `created_at` immutable); no delete.
- Add to `supabase_realtime` publication.
- `pg_cron` job every minute: pending older than 15 min becomes expired.
- Regenerate `lib/supabase/database.types.ts`. Extend `npm run test:rls` with the four checks from spec Task 2.

## Modules

| Path | Purpose | Tested |
| --- | --- | --- |
| `lib/friends/arrange.ts` | Sort change: Available, Away, Busy, Offline, then name; overall online count helper | yes |
| `lib/status/upForChat.ts` | Start, stop, expiry, restore rules; `localStorage` record | yes |
| `lib/hangout/templates.ts` | Fixed templates, custom text validation (1 to 60) | yes |
| `lib/hangout/state.ts` | Transitions, 15 min expiry on read, system line text | yes |
| `lib/hangout/api.ts` | Insert, respond, list pending, via typed client | via RLS script |
| `lib/hangout/useHangouts.ts` | Subscribes on `inbox:<me>`: two `postgres_changes` bindings (receiver, sender) plus broadcast for instant banner | manual |
| `lib/nudge/limiter.ts` | 5 per 10 minutes, all friends, `localStorage`, clamped reads | yes |
| `lib/nudge/recent.ts` | Last 10 received, newest first, `localStorage` | yes |
| `lib/realtime/inbox.ts` | Pass a received timestamp with each Nudge | existing tests updated |

Components: `HangoutBanner` (shared by Buddy List and Chat Window),
`HangoutPicker`, `RecentNudgesPanel` (popover). Changes to `BuddyList`,
`FriendListItem`, `ChatWindow` header.

## Flow: Hangout

1. Sender picks a template in the Chat Window. Client checks friend Presence (not Offline) and no pending Hangout, then inserts.
2. The insert fires the `postgres_changes` binding on the receiver's inbox channel. A broadcast on `inbox:<friendId>` is sent in parallel for speed.
3. Receiver's Buddy List and Chat Window show `HangoutBanner`. Accept or Decline updates the row.
4. The sender's `sender_id` binding sees the update and renders the system line from the row. System lines are never inserted into `messages`.

## Flow: Nudge feedback

`useNudgeInbox` hands `(senderId, receivedAt)` to `BuddyList`. For friends who pass the existing friend and ignore checks: append to Recent Nudges, shake the row, open the chat as today. If the window cannot take focus, increment the row badge until that chat opens.

## Live profile updates (R0)

`useFriendProfiles` in `lib/friends/` subscribes to `postgres_changes`
UPDATE on `profiles` with filter `id=in.(<friend ids>)` (Realtime caps an
`in` filter at 100 values; chunk channels beyond that). `profiles` is
already in the `supabase_realtime` publication (migration `...000200`).
The Buddy List merges updates into `friends`; each Chat Window subscribes
for its one friend. No new table, no new policy.

## Automatic Now Playing (R7)

Reading happens in Rust in `src-tauri/src/now_playing/`, one file per OS
behind `#[cfg(target_os)]`, all returning the same struct
`{ artist: Option<String>, title: String, playing: bool }`.

| OS | Source | Crate | Why |
| --- | --- | --- | --- |
| Linux | MPRIS over D-Bus (Spotify, VLC, mpv, Chrome, Firefox) | `mpris` (Linux-only dependency) | Small, focused API. Uses the `dbus` crate, already in `Cargo.lock` through Tauri, so no new system library |
| Windows | System Media Transport Controls (Spotify, browsers, Media Player, VLC) | `windows` with `Media_Control` and `Foundation` features (Windows-only), same version Tauri already pulls in | Official Microsoft bindings |
| macOS | AppleScript to Spotify and Music via `osascript` | none (std `Command`) | MediaRemote is blocked for third-party apps from macOS 15.4 |

A background thread checks the OS every 3 seconds and emits a Tauri event
`now-playing` only when the track changes. The OS check is a local
read on the user's own computer, not a network poll, so the no-polling
rule for Realtime is untouched. Tauri commands: `now_playing_start`,
`now_playing_stop`, `now_playing_supported`.

Client: `lib/nowPlaying/auto.ts` holds pure rules (format, 140 cut,
30 second pause grace, manual-line-wins, 10 second write throttle) with
unit tests. `useAutoNowPlaying` in the Buddy List window listens to the
event and writes `profiles.now_playing` through the typed client. The
setting lives in `localStorage` with the other sign-in options.

## Risks

- Realtime Authorization policies for the inbox only check topic and extension, so no new channel policy is needed. Verify in the two-instance test.
- Presence view for the Offline check must use `hideIgnorers`.
- Up for Chat survives only while the app runs, or until next start (spec R2.4).
