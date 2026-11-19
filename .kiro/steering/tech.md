---
inclusion: always
---

# Tech steering — Buzz

## Stack (locked)

Next.js App Router + TypeScript (strict) built as a **static client
export**, wrapped by **Tauri** into a native desktop app for Windows,
Linux, and macOS. Supabase (Auth, Postgres, Realtime, Storage) is the
only backend, cloud-hosted. No Vercel, no custom Node server, no second
database. A Rust toolchain is required to build the Tauri shell.

## Architecture

Follow the layout in `design.md`:

- `app/` — App Router routes: `/login`, `/signup`, `/` (Buddy List
  window), `/profile`. Static export means **Client Components by
  default**; there is no server runtime, no Server Components, and no
  Next.js middleware. Supabase Auth manages the session client-side.
- `src-tauri/` — the Tauri Rust shell: native OS windows, the webview
  that loads the static export, window management (the Buddy List is
  the main window; each chat opens its own window), and the build config
  for Windows/Linux/macOS installers.
- `components/` — `BuddyList`, `FriendList`, `ChatWindow`,
  `MessageList`, `MessageInput`, `EmoticonPicker`, `PresenceDot`,
  `NudgeButton`.
- `lib/supabase/` — one typed **browser client** (publishable key) used
  by every window. The service key is never used in the app; it exists
  only for Supabase SQL/migrations. All data access is through RLS.
- `lib/realtime/` — presence channel (owned by the Buddy List window)
  and per-chat message subscription helpers.
- `lib/nudge/` — shake animation, Web Audio sound, cooldown timer.

## Code style

- TypeScript strict. No `any` without a comment explaining why.
- Rust in `src-tauri/` follows `cargo fmt` and `cargo clippy`.
- Never invent or assume a dependency. If a package is needed, name it
  and say why before adding it.
- All Supabase access goes through the typed client in `lib/supabase/`.
  No raw `fetch` to Supabase URLs from components.

## Supabase rules

- Row Level Security is on for every table (`profiles`, `friendships`,
  `messages`), verified with two test users. There is no `nudges` table;
  nudge is an ephemeral Realtime broadcast.
- The service key never ships in the app. Only the publishable key and
  project URL go in the build (public); `.env` stays out of version
  control.
- Schema changes go in a SQL migration file, not the dashboard editor.
- Presence lives in the Realtime channel, never as a Postgres column.

## Realtime rules

- Realtime powers chat delivery, presence, and the typing indicator.
  No polling loops.
- One Postgres changes subscription per open chat window, filtered to
  messages where the signed-in user is sender or receiver.
- One presence channel tracks the signed-in user's state — online,
  away, busy, offline — set client-side by the Buddy List window. Chat
  windows never track presence (avoids duplicate presence entries); they
  may subscribe read-only to see a friend's state (docs/adr/0003).
- The typing indicator is a broadcast event, never a database write.
- Nudges are broadcasts on the pair's chat channel and the friend's
  `inbox:<userId>` channel (docs/adr/0007); never stored.

## Workflow

- Work one small task at a time, in the order in `tasks.md`. Do not
  skip ahead to chat before auth and presence work.
- After each task, run typecheck (`tsc --noEmit`) and lint, and fix
  errors before moving on.
- Unit-test shortcode rendering, nudge cooldown, and presence state
  transitions.
- After each feature, verify it between two test users in **two running
  desktop app instances** (or two app windows).
- Keep the `/.kiro` directory in version control. Never add it to
  `.gitignore`.
