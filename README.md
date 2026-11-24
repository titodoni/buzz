# Buzz

A Yahoo Messenger revival for Kiroween 2026 (category: Resurrection).
Buzz is a native desktop chat app for Windows, Linux, and macOS built
around people being present: a Buddy List of friends with live
presence, one chat window per friend, classic emoticons, and the Nudge
("Buzz!") that shakes your friend's window.

Buzz does not claim encryption yet. Encrypted Messages are built (new
messages are encrypted on the sender's device, [ADR 0010](docs/adr/0010-messages-are-encrypted-with-a-static-key-per-user.md))
and the hosted database now refuses plaintext messages. The two-user check
passed on a local stack, but it has not been repeated on the hosted project
with the released installers, so Buzz still makes no encryption claim. Until
it is, treat messages as readable by anyone with access to the project's
database.

## Status

| Area | State |
| --- | --- |
| Sign in / sign up, profile, avatar | Built |
| Buddy List, friend search, friend requests | Built |
| Presence (Available, Away, Busy, Offline), custom status | Built |
| Chat windows, emoticons, typing indicator, read receipts | Built |
| Nudge ("Buzz!"): sound, window shake, cooldown | Built |
| Offline messages and unread badges | Built |
| Live profile updates in the Buddy List and chat header | Built |
| Supabase schema, RLS, Realtime policies | Applied and checked |
| Availability: Available, Busy, Invisible, presets, custom status; one icon everywhere | Built; checked with two signed-in users |
| Buddy List groups, search box, Add a Friend, Show Offline Contacts | Built; checked with three users |
| Ignore list: blocks messages, Buzz!, and friend requests; ignored person sees you Offline | Built; checked with two users |
| Sign-in options, forgot password by emailed code, About Buzz | Built; recovery email needs the template change in [supabase/README.md](supabase/README.md) and a real inbox to test |
| Chat menus (Conversation, Edit, View, Actions, Help), fonts and colors, F3 earlier messages, Clear Window | Built; checked with two users in the Linux desktop app |
| Incoming-message alerts, "is now online" toast, tray icon, sounds | Built; checked in the Linux desktop app except the tray itself (see design.md, Requirement 16) |
| Responsive windows (220x400 up to maximized) | Built; see [docs/responsive-checks.md](docs/responsive-checks.md) |
| "B!" logo with sparks background, four themes, in the title bar, sign-in, About, and app icon | Built; the theme is set in code only |
| Installer config (task 17.1) and two-user integration tests | Not yet |
| Nudge extended: row shake and red count, Recent Buzzes with Nudge back, 5 Buzzes per 10 minutes | Built and unit-tested; not yet checked between two running apps. The log and the limit live on the sender's computer only |
| Share What I'm Playing (automatic Now Playing, off by default) | Linux: checked with Spotify and a test player. Windows (system media controls) and macOS (Spotify and Apple Music only) readers are written and compile, but have not been run on those systems |
| Hangouts: templates and a custom line, banner, accept, decline, 15 minute expiry (ADR 0011) | Built; migration applied and its database rules checked (25 checks). Not yet checked between two running apps |
| Encrypted Messages: keys, encrypt and decrypt, Safety Number, key-changed warning | Built; unit-tested and the database rules are checked. Not yet checked between two running apps. Keychain checked on Linux only; Windows and macOS not verified |

The migrations in [supabase/README.md](supabase/README.md) are applied to a
real Supabase project, and `npm run test:rls` (three-user checks: signup
trigger, friends vs strangers, message and receipt rules, search, unfriend,
re-request, groups, ignore, message format) passes against it. Presence, chat
delivery, Nudge, and the alerts have been checked with two and three signed-in
users, including in the Linux desktop app.

Known gap: `presence:global` is a public channel. Anyone who holds the
app's publishable key can see which user ids are online and in which state
(Available, Away, Busy). They see no names, avatars, or messages, because
profiles are readable only by the person themselves and their friends. A
malicious signed-in user could also fake someone else's presence
([ADR 0003](docs/adr/0003-chat-windows-read-presence-without-tracking.md)).

## Stack

- **Client:** Next.js App Router + TypeScript (strict), built as a
  static export, styled with Tailwind CSS.
- **Desktop shell:** Tauri v2 (Rust). The Buddy List is the main
  window; each chat opens its own OS window.
- **Backend:** Supabase only (Auth, Postgres, Realtime, Storage). All
  data access goes through Row Level Security.

Why it's built this way: see [`docs/adr/`](docs/adr/).

## Prerequisites

- Node.js 20 or newer (developed on Node 24)
- Rust stable with `rustfmt` and `clippy` ([rustup](https://rustup.rs))
- Tauri's system packages for your OS. On Debian/Ubuntu:

  ```sh
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential pkg-config \
    libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev
  ```

  For Windows and macOS see the
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
- A Supabase project and the [Supabase CLI](https://supabase.com/docs/guides/cli)
- On Linux, a compositing window manager (the default on GNOME, KDE, and
  most desktops): Buzz's windows are transparent so their corners are round.

## Set up Supabase

1. Create a Supabase project.
2. Link it and apply the migrations (do not paste SQL into the
   dashboard; schema changes live in `supabase/migrations/`):

   ```sh
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. Enable the `pg_cron` extension if `db push` reports it missing
   (it purges undelivered messages older than 30 days).
4. Verify RLS with the two-user checks. They run in one transaction and
   roll back, so they leave no data behind. Use the database connection
   string from Project Settings → Database; never commit it:

   ```sh
   SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
     npm run test:rls
   ```

5. Regenerate the types after any schema change:

   ```sh
   supabase gen types typescript --db-url "$SUPABASE_DB_URL" --schema public \
     > lib/supabase/database.types.ts
   ```

More detail: [`supabase/README.md`](supabase/README.md).

## Configure the app

Copy `.env.example` to `.env` and fill in the two public values from
the Supabase dashboard (Project Settings → API):

```sh
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Only the publishable key goes in the app. Never put the service-role
key in `.env` or the build. `.env` is git-ignored.

## Run

```sh
npm install
npm run tauri dev    # desktop app (starts Next on :3000 and the Tauri shell)
npm run dev          # browser only, for quick UI work; chats open as popups
```

To try chat, presence, and the Nudge, run two app instances signed in
as two different test users who are friends.

## Test and check

```sh
npm test             # Vitest + fast-check property tests
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # static export to out/

cd src-tauri
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Pure logic (validation, emoticons, presence, cooldown, typing, the
conversation model, offline delivery) is tested at its public
functions. Supabase calls, React components, the window shake, and the
sound are verified by running the app.

## Build installers

```sh
npm run tauri build
```

Tauri writes `.msi`/`.exe` (Windows), `.deb`/`.rpm`/`.AppImage` (Linux), or
`.dmg`/`.app` (macOS) to `src-tauri/target/release/bundle/`. Each OS's
installers must be built on that OS. The build bakes in
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from
`.env`.

Linux packages built locally need the glibc of the machine that built them
(a build on Ubuntu 26.04 needs glibc 2.39, so Ubuntu 24.04 or newer). For
older distributions, build on an older system, as the CI does.

**Windows installer from Linux** (NSIS `.exe` only; `.msi` needs Windows).
The Tauri docs call this experimental, a fallback to building on Windows:

```sh
sudo apt install nsis lld llvm
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
XWIN_CACHE_DIR=$HOME/.cache/cargo-xwin \
  npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc
```

The installer lands in
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

**Beta builds for all three systems:** `.github/workflows/beta-build.yml`
runs the checks, then builds on Windows, macOS (Apple Silicon and Intel), and
Ubuntu 22.04, and attaches the installers to a draft release. Start it from
the Actions tab or by pushing a tag. A tag with a hyphen (`v0.1.0-beta.1`)
makes a pre-release; a plain tag (`v0.1.0`) makes the normal release that the
landing page at https://buzz.asmorodonitito.my.id links to
([ADR 0012](docs/adr/0012-website-is-a-landing-page-jury-tests-the-desktop-app.md)).
The tag must match the version in `src-tauri/tauri.conf.json`. It needs the
two `NEXT_PUBLIC_SUPABASE_*` values as repository secrets. The builds are not
code signed; testers follow [docs/beta-install.md](docs/beta-install.md).

Logo and app icon: the "B!" logo (original art, ADR 0006) is drawn once in
`lib/brand/logo.ts`. `components/BuzzLogo.tsx` shows it in every title bar, and
`components/BuzzHero.tsx` shows the full-width burst banner on the sign-in,
sign-up, and About windows. There are four themes: `classic` (the default),
`sakura`, `ember`, and `midnight`; pass `theme="sakura"` to either component.
There is no theme setting for users yet.

`node scripts/gen-app-icon.mjs [theme] [--sheet]` renders
`src-tauri/icons/app-icon.png` (`--sheet` also writes a preview of every theme
to `/tmp`), and `npx tauri icon src-tauri/icons/app-icon.png` makes every size.
It needs no extra tools beyond `sharp`, which Next.js already installs.

## Project layout

```
app/              routes: / (Buddy List), /login, /signup, /forgot, /profile,
                  /chat?friendId=<id>, /toast
components/       window chrome, Buddy List, friends, profile, chat, auth
lib/              pure logic (validation, emoticons, presence, nudge, typing,
                  chat, offline, alerts, skin) plus Supabase and Tauri adapters
public/emoticons/ original emoticon art (generated by scripts/gen-emoticons.mjs)
public/avatars/   default picture for new accounts (scripts/gen-default-avatar.py)
src-tauri/        Rust shell: windows, chat-window and toast commands, tray, capabilities
supabase/         migrations, RLS checks
.kiro/            Kiro spec (requirements, design, tasks) and steering rules
docs/adr/         architecture decisions
GLOSSARY.md       domain terms used across code and specs
```

## Docs

- What the app must do: [`.kiro/specs/buzz/requirements.md`](.kiro/specs/buzz/requirements.md)
- How it's designed (architecture, data model, UI/UX): [`.kiro/specs/buzz/design.md`](.kiro/specs/buzz/design.md)
- Build plan and progress: [`.kiro/specs/buzz/tasks.md`](.kiro/specs/buzz/tasks.md)
- Product and technical rules: [`.kiro/steering/`](.kiro/steering/)
- Decisions: [`docs/adr/`](docs/adr/) · Terms: [`GLOSSARY.md`](GLOSSARY.md)

The `.kiro/` folder must stay in version control (the Kiroween
submission requires it).

## Scope

In: email sign-in, profiles, friends, live presence, custom status and
now playing, 1:1 real-time chat, Nudge, classic emoticons and YM-era
skin, offline messages, typing indicator.

Out: sending or receiving files and photos, voice/video calls, SMS,
phone calls, games and plug-ins, advertising, group chat and chat rooms,
tabbed chats, a mobile app, and any encryption claim until it is verified (ADR 0010). Buzz is
chat and Buzz! only.

All art and sound are original; Buzz is not affiliated with Yahoo.

## License

MIT, see [LICENSE](LICENSE). The art and sounds are original and covered by the
same license (ADR 0006).

