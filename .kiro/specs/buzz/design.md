# Buzz — Design

## Overview

Buzz is a Yahoo Messenger revival as a native desktop app for
Windows, Linux, and macOS, built around presence rather than content. A signed-in user sees which friends are
around, sets a Status and a Now_Playing line, and chats with one friend
at a time in real time. The signature interaction is the Nudge: a 600 ms
window shake plus a short sound, with a 10-second cooldown that prevents
spam. There is no feed, no algorithm, no infinite scroll, and no
stranger discovery beyond a direct friend request. Buzz does not
implement end-to-end encryption and never claims to.

This design covers all ten requirements: email sign-in, profile, friends,
presence, 1:1 real-time chat, nudge, status/now-playing, emoticons and
YM-era skin, offline messages, and the typing indicator.

### Design goals

- **Presence first.** The friend list is the home screen. Who is online
  matters more than what was said.
- **Persistence over polling.** Chat, presence, and typing use Supabase
  Realtime. There are no polling loops. Messages live in Postgres so
  they survive a window reload.
- **Pure logic is testable in isolation.** Validation, parsing,
  cooldown, presence transitions, and typing state are pure functions
  with no I/O, so they can be property-tested. Supabase Auth, Postgres,
  Realtime, and Storage are treated as integration boundaries.
- **Least privilege.** Row Level Security is on for every table and is
  the primary access-control mechanism. The service key never ships in
  the app.

### Research findings that shaped the design

- Supabase Realtime clients must heartbeat at least every 25 seconds or
  the connection times out ([Realtime troubleshooting][rt]). This grounds
  the Requirement 4.6 guarantee (offline within 60s of a dropped
  connection): a missed heartbeat triggers reconnection, and if it is
  not restored the server removes the client's presence entry. We run a
  client heartbeat at 25s and rely on the presence timeout for the
  offline report.
- Supabase ships `pg_cron` for scheduled SQL jobs ([Supabase Cron][cron]).
  The 30-day offline-message retention (Requirement 9.6) is a daily
  `pg_cron` `DELETE`, run server-side with no app code.

[rt]: https://supabase.com/kb/troubleshooting/realtime-messages-not-arriving
[cron]: https://supabase.com/docs/guides/cron

## Architecture

Next.js App Router + TypeScript (strict) client built as a **static
export** and wrapped by **Tauri** into a native desktop app for
Windows, Linux, and macOS. Supabase (Auth, Postgres, Realtime,
Storage) is the only backend, cloud-hosted. Tailwind CSS. No Vercel,
no custom server, no second database.

### Layering

```
+--------------------------------------------------------------------+
|  Tauri shell (src-tauri/): native OS windows + one webview per     |
|  window. The Buddy List is the main window; each chat opens its   |
|  own window (classic YM).                                          |
+--------------------------------------------------------------------+
|  Next.js App Router (static export, Client Components only; no     |
|  server runtime) — subscribe to Realtime and capture input         |
+--------------------------------------------------------------------+
|  lib/  pure-logic modules (no I/O) — validation, emoticons, nudge,  |
|        presence, typing, friends, chat queries                      |
+--------------------------------------------------------------------+
|  lib/supabase/  typed browser client (publishable key; the only     |
|        Supabase access point; no raw fetch to Supabase URLs)       |
+--------------------------------------------------------------------+
|  Supabase: Auth (client-side sessions) | Postgres (data, RLS) |    |
|        Realtime (presence, chat, typing, nudge) | Storage (avatars)|
+--------------------------------------------------------------------+
```

The rule from `tech.md` is honored: components never call Supabase
directly. They go through the `lib/supabase/` browser client and `lib/`
pure-logic modules. Realtime is used for chat, presence, typing, and
nudge; there are no polling loops. Presence lives in the Realtime
channel, never as a Postgres column. The browser client is the only
Supabase access point; there is no server client because the app has no
server runtime (static export).

### Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/login` | Client | Sign-in form (Requirement 1) |
| `/signup` | Client | Sign-up form (Requirement 1) |
| `/` | Client (auth-gated) | Buddy List window (home) |
| `/chat?friendId=<id>` | Client (auth-gated) | Chat window, opened in its own Tauri window (Req 5.6) |
| `/profile` | Client (auth-gated) | Edit profile (Requirements 2, 7) |

There is no Next.js middleware (the app is a static export with no
server runtime). Supabase Auth manages the session client-side,
persisted in the webview storage, so a window reload restores the
session and keeps the user signed in (Requirement 1.4).

### Realtime channels

1. **`presence:global`** (presence). The signed-in client tracks
   `{ user_id, presence_state }` where `presence_state` is
   `online | away | busy`. `offline` is the absence of a presence entry.
   Only the **Buddy List window tracks** on this channel, so one user
   produces one presence entry regardless of how many chat windows are
   open. Chat windows subscribe **read-only** (never `track()`) to see
   the friend's state for the Nudge button (Requirement 6.4); see
   `docs/adr/0003`. Activity in chat windows reaches the Buddy List
   through a `localStorage` `storage` event (`lib/realtime/activity.ts`,
   `docs/adr/0008`), so chatting keeps the user Available (4.1, 4.2).
   The idle check runs every 5 s, so Away is reported within 10 s of the
   5-minute mark (4.2).
2. **`chat:<pairKey>`** (postgres_changes + broadcast). `pairKey` is
   `canonicalPair(a, b)` joined as `"<min>_<max>"`. The channel carries:
   - `postgres_changes` on `messages` `INSERT`, two bindings on the one
     channel: `receiver_id=eq.<me>` and `sender_id=eq.<me>`, keeping only
     rows of this pair (so my own sends from another instance appear).
     One DB insert both persists the message and broadcasts it, so
     Requirement 5.2 (deliver in under 2s) and 5.3 (survive reload) are
     satisfied by a single write.
   - `broadcast` events `typing` (Requirement 10) and `nudge`
     (Requirement 6), which are ephemeral and never written to Postgres.
     A `typing` payload is `{ sender, stopped }`; the sender broadcasts
     `stopped: true` right after a send, and because broadcasts arrive in
     order it clears the friend's indicator for good (10.3).
3. **`inbox:<userId>`** (broadcast only, private). Each Buddy List listens on its
   own inbox; Realtime Authorization lets only accepted friends send to it,
   and `chat:<pairKey>` is private to the pair the same way (migration
   `20250101000600`). A nudge is sent there too (REST broadcast, no subscription
   needed), so a friend whose chat window is closed still gets it: their
   Buddy List opens the chat window with `buzz=1` and it shakes (6.6,
   classic YM). Nudges from non-friends are ignored.
4. **profiles feed** (postgres_changes on `profiles` `UPDATE`). The
   friend list and chat headers subscribe to profile updates for the
   user's friends so a changed Display_Name, Avatar, Status, or
   Now_Playing appears within ~5s without a reload (Requirements 2.3,
   7.1, 7.2, 4.5).

### Persistence vs. ephemeral state

| State | Where | Why |
| --- | --- | --- |
| Profile (name, avatar, status, now playing) | Postgres `profiles` | Must survive reload; friends read it |
| Friendships | Postgres `friendships` | Must survive reload; drives RLS |
| Messages | Postgres `messages` | Must survive reload; one insert broadcasts |
| Presence state | Realtime channel only | Never in Postgres (tech.md) |
| Typing indicator | Realtime broadcast only | Ephemeral |
| Nudge | Realtime broadcast only | Ephemeral; cooldown is client-side |
| Offline-message delivery tracking | Postgres `messages.delivered_at` / `read_at` | Must survive reload and retry |

### Desktop packaging (Tauri)

The client is a Next.js **static export** (`output: 'export'`) loaded
into Tauri's native webview — WebView2 on Windows, WebKitGTK on Linux,
WKWebView on macOS. `src-tauri/` holds the Rust shell: the window
manager, the build config, and the bundlers that produce per-OS
installers (`.msi`/`.exe` Windows, `.deb`/`.AppImage` Linux,
`.dmg`/`.app` macOS). There is no Vercel; releases are desktop
artifacts.

The Buddy List (`/`) is the **main window**. Opening a chat emits an
IPC call to the Tauri shell, which creates a **new OS window** for
`/chat?friendId=<id>` (Requirement 5.6). Windows use **custom
decorations** (frameless) with the in-app purple gradient title bar
(see UI/UX) to match classic YM chrome, plus standard min/max/close
controls. The presence channel is owned by the Buddy List window only
(see Realtime), so multiple chat windows do not create duplicate
presence entries.

## Components and Interfaces

### UI components

| Component | Responsibility | Requirement |
| --- | --- | --- |
| `SignInForm` / `SignUpForm` | Email + password entry, client-side format hints, server error display | 1 |
| `ProfileEditor` | Editable Display_Name, Avatar, Status, Now_Playing with live char counters | 2, 7 |
| `AvatarUpload` | Drag/click upload, client size+MIME check, preview | 2 |
| `FriendSearch` | Search by email or Display_Name, results list | 3 |
| `FriendList` | Friends with avatar, name, presence dot, status; pending requests section | 3, 4, 7 |
| `FriendListItem` | One row: avatar, name, presence dot, status/now-playing | 3, 4 |
| `PendingRequests` | Incoming friend requests with accept/decline | 3 |
| `ChatWindow` | Header (friend name, presence, Nudge button) + message list + input; renders inside its own Tauri OS window (Req 5.6) | 5, 6 |
| `MessageList` | Renders most-recent-50 then appends; renders emoticons | 5, 8 |
| `MessageInput` | Textarea with char counter, Emoticon picker, send on Enter | 5, 8 |
| `MessageBubble` | Sender/receiver styling, emoticon rendering, system lines | 5, 6, 8 |
| `EmoticonPicker` | Grid of ≥30 classic emoticons; inserts shortcode at cursor | 8 |
| `NudgeButton` | Disabled when offline; 10s cooldown countdown; not-delivered message | 6 |
| `TypingIndicator` | "<Display_Name> is typing..." line in chat | 10 |
| `PresenceDot` | Color-coded dot for online/away/busy/offline | 4 |
| `SkinProvider` | Applies the YM-era Skin: the custom frameless-window title bar (purple gradient), color tokens, typography, and >=4.5:1 contrast | 8 |

### `lib/` pure-logic modules (the property-test surface)

These modules contain no I/O. They are the targets for property-based
testing; everything Supabase-related is an integration boundary.

```ts
// lib/emoticons/shortcode.ts
type Token = { type: 'text' | 'emoticon'; value: string }; // value = text or image path
export const SHORTCODE_MAP: Record<string, string>;      // ≥30 entries, e.g. ":)" -> "/emoticons/smile.png"
export function renderMessage(body: string): Token[];     // split into text + emoticon tokens
export function insertAtCursor(text: string, pos: number, shortcode: string): { text: string; pos: number };

// lib/validation/profile.ts
export function isValidEmail(s: string): boolean;        // local-part@domain
export function isValidPassword(s: string): boolean;     // 8..128 chars
export function displayNameFromEmail(email: string): string; // prefix before '@', truncated to 50
export function isValidDisplayName(s: string): boolean;   // non-empty after trim
export function isValidStatus(s: string): boolean;       // length <= 140
export function isValidNowPlaying(s: string): boolean;    // length <= 140
export function isValidMessageBody(s: string): boolean;  // non-empty, non-whitespace-only, length <= 1000
export function checkAvatar(file: { size: number; type: string }): { ok: boolean; reason?: string };

// lib/presence/state.ts
export type PresenceState = 'online' | 'away' | 'busy' | 'offline';
export type PresenceEvent =
  | { type: 'activity'; now: number }
  | { type: 'idleTimeout'; now: number; lastActivityAt: number }
  | { type: 'setBusy' }
  | { type: 'setOnline' }
  | { type: 'disconnect' }
  | { type: 'heartbeatMissed' };
export function nextPresenceState(current: PresenceState, e: PresenceEvent): PresenceState;

// lib/nudge/cooldown.ts
export interface NudgeCooldown { lastNudgeAt: number | null }
export function isInCooldown(s: NudgeCooldown, now: number): boolean;   // now - lastNudgeAt < 10_000
export function onNudgeResult(s: NudgeCooldown, now: number, delivered: boolean): NudgeCooldown;

// lib/typing/state.ts
export interface TypingState { lastKeystrokeAt: number | null; sent: boolean }
export function shouldShowTyping(s: TypingState, now: number): boolean; // now - lastKeystrokeAt < 3000 && !sent
export function onKeystroke(s: TypingState, now: number): TypingState;
export function onSend(s: TypingState): TypingState;

// lib/friends/search.ts
export function searchUsers<U extends { id: string; email: string; display_name: string }>(
  users: U[], query: string, selfId: string, limit?: number): U[]; // case-insensitive contains on email or display_name, excludes self, capped at 50
export function canonicalPair(a: string, b: string): [string, string];
export function pairKey(a: string, b: string): string;
export function canSendRequest(rel: { status: string } | null, selfId: string, recipientId: string): { ok: boolean; reason?: string };

// lib/chat/messages.ts
export function loadRecentMessages<M extends { created_at: string }>(all: M[], limit?: number): M[]; // 50 most recent by created_at, oldest-first
export function isOfflineMessage<M extends { delivered_at: string | null }>(m: M): boolean;

// lib/offline/retention.ts
export function shouldRetain<M extends { delivered_at: string | null; created_at: string }>(m: M, now: number): boolean; // delivered_at null AND created_at > now - 30d
```

### Supabase client interfaces (`lib/supabase/`)

- `browser-client.ts` — `createBrowserClient(URL, ANON_KEY)` with the
  generated `database.types.ts`. Used by every window for Realtime and
  for reads/writes permitted by RLS. This is the only client; there is
  no server client because the app is a static export with no server
  runtime.
- `database.types.ts` — generated with `supabase typegen`, the single
  source of truth for table types.

The service-role key is never imported by the app. It exists only for
Supabase SQL migrations and the `pg_cron` retention job; all in-app
operations use the publishable key and RLS.

### Key flows

**Send a message (Req 5).** `MessageInput` validates the body with
`isValidMessageBody`; on reject it shows an error and stores nothing
(5.4). On accept it inserts a row into `messages`. The insert triggers
the `chat:<pairKey>` postgres_changes subscription, delivering it to a
connected friend in under 2s (5.2) and persisting it for reload (5.3).
If the friend is offline the row is stored with `delivered_at = null`,
and the Offline_Message_Service delivers it when the friend returns
(5.5, 9).

**Receive on return (Req 9).** When a client connects, it queries
`messages` where `receiver_id = me AND delivered_at IS NULL`, ordered by
`created_at` (chronological, 9.2), renders them, and sets
`delivered_at = now`. If that update fails the row stays
`delivered_at = null` and is retried on the next connect (9.5). A message
that arrives while the Buddy List is open is stamped `delivered_at` at
once. Delivered rows share one timestamp; display order always comes from
`created_at` (9.2). `read_at` is set only while the chat window is
focused and visible: after history loads, on focus, and on arrival if
focused (9.3), so unread badges survive an unfocused window.

**Nudge (Req 6).** `NudgeButton` is disabled when the friend is offline
(6.4). On click (or Ctrl+G) it broadcasts `nudge` on `chat:<pairKey>` and
on the friend's `inbox:<friendId>` in parallel; it counts as delivered if
either is accepted, then shows "You nudged <Display_Name>" (6.2) and
starts the 10 s cooldown (6.3). The cooldown is saved in `localStorage`
per friend, so closing and reopening the chat doesn't reset it. If both
sends fail it shows a not-delivered message and leaves the button enabled
with no cooldown (6.5). On the receiving side, an open chat window shakes
(600 ms OS-window shake, CSS fallback) and plays a ≤1 s Web Audio buzz
(6.1); if the chat window is closed, the Buddy List opens it and it
shakes on load (6.6). An already open window is only focused by the
inbox path, so it never shakes twice.

## UI/UX Specification

Buzz replicates the **classic desktop Yahoo Messenger (versions 6-8)** look, not a modern flat redesign. The app is presented as **real OS windows** — the **Buddy List** (home) is one window and each open conversation is its own window (classic YM behavior) — with glossy gradient title bars, yellow smiley status icons, the side avatar column in chat, and the bottom toolbar carrying the Emoticon button and the Buzz button. The Yahoo brand purple is the base accent color (Requirement 8.4), carried in the window title bars; the rest of the palette is the light-gray/white classic client chrome.

The implementation must match the classic YM 6-8 reference look. The hex values below are the target; for the smiley glyphs and window chrome the implementer should match classic YM reference screenshots.

### Skin: color tokens and typography

| Token | Value | Use |
| --- | --- | --- |
| `--ym-purple` | `#6400cd` | Yahoo "Glossy Purple"; title-bar gradient start, focus |
| `--ym-purple-deep` | `#2f1050` | Yahoo "Russian Violet"; title-bar gradient end |
| `--ym-blue` | `#0067fa` | Yahoo "Brandeis Blue"; secondary accent, links |
| `--ym-titlebar-text` | `#ffffff` | Title-bar text (white on purple; >=4.5:1, Property 19) |
| `--ym-window-bg` | `#ececec` | Window/chrome background (light gray) |
| `--ym-panel-bg` | `#ffffff` | Conversation pane, input, list rows |
| `--ym-border` | `#b8b8b8` | Window and control borders |
| `--ym-row-hover` | `#d9e8ff` | Buddy-list row hover (pale blue) |
| `--smiley-available` | `#ffcc00` | Online/available yellow smiley face |
| `--idle-clock` | `#ffcc00` | Away/idle yellow clock icon |
| `--smiley-busy` | `#e8820a` | Busy orange "do not disturb" icon |
| `--smiley-offline` | `#b3b3b3` | Offline faded gray smiley |
| `--buzz-red` | `#cc0000` | "BUZZ!!!" text (red, bold, uppercase) |
| `--msg-self` | `#0066cc` | My own message sender name color |
| `--msg-friend` | `#cc3300` | Friend's sender name color |

- **Typography:** a system sans-serif stack `Tahoma, Verdana, Segoe UI, sans-serif` at `13px` base; the conversation pane at `13px`, buddy-list rows at `12px`, title-bar text at `12px` bold white. Classic YM used a small Tahoma/Verdana; this stack is the web equivalent.
- **Window chrome:** every window (Buddy List, Chat, Sign-in, Profile) is a **frameless Tauri window** with a custom in-app purple gradient title bar (linear-gradient `--ym-purple` to `--ym-purple-deep`), rounded top corners (`border-radius: 6px 6px 0 0`), a 1px `--ym-border` outline, the YM title text, and standard min/max/close window controls. This is the "rounded corners, glossy surface highlight" of Requirement 8.4 and makes each window look like a classic YM window rather than a browser tab. The OS windows are **transparent** (`transparent: true`, page background `transparent`) so the rounded corners show instead of a square backing. Transparency needs a compositing window manager on Linux, and on macOS it needs Tauri's `macos-private-api` feature (enabled; it only matters for Mac App Store submission, which we don't target).
- **Contrast:** every text/background pair meets >=4.5:1 (Property 19). White on `--ym-purple` and dark text on `--ym-window-bg`/`--ym-panel-bg` both pass.

### Sign-in / Sign-up window

A centered single "window" card on a neutral desktop background, classic-YM login style:
- Purple gradient title bar reading "Yahoo! Messenger - Sign In" (and "- Sign Up" on the signup route).
- A form panel with: Email field, Password field, a "Sign In" primary button (purple), a "Remember my ID" checkbox (classic YM touch), and a "Sign Up" link (Req 1.1). Validation errors render inline beneath the relevant field (Req 1.8, 1.9).
- No friend list, no chat — the whole viewport is the login window until a session exists.

### Buddy List window (home, route `/`)

The home screen IS the Buddy List — a single narrow vertical OS window, not a feed. Layout top-to-bottom:
1. **Title bar** (purple gradient): "Yahoo! Messenger" with the yellow smiley logo glyph.
2. **My status header**: my Avatar (small, ~32px), my Display_Name (bold), my current Status text underneath, and my Now_Playing line with a music-note glyph. A status-smiley selector dropdown sets online/away/busy (Req 4.3).
3. **Contact list**: collapsible groups (e.g. "Friends", "Family"). Each group has an expand/collapse triangle and a count "(online/total)". Offline friends are shown dimmed under their group (classic YM kept them listed, greyed), sorted online-first then alphabetical.
4. **Contact row** (`FriendListItem`): status smiley icon (see below) + Display_Name + Status/Now_Playing subtext. Hover highlights with `--ym-row-hover`. Clicking opens the IM Window for that friend.
5. **Pending requests** section: rows with Accept/Decline buttons (Req 3.2-3.4).
6. **Footer**: a search box (clicking opens `FriendSearch`, Req 3.1) and an "Add" affordance.
- Live updates without reload: presence changes (Req 4.5) and profile changes (Req 2.3, 7) arrive via the Realtime profiles feed and re-render the row in place.

### Menu bar, status selector, and contact menu

The Buddy List window has the classic-YM menu bar across the top (below
the title bar): **Messenger | Contacts | Actions | Help**. Menu items map
to Buzz's in-scope features; out-of-scope YM items are omitted entirely
(see Out-of-scope YM features), not shown as disabled controls.

- **Messenger**: My Status (submenu), My Display Image, Change Skin /
  IMVironment, Preferences, **Sign Out** (Req 1.5).
- **Contacts**: Add a Contact (opens FriendSearch, Req 3.1), Contact
  Search.
- **Actions**: Send an Instant Message (opens a chat window, Req 5.6).
- **Help**: About Buzz, Help.

**Status selector.** The "My Status" control is the classic-YM status
smiley dropdown. It offers **Available** (online, Req 4.1) and **Busy**
(Req 4.3), plus a **Custom Status...** dialog that types a status message
(Req 7) with the playful YM presets (Be Right Back, Stepped Out, Out to
Lunch, Not at My Desk, On The Phone) that fill the status text; presence
stays Available until the 5-minute auto-away (Req 4.2). Classic YM's
**Invisible** (stealth) is out of the locked presence scope and is
omitted.

**Contact context menu** (right-click a contact): Send an Instant
Message (Req 5.6), View Profile (Req 2), Remove Friend (Req 3.5). YM's
Send a File, Voice Call, and Stealth Settings are out of scope and
omitted.

### Status icons (presence smileys)

The classic YM colored smiley faces map to `PresenceState`:

| Presence | Icon | Meaning |
| --- | --- | --- |
| `online` | yellow smiley face (`--smiley-available`) | available (Req 4.1) |
| `away` | yellow clock (`--idle-clock`) | idle >5 min (Req 4.2) |
| `busy` | orange "do not disturb" icon (`--smiley-busy`) | user-set busy (Req 4.3) |
| `offline` | faded gray smiley (`--smiley-offline`) | not connected (Req 4.4, 4.6) |

`PresenceDot` renders the matching classic-YM glyph (yellow smiley, yellow
clock, orange DND, faded gray smiley); the buddy-list row and the IM
window header both read it. Classic YM also had a white/light-gray
"asleep" face for offline — Buzz uses the faded gray smiley.

`PresenceDot` renders the matching smiley glyph; the buddy-list row and the IM window header both read it.

### IM / Chat window (route `/chat?friendId=<id>`, its own OS window)

Each conversation opens as its own OS window (classic YM IM window), separate from the Buddy List (Requirement 5.6). Layout:
1. **Title bar** (purple gradient): the friend's Display_Name + presence smiley + their Status text; on the right the **Buzz button**.
2. **Conversation pane** (`MessageList`): the most recent 50 messages (Req 5.1), oldest at top, newest at bottom, auto-scrolling to bottom on new messages. Each message (`MessageBubble`):
   - Sender name in color (`--msg-self` for me, `--msg-friend` for friend), bold, followed by the time `HH:MM`.
   - Body on the next line with inline-rendered emoticons (Req 8.3).
   - System lines centered and italic, e.g. "You nudged <Display_Name>" (Req 6.2) and the incoming "BUZZ!!!" line (see Nudge).
3. **Typing indicator**: a single italic line "<Display_Name> is typing..." directly above the input area, shown while the friend is typing (Req 10.1) and cleared on 3s idle or on send (Req 10.2, 10.3).
4. **Toolbar** (above the input): classic-YM order — a font/color picker affordance, the **Emoticon button** (a yellow smiley face that opens `EmoticonPicker`), the **Buzz button** (labeled "Buzz!", also bound to `Ctrl+G`), and an IMVironment/skin selector affordance. This toolbar is part of `ChatWindow`.
5. **Input area** (`MessageInput`): a multi-line textarea with a char counter (<=1000, Req 5.4); Enter sends, Shift+Enter inserts a newline. Empty/whitespace or over-limit sends are rejected inline and not stored (Req 5.4).
6. **Display Image (avatar) column**: a narrow column on the right showing my Display Image and the friend's Display Image stacked (classic YM "Display Image" / Yahoo Avatar).
- Each conversation is its own OS window — there are **no tabs** (tabbed IMs were a much later YM 11.5 feature); this matches the classic 6-8 era.
- New messages are delivered in under 2s without reload (Req 5.2). If the friend is offline when a message is sent, it is stored and delivered on return (Req 5.5, 9); the input still accepts it.

### IMVironment (chat backdrop)

Classic YM let users skin an IM window with an **IMVironment** — a
themed, sometimes animated backdrop behind the conversation (floating
hearts, Dilbert, Hello Kitty, etc.). Buzz keeps this as an optional
**decorative backdrop** selectable from the toolbar's IMVironment
control: a small set of static background themes (e.g. a subtle
YM-purple tint, "hearts", "doodle paper") applied behind the
conversation pane only. It is a visual fidelity touch, not a functional
requirement (the default is a subtle purple tint); implementing it is
part of the ChatWindow/Skin work.

### Nudge ("Buzz!") interaction

The Nudge replicates Yahoo's "Buzz!" exactly:
- The friend's **entire chat OS window** shakes (a 600 ms CSS keyframe translate/shake animation, Req 6.1) and a **"BUZZ!!!"** line appears in the conversation in `--buzz-red`, **bold, uppercase** (the signature YM Buzz text). A short buzz sound (<=1s, Web Audio) plays on the receiver (Req 6.1).
- The sender sees the system line "You nudged <Display_Name>" (Req 6.2).
- The **Buzz button** is bound to `Ctrl+G` (the classic YM shortcut). It is disabled while the friend is offline (Req 6.4) and during a per-chat 10s cooldown after a delivered nudge (Req 6.3), showing a countdown. On delivery failure it shows "nudge was not delivered" and stays enabled with no cooldown (Req 6.5).

### Alerts and sounds

Classic YM played sounds and showed bottom-right toasts for several
events. Buzz keeps these as **optional, configurable** alert feedback
(toggled in Preferences) supporting the existing chat/presence/nudge
features — only the Nudge sound is required (Req 6.1):

- **A friend comes online**: a short sound plus an optional bottom-right
  toast "<Display_Name> is now online" (Req 4 presence).
- **A message is received** while the chat window is not focused: a short
  sound (Req 5 chat).
- **A Nudge is received**: the required <=1s buzz sound plus the window
  shake (Req 6.1).
- **Sign in**: a short sign-in sound when the session starts (Req 1).

Sounds are short Web Audio cues in the YM spirit; all but the Nudge sound
can be disabled in Preferences. The online-toast and message sound are
fidelity touches, not acceptance criteria.

### Emoticon picker and pack

`EmoticonPicker` opens a grid pop-over of classic-YM smileys; picking one inserts its Shortcode at the cursor (Req 8.2). The pack is the **classic Yahoo Messenger emoticon set** (the official YM shortcut list, 35+ visible emoticons) plus the classic hidden set. The `SHORTCODE_MAP` (Property 16, >=30 entries) includes at least:

| Smiley | Shortcode | Smiley | Shortcode |
| --- | --- | --- | --- |
| Smiling | `:)` | Crying | `:((` |
| Frowning | `:(` | Laughing | `:))` |
| Winking | `;)` | Tongue Out | `:P` |
| Big Grin | `:D` | Kiss | `:-*` |
| Battling Eyelashes | `;;)` | Surprise | `:-O` |
| Confused | `:-/` | Angry | `X(` |
| In Love | `:x` | Smug | `:>` |
| Blushing | `:">` | Sunglasses | `B-)` |
| Worried | `:-S` | Devil | `>:)` |
| Angel | `O:-)` | Nerd | `:-B` |
| Sleeping | `|-)` | Rolling Eyes | `8-|` |
| Sick | `:-&` | Don't Tell | `:-$` |
| No Talking | `[-(` | Clown | `:O)` |
| Silly | `8-}` | Thinking | `:-?` |
| Doh! | `#-o` | Clapping | `=D>` |

Plus hidden classics (`:@)` pig, `3:-O` cow, `:(|)` monkey, `~:>` chicken, `@};-` rose, `8-X` skull, `:-"` whistling, `:D/` dancing, and others) that render when typed but do not appear in the picker grid. Shortcodes are the canonical YM forms and the renderer accepts them case-insensitively. Unrecognized shortcode-shaped strings stay plain text (Req 8.5, Property 18).

The emoticon images are the classic yellow YM smiley style (glossy, the same family as the status icons). They render inline at the text baseline (~18px).

### Message rendering

- Sender name colored (`--msg-self` / `--msg-friend`), bold, then a space and the time.
- The body follows on the next line; recognized shortcodes become inline smiley images; everything else is text (Req 8.3). Concatenating the tokens reconstructs the body (Property 18).
- System lines (nudge sent/received, offline-delivered notices) render centered, italic, gray, distinct from user messages.

### Responsiveness and accessibility

- The Buddy List and each Chat are **real OS windows** (Tauri), independent and freely moved/resized like classic YM. Default sizes match the YM client (Buddy List ~260px wide; Chat ~420x360px); windows enforce a sensible minimum. There is no browser chrome and no phone layout: this is a desktop app, but each window is **responsive to its own size** (see Responsive window layout below).
- Keyboard: `Enter` sends a message, `Ctrl+G` buzzes, the Emoticon picker is reachable by its toolbar button and dismissible by `Esc`. All interactive controls are focusable with visible focus rings (the purple accent).
- The contrast floor (>=4.5:1) and the status-smiley color coding keep the classic look legible (Req 8.4, Property 19).

### Responsive window layout

Every window is the whole viewport (`WindowFrame` fills it), so the layout
responds to the **window size** with plain CSS media queries; there is no
JavaScript breakpoint logic. Sizes are enforced by the Tauri shell: the
Buddy List opens at 260x560 (minimum 220x400) and a chat window at 420x360
(minimum 320x280).

| Breakpoint | Applies to | Behaviour |
| --- | --- | --- |
| Narrow: width < 400 px | chat window | Pictures column hidden; the toolbar wraps onto a second line if needed (Req 11.2) |
| Regular: 400 to 899 px | all windows | Default layout |
| Wide: width >= 900 px | all windows | Content column capped at 720 px and centered; title bar and menu bar still span the window (Req 11.3) |
| Short: height < 340 px | chat window | Tighter padding and a 2-row message box so the newest message and input stay visible (Req 11.4) |

Related details: the chat window's arrangement is a presentational
`ChatLayout` (header, list, typing line, toolbar, input, pictures column) so
it can be shown without a network; the sign-in and sign-up windows use the
normal full-width frame with the form centered at up to 384 px; the menu bar
wraps onto a second line when its menus don't fit, and menus open from the
bar's left edge below 400 px; text fields get a visible border and white
background from a base style (Tailwind's reset removes them).

Rules that apply at every size (Req 11.1, 11.5, 11.6):
- Nothing has a fixed pixel width that can exceed the window: lists and text
  use `min-width: 0` with `text-overflow: ellipsis`; the Emoticon picker is a
  wrapping grid capped at the window width.
- The content area scrolls vertically; horizontal scrolling never appears.
- Window controls and the Send, Buzz!, and Emoticons buttons keep their
  size and stay clickable.

### Status model and icons (Requirements 12, 13)

The reference Yahoo Messenger windows (the `screenshoot/` folder, kept out of
version control) show one status control in the Buddy List header, the same
small face used for a person everywhere, and a login window with three
checkboxes. Buzz follows that shape with its own artwork.

| Availability | Icon | How it is reached | What friends see |
| --- | --- | --- | --- |
| Available | yellow smiley | chosen, or at sign-in | Available |
| Busy | orange busy sign | chosen, a Preset_Status, or a custom Status set to Busy | Busy |
| Away | clock | automatic after 5 minutes without activity | Away |
| Invisible | faded smiley inside a dashed ring (own view only) | chosen, or "Sign in as invisible" | Offline |
| Offline | faded smiley | signed out, or not reachable | Offline |

- **Presets set Busy.** Be Right Back, Not at My Desk, Not in Office, On the
  Phone, On Vacation, Out to Lunch, and Stepped Out each write their text to
  the Status and switch the Availability to Busy (Req 12.3). Yahoo's own help
  says the status text should match the Availability you pick (Busy or
  Available), which is why the text and the icon move together. Choosing
  Available clears a Status that came from a preset (Req 12.5).
- **Custom status** has a Busy/Available choice beside the text (Req 12.4).
- **Where the state lives.** Available, Busy, and Away stay in the tracked
  payload of `presence:global` as today. **Invisible is "do not track"**: the
  Buddy List calls `untrack()` and keeps listening, so friends see no entry.
  Only the user's own `myState` can be `invisible`; the pure state machine
  gains `setInvisible`, and like Busy it is not ended by activity or idle.
- **One icon component.** `PresenceDot` is the only place that maps an
  Availability to a picture; the Buddy List header, friend rows, chat window
  header, chat window title bar (`TitleBar` `icon` prop), and the tray icon all
  use it, so they cannot disagree (Req 12.9). The tray icon arrives with task
  25.7; until then Req 12.9 is met everywhere except the tray.
- **Presence send budget.** Supabase closes a client's channel after 5
  presence updates (`track` or `untrack`) in 30 seconds
  ([Supabase KB](https://supabase.com/kb/troubleshooting/realtime-client-presence-rate-limit-reached)).
  The tracker sends at most 4 per 30 s (`lib/realtime/presenceBudget.ts`) and
  coalesces: while over budget it waits and then sends only the newest state.
  So friends always end on the latest choice, but a burst of more than four
  changes can reach them up to 30 s late. The channel also reconnects when the
  server closes it. Sends wait until the channel has joined, a send the
  server rejects is retried after 5 s, and the reconnect backoff resets only
  after the channel has stayed up for 30 s.
- **Text before icon.** Choosing a preset, or Available over a preset text,
  saves the Status text first and changes the icon only once that worked, so
  the two never disagree; a failed save shows a message and changes nothing.
- **Defects found by the two-user test** (fixed): presence never announced
  itself at start-up, so friends looked Offline until someone changed status;
  and a fast run of status changes tripped the rate limit above, after which
  the channel stayed closed and no later change reached friends.

### Sign-in window (Requirement 13)

Fields: email, password. Checkboxes: "Remember my ID" (stores the email only),
"Sign in automatically", "Sign in as invisible to everyone". Links: "Get a new
account" (sign-up) and "Forgot your password?". The Messenger and Help menus sit
under the title bar.

- **Sign in automatically** unchecked: the main window's `StartupGate` drops
  a session left from an earlier run with `signOut({ scope: "local" })`
  before anything renders. "Earlier run" is told apart from a reload by a mark
  in `sessionStorage`, which lives for the window's page session and is gone
  after the app restarts. Chat windows skip the check (they have their own
  page session). Trade-off: the refresh token stays on disk until the next
  start; ending it on window close needs a Rust hook and is left for the tray
  work (task 25.7), which changes what "close" means anyway.
- The three choices and the remembered email are saved on the device
  (`localStorage`: `buzz.signInOptions`, `buzz.rememberedEmail`); the password
  is never stored.
- **Forgot password** is code-based because a desktop app has no web address for
  an emailed link to open: `resetPasswordForEmail(email)`, then
  `verifyOtp({ email, token, type: "recovery" })`, then `updateUser({ password })`.
  Checking the code signs the user in and spends it, so if saving the new
  password then fails (reused or weak password), the form stays on a
  password-only step instead of asking for the code again. The "too many
  requests" answer is shown like a success, because Supabase only rate-limits
  resends for existing accounts and a different message would reveal one.
  "Sign in as invisible" applies once per run, when the Buddy List first
  starts; after a reload the user's own choice wins, and a brand-new account
  starts Available.
  This needs the Supabase "Reset password" email template to contain
  `{{ .Token }}`; that is a dashboard setting and is recorded in
  `supabase/README.md`.
- **About Buzz** is a small dialog: version, copyright, "Buzz is not affiliated
  with Yahoo".

### Buddy List structure (Requirement 14)

Top to bottom: title bar (own Status_Icon), menu bar (Messenger, Contacts,
Actions, Help), header (Display_Name, an Availability dropdown, Status,
Now_Playing), toolbar (Add a Friend button, search box), then Groups. A group
header reads "Family (2/4)": online over total, with a collapse triangle.

New tables (migration `20250101000800`), all with RLS `owner_id = auth.uid()`:

| Table | Columns | Notes |
| --- | --- | --- |
| `contact_groups` | `id`, `owner_id`, `name` (1 to 40 chars), `position`, `created_at` | unique `(owner_id, lower(name))` |
| `contact_group_members` | `owner_id`, `friend_id`, `group_id` | unique `(owner_id, friend_id)`; no row means the default "Friends" group; deleting a group deletes its rows, which moves its friends back |
| `ignored_users` | `owner_id`, `ignored_id`, `created_at` | primary key `(owner_id, ignored_id)` |

Collapsed state and "Show Offline Contacts" are per-device preferences
(localStorage), not database rows.

### Ignore list (Requirement 15)

Enforced by Postgres where the database can enforce it: the `messages` insert
policy, the friend-request insert policy, and the inbox/chat Realtime
authorization policies each add "the receiver has not ignored the sender". An
ignored person gets a generic "couldn't send" and never a reason (15.7).
**Hiding presence cannot be enforced**: `presence:global` is a public channel
(docs/adr/0003), so the ignored person's app is simply told to show the user as
Offline, and a modified client could still see them. See `docs/adr/0009`.

### Incoming messages and alerts (Requirement 16)

- The Buddy List already receives every incoming `messages` INSERT
  (`useOfflineDelivery`). When one arrives for a friend with no open chat
  window, it calls `open_chat_window(friend_id, nudge: false, focus: false)`;
  Rust builds the window with `.focused(false)` and calls
  `request_user_attention` so the taskbar entry flashes. An open but unfocused
  chat window flashes itself on arrival; focus clears it.
- **Toast** is a small frameless always-on-top Tauri window (`toast`) placed at
  the bottom-right of the primary monitor's work area, closed after 5 s, styled
  like the other windows. It uses no plugin and no new dependency. Clicking it
  opens the chat.
- **Tray icon** uses Tauri's built-in tray (`tray-icon` and `image-png` features
  of the `tauri` crate; no new crate). Menu: Open Buzz, status items, Exit. The
  icon is one of four original PNGs generated by the same script as the other
  art, swapped when `myState` changes. Closing the Buddy List window is
  intercepted (`CloseRequested`) and hides it; Exit untracks presence first.
- **Sounds** are short original Web Audio cues (message, friend online, sign
  in), like the Buzz sound.

### Chat window menus, formatting, history (Requirement 17)

| Menu | Items |
| --- | --- |
| Conversation | Copy Conversation, Close |
| Edit | Copy, Select All, Clear Window |
| View | Show Timestamps, Show Earlier Messages (F3), Show Friends' Fonts |
| Actions | Buzz! (Ctrl+G), View Profile, Ignore |
| Help | About Buzz |

- **Formatting** is stored on the message as `messages.format jsonb`:
  `{ font, size, color, bold, italic, underline }`. A `CHECK` allows only the
  four fonts Tahoma, Verdana, Arial, and Times New Roman, sizes 10 to 24, and a
  `#rrggbb` color. The renderer builds inline style from these validated values
  only, never from raw text, and a pure `parseFormat()` returns the default
  format for anything invalid (Req 17.4).
- **Earlier messages** (F3) page backwards by `created_at` with `limit 50`; the
  conversation reducer already merges by id.
- **Offline line**: "<name> is offline. Your messages will be waiting when they
  sign in." appears while the friend's presence is Offline.
- **Save to file is not offered** (it needs a file-dialog plugin); Copy
  Conversation covers the need without a new dependency.

### Buzz! options (Requirement 18)

Beyond the Nudge flow above: preferences `buzz.allow`, `buzz.sound`,
`buzz.shake`; the receiver drops a second Buzz from the same friend inside 10 s,
so the sender-side cooldown cannot be bypassed by a modified client; a Buzz to
a minimized or hidden chat window raises it first (`unminimize`, `show`,
`set_focus`) and then shakes; Actions then Buzz! calls the same send path as the
button and Ctrl+G.

### Preferences (Requirement 19)

A Preferences window (its own Tauri window, `/preferences`) with five
categories. Settings live in `localStorage` under `buzz:prefs` as one JSON
object, read through a pure `parsePrefs(raw)` that falls back to the defaults
for anything missing or damaged (Req 19.7). Changes are broadcast to the other
windows through the `storage` event, as activity already is (docs/adr/0008).
The Ignore List category reads and writes `ignored_users`.

### Out-of-scope YM features (deliberately omitted)

Buzz copies the YM look and its **chat, presence, and Buzz!** experience. These
parts of the reference windows are NOT built, and are not shown as disabled
controls: sending or receiving files, photo sharing, voice and video calls, SMS,
phone-in and phone-out, mail and voicemail icons, Activities and games, plug-ins,
advertising and promotions, the web search box, group chat and chat rooms, and
tabbed chats. The IMVironment backdrop is optional and low priority.

## Data Models

All tables have Row Level Security enabled. Presence is not a table.

### `profiles`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid, PK | references `auth.users.id` |
| `display_name` | text, NOT NULL | max 50 chars; set from the email prefix on signup |
| `avatar_url` | text, nullable | public URL into the `avatars` Storage bucket |
| `status_message` | text, nullable | max 140 chars; null/empty clears it |
| `now_playing` | text, nullable | max 140 chars; null/empty clears it |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()` | updated on every profile change (drives the live feed) |

An `AFTER INSERT` trigger on `auth.users` creates the profile row on signup, setting
`display_name = left(split_part(email, '@', 1), 50)` (Requirement 1.3)
and a default avatar URL.

**RLS.** Any signed-in user can `SELECT` (so friends can render each
other). A user can `UPDATE` only their own row (`auth.uid() = id`).

### `friendships`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid, PK | |
| `requester_id` | uuid, references `profiles` | |
| `addressee_id` | uuid, references `profiles` | |
| `status` | text | `pending \| accepted \| declined \| removed` |
| `created_at` | timestamptz, default `now()` | |
| `updated_at` | timestamptz, default `now()` | |

`status` transitions: `pending -> accepted` (accept), `pending ->
declined` (decline), `accepted -> removed` (unfriend). A re-friend after
removal reuses the same row: `removed -> pending -> accepted`.

A unique index on the unordered pair enforces one row per pair:

```sql
create unique index friendships_pair_uniq
  on friendships (least(requester_id, addressee_id),
                  greatest(requester_id, addressee_id));
```

**Hide/restore chat history (Req 3.5, 3.6).** Message visibility is
gated by an *accepted* friendship, not by row existence. When a user
unfriends, the row moves to `removed`; RLS on `messages` returns no rows
for a `removed` pair, so the history is hidden. When the pair becomes
friends again the row returns to `accepted`; the same `messages` rows
become visible again, so history is restored without deleting or
duplicating anything.

**RLS.** A row is visible (`SELECT`) and updatable only to
`requester_id` and `addressee_id`.

### `messages`

| column | type | notes |
| --- | --- | --- |
| `id` | uuid, PK | |
| `sender_id` | uuid, references `profiles` | |
| `receiver_id` | uuid, references `profiles` | |
| `body` | text, NOT NULL | 1..1000 chars, non-empty, non-whitespace-only |
| `created_at` | timestamptz, default `now()` | chronological order key |
| `delivered_at` | timestamptz, nullable | set when delivered to the recipient (online now, or on return) |
| `read_at` | timestamptz, nullable | set when the recipient opens the message |

`delivered_at` distinguishes a live-delivered message (set on insert
when the friend is connected, or set on return) from a stored offline
message (`null`). `read_at` records the separate "opened" event
(Requirement 9.3).

A `CHECK` constraint enforces `body` length ≤ 1000; application code also
rejects empty/whitespace bodies before insert (Requirement 5.4).

**RLS.** A row is visible and writable only to `sender_id` and
`receiver_id`, and only when an `accepted` friendship exists between
them. This single policy delivers Requirements 3.5 (hide on unfriend)
and 3.6 (restore on re-friend) for free, because visibility follows the
friendship `status`.

### Storage: `avatars` bucket

Public bucket for Avatar images. Accepts png, jpeg, webp; objects are
limited to 2 MB. Upload paths are scoped per user
(`avatars/<user_id>/<uuid>.<ext>`) so RLS/storage policies can restrict
writes to the owner. Format and size are checked client-side before
upload (Requirement 2.4, 2.5) and enforced by the bucket policy.

### Retention: `pg_cron` job (Requirement 9.6)

A daily job deletes undelivered messages older than 30 days:

```sql
select cron.schedule(
  'purge_undelivered_messages', '0 3 * * *',
  $$ delete from messages
      where delivered_at is null
        and created_at < now() - interval '30 days'; $$
);
```

This runs server-side; no app code and no browser involvement.

### Presence (not a table)

Presence state lives in the `presence:global` Realtime channel. Each
client tracks `{ user_id, presence_state }`. The friend list reads
presence from this channel and merges it with profile rows from
Postgres. `offline` is the absence of a presence entry, produced by the
Realtime heartbeat timeout (within ~60s of a dropped connection,
Requirement 4.6) or by an explicit `untrack` on sign-out/app close
(Requirement 4.4).

### Notes on requirements the existing draft got wrong

The previous draft of this file contradicted the requirements in four
places. This design corrects them: `display_name` max is **50** (not 40)
per Req 1.3/2.1; `now_playing` max is **140** per Req 2.1/7.3;
the emoticon pack has **≥30** (not 24) per Req 8.1; `messages.body` max
is **1000** (not 2000) per Req 5.4.

### Requirement discrepancy (resolved)

Requirements 2.1 and 7.3 previously conflicted on the Now_Playing limit
(200 vs 140). This is resolved: Now_Playing caps at **140** characters,
matching both Requirement 2.1 (Now_Playing field limit, updated to 140)
and Requirement 7.3 (reject Status or Now_Playing lines longer than 140).
`isValidNowPlaying` validates against 140.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Buzz's pure-logic layer (validation, emoticon parsing, cooldown, presence and typing state machines, search filtering, message loading, and retention) is property-tested. Supabase Auth, Postgres, Realtime, and Storage are integration boundaries covered by example and integration tests. The properties below cover only the pure layer; criteria that are purely integration (e.g. real-time timing SLAs, session restore) are intentionally excluded from this section and listed in the Testing Strategy instead.

### Consolidation of overlapping criteria

Redundant or overlapping criteria were consolidated: `2.5` is subsumed by `2.4` (same avatar predicate); the per-field length limits (`2.1`, `7.3`) share one bounded-field property; the four presence transitions (`4.1`, `4.2`, `4.3`, `4.6`) form one state-machine property; the four nudge criteria (`6.2`–`6.5`) form one button-availability property; `7.2` and `7.4` form one status/now-playing display property; and `isOfflineMessage` (`5.5`, `9.1`) and `shouldRetain` (`9.5`, `9.6`) share one offline-message property.

### Property 1: Email format validation

*For any* string `s`, `isValidEmail(s)` is true if and only if `s` matches the `local-part@domain` form (one `@`, non-empty local part, non-empty domain), and false otherwise.

**Validates: Requirements 1.2, 1.8**

### Property 2: Password length validation

*For any* string `s`, `isValidPassword(s)` is true if and only if `8 <= s.length <= 128`.

**Validates: Requirements 1.2, 1.8**

### Property 3: Display name derivation from email

*For any* well-formed email `e`, `displayNameFromEmail(e)` equals the substring before the first `@`, truncated to at most 50 characters, and is non-empty.

**Validates: Requirements 1.3**

### Property 4: Profile field length limits

*For any* string `s` and each profile field, the validator accepts exactly the bounded set: `isValidStatus(s)` iff `s.length <= 140`; `isValidNowPlaying(s)` iff `s.length <= 140`; `display_name` iff `s.length <= 50`.

**Validates: Requirements 2.1, 7.3**

### Property 5: Display name is required and non-whitespace

*For any* string `s`, `isValidDisplayName(s)` is false whenever `s` is empty or trims to empty (whitespace-only), and when the save is rejected the stored `display_name` is unchanged.

**Validates: Requirements 2.2**

### Property 6: Avatar upload validation

*For any* avatar candidate `f = { size, type }`, `checkAvatar(f).ok` is true if and only if `size <= 2_097_152` bytes and `type` is one of `image/png`, `image/jpeg`, `image/webp`; otherwise the previous avatar is retained and a reason is returned.

**Validates: Requirements 2.4, 2.5**

### Property 7: Friend search filtering

*For any* user list `U`, query `q`, and searcher id `self`, every result of `searchUsers(U, q, self)` contains `q` case-insensitively in its `email` or `display_name`, never includes the searcher, and the result count is at most 50.

**Validates: Requirements 3.1**

### Property 8: Friend request gating

*For any* relationship state `rel`, `selfId`, and `recipientId`, `canSendRequest(rel, selfId, recipientId).ok` is false exactly when `recipientId == selfId`, or `rel.status == 'accepted'`, or `rel.status == 'pending'`; and in those cases no pending request is created.

**Validates: Requirements 3.7**

### Property 9: Presence state machine

*For any* current presence state and event, `nextPresenceState` follows the spec: a `setOnline` event (the user picks Available) yields `online`; an `activity` event yields `online` from any state except `busy`, which stays `busy` (Req 4.3); an `idleTimeout` event where `now - lastActivityAt >= 5 min` yields `away` from `online` or `away`; a `setBusy` event yields `busy` and `busy` persists until an explicit `setOnline` or a `disconnect`; a `disconnect` or `heartbeatMissed` event yields `offline`.

**Validates: Requirements 4.1, 4.2, 4.3, 4.6**

### Property 10: Most-recent message loading

*For any* list of messages `M` for a pair, `loadRecentMessages(M, 50)` returns exactly the 50 messages with the greatest `created_at`, ordered oldest-first; if `|M| <= 50` it returns all of them.

**Validates: Requirements 5.1**

### Property 11: Message body validation

*For any* string `s`, `isValidMessageBody(s)` is true if and only if `s` is non-empty, not whitespace-only, and `s.length <= 1000`; rejected bodies are not stored.

**Validates: Requirements 5.4**

### Property 12: Offline-message classification and retention cutoff

*For any* message `m` and time `now`, `isOfflineMessage(m)` is true iff `m.delivered_at` is null, and `shouldRetain(m, now)` is true iff `m.delivered_at` is null and `m.created_at > now - 30 days`. A message that fails delivery on return (still `delivered_at` null) remains retained until the 30-day cutoff.

**Validates: Requirements 5.5, 9.1, 9.5, 9.6**

### Property 13: Offline-message delivery order

*For any* set of stored messages for a returning user, the delivered sequence equals the ascending `created_at` order.

**Validates: Requirements 9.2**

### Property 14: Nudge availability and cooldown

*For any* nudge cooldown state `s`, friend presence `p`, and time `now`: the Nudge button is enabled iff `p != 'offline'` and `isInCooldown(s, now)` is false; `isInCooldown(s, now)` is true iff `s.lastNudgeAt != null` and `now - s.lastNudgeAt < 10_000`; and `onNudgeResult(s, now, delivered)` sets `lastNudgeAt = now` only when `delivered` is true (a failed delivery leaves `lastNudgeAt` unchanged and the button enabled). The sender system line is exactly `"You nudged " + display_name`.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 15: Typing indicator state machine

*For any* typing state `s` and time `now`, `shouldShowTyping(s, now)` is true iff `s.lastKeystrokeAt != null` and `now - s.lastKeystrokeAt < 3000` and `s.sent` is false; `onKeystroke` sets `lastKeystrokeAt = now` and `sent = false`; `onSend` sets `sent = true` (clearing the indicator) until the next keystroke.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 16: Emoticon pack validity

*For the* fixed emoticon pack, `SHORTCODE_MAP` has at least 30 entries, every shortcode is unique, and every mapped image path is unique.

**Validates: Requirements 8.1**

### Property 17: Emoticon insertion at cursor

*For any* text `t`, cursor position `0 <= pos <= t.length`, and shortcode `c`, `insertAtCursor(t, pos, c)` yields `{ text: t.slice(0,pos) + c + t.slice(pos), pos: pos + c.length }`; surrounding text is preserved.

**Validates: Requirements 8.2**

### Property 18: Emoticon shortcode rendering and fallback

*For any* message body `b`, `renderMessage(b)` produces a token sequence where every recognized shortcode becomes an `emoticon` token and every other substring (including unrecognized shortcode-shaped strings) becomes a `text` token; concatenating all token values reconstructs `b` (no characters lost or added).

**Validates: Requirements 8.3, 8.5**

### Property 19: Skin contrast ratio

*For every* text/background color pair defined by the Skin, the WCAG contrast ratio is at least 4.5:1.

**Validates: Requirements 8.4**

### Property 20: Status and Now_Playing display

*For any* `now_playing` value, the rendered friend-list row contains the music-note glyph iff `now_playing` is non-empty; and for any empty or whitespace-only `status_message` or `now_playing`, the field is cleared (not shown) rather than rendered.

**Validates: Requirements 7.2, 7.4**

## Error Handling

Errors are split into **input-validation errors** (pure, shown inline) and **service errors** (Supabase/Realtime, surfaced with a friendly message and a recoverable state).

### Input-validation errors (no side effects)

| Criterion | Trigger | Response | Requirement |
| --- | --- | --- | --- |
| Sign-up invalid email | email not `local-part@domain` | Inline error under email field; no account created | 1.8 |
| Sign-up invalid password | length outside 8..128 | Inline error under password field | 1.8 |
| Sign-up duplicate email | email already used | Inline error "email already in use" | 1.8 |
| Sign-in invalid credentials | no matching account | Inline error "invalid credentials" | 1.9 |
| Display name empty/whitespace | trims to empty | Retain previous name; error "Display_Name is required" | 2.2 |
| Avatar too large / wrong type | >2 MB or not png/jpeg/webp | Retain previous avatar; error naming the constraint | 2.5 |
| Status/Now_Playing too long | exceeds field limit | Retain existing value; error naming the limit | 7.3 |
| Message body invalid | empty/whitespace/>1000 chars | Error to sender; message not stored | 5.4 |

A core rule for all of these: a rejected input never mutates stored state. The previous value is retained (Requirement 2.2, 2.5, 7.3) or nothing is written (Requirement 5.4).

### Service errors (recoverable)

| Criterion | Trigger | Response | Requirement |
| --- | --- | --- | --- |
| Friend offline at nudge | friend presence is `offline` | Nudge button disabled with "friend is offline" message | 6.4 |
| Nudge delivery failure | broadcast did not reach the friend | "nudge was not delivered" message; button stays enabled; no cooldown started | 6.5 |
| Offline message storage failure | Postgres insert error | "message was not sent" error to sender | 9.4 |
| Offline message delivery failure | recipient came online but the deliver/update failed | Row retained (`delivered_at` null) for the next attempt | 9.5 |
| Presence connection loss | Realtime heartbeat missed | Reconnect attempted; reported `offline` within ~60s if not restored | 4.6 |

### Realtime disconnection strategy

The Realtime client heartbeat runs at 25s (the documented Supabase default). On an unexpected `CLOSED` or `TIMED_OUT` the client reconnects rather than treating it as fatal, and re-establishes the `presence`, `chat`, and `profiles` subscriptions. If reconnection fails within ~60s the user is reported `offline` to friends (Requirement 4.6). The chat subscription is reattached so missed message inserts are recovered from Postgres (messages are the source of truth, not the broadcast).

### End-to-end-encryption disclaimer

Buzz does not implement end-to-end encryption and must never claim to. No UI string, marketing copy, or comment may assert it. This is a product rule (`product.md`) enforced by review.

## Testing Strategy

### Dual approach

- **Property-based tests** verify the universal properties of the pure-logic layer (`lib/` modules) across many generated inputs.
- **Unit tests** verify specific examples, edge cases, and integration points between pure logic and the Supabase clients.
- **Integration tests** verify the Supabase/Realtime boundaries with two real test users (as required by `tech.md`) running in two desktop app instances, and the timing SLAs.

### Property-based tests

- **Library:** `fast-check` for the pure-logic layer (no I/O).
- **Configuration:** minimum 100 iterations per property test.
- **Tagging:** each test carries a comment referencing the design property, e.g. `// Feature: buzz, Property 11: Message body validation`.
- **Mapping:** one property test per Correctness Property above (Properties 1–20), each validating its listed requirements.

Generators should cover the edge cases surfaced in the prework: empty/whitespace-only and exactly-at-limit strings for the validators; shortcode-shaped-but-unrecognized strings for the emoticon parser; cursor positions at 0 and at the end for insertion; idle times just under/over 5 minutes and just under/over 3 seconds for the presence and typing machines; timestamps just under/over 10s for nudge cooldown; and `created_at` boundaries at 30 days for retention.

### Unit tests

- Shortcode rendering for the known pack (specific `:)`, `:(`, unrecognized `:foo:`, text with no shortcodes).
- Nudge cooldown countdown rendering and the not-delivered message path.
- Presence state transitions for a few representative event sequences.
- `displayNameFromEmail` for a normal email, an email with a long local part (truncation to 50), and a malformed email.
- Char counters in `ProfileEditor` and `MessageInput` at the limit boundary.

### Integration tests (two test users, as required by tech.md)

- **RLS:** with two test users, verify a user cannot read another user's `profiles` updates they shouldn't, cannot read a stranger's `messages`, and cannot read `friendships` they are not party to. Confirm RLS blocks cross-user reads.
- **Auth:** sign up, sign in, reload-restores-session, sign out, and the duplicate-email / invalid-credentials rejection paths (Requirements 1.2–1.9).
- **Friends:** search, send/accept/decline, unfriend hides history, re-friend restores it (Requirements 3.1–3.6).
- **Presence:** open the app (online), idle 5 min (away), set busy, close the app (offline within 30s), and dropped connection (offline within ~60s) — verified between two running app instances (Requirements 4.1-4.6).
- **Chat:** open chat shows the most recent 50; a sent message reaches a connected friend in under 2s; reload preserves history; an offline friend's message is delivered on return in chronological order and marked read on open (Requirements 5, 9).
- **Nudge:** shake + sound on the receiver; 10s cooldown; disabled for an offline friend; not-delivered message on a forced failure (Requirement 6).
- **Profile live update:** a profile change appears in the friend's list within ~5s without reload (Requirement 2.3); status and now-playing render, empty clears them (Requirement 7).
- **Emoticons and Skin:** picker shows ≥30; insertion at cursor; recognized shortcodes render; unrecognized stay text; contrast ≥4.5:1 on the rendered tokens (Requirement 8).
- **Typing:** indicator appears, clears after 3s idle, clears on send (Requirement 10).
- **Retention:** verify the `pg_cron` `DELETE` removes an undelivered message whose `created_at` is older than 30 days and leaves newer ones (Requirement 9.6).

### Why some criteria are not property-tested

Per the PBT applicability assessment, the following are integration or smoke tests, not properties: session restore on reload (1.4), sign-out (1.5), the sign-in-page render (1.1, 1.6), all friendship DB mutations (3.2–3.6), the real-time timing SLAs (2.3, 4.1–4.5, 5.2), Postgres persistence (5.3), the nudge shake/sound animation (6.1), and the `pg_cron` delete execution (9.6 delivery). These are covered by the integration and smoke tests above.
