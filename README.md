# Buzz!

**Remember when chat was about being present?**

Buzz is a desktop chat app that brings back the feel of the old messenger
days. Your friend list is the home screen. You see who is online before you
see anything else, every friend gets their own chat window, and one tap on
**BUZZ!** shakes their screen.

It runs natively on **Windows, macOS and Linux**.

**[Try the demo on the website](https://buzz.asmorodonitito.my.id)** · [Download](https://github.com/titodoni/buzz/releases) · [Install help](docs/beta-install.md)

## What you get

- **A Buddy List that shows who is around.** Available, Busy, Away or Offline,
  with a status message and, if you turn it on, the song you are playing.
- **One window per friend.** Open as many chats as you like and put them
  wherever you want on your screen.
- **The Nudge.** Press **BUZZ!** and your friend's chat window shakes and
  makes a sound. There is a short cooldown so it stays friendly.
- **Classic emoticons.** 58 original shortcodes such as `:)`, `;)`, `B-)` and
  `=))` turn into little faces as you type.
- **Hangouts.** Send "Play a game?" or "Study together?". If nobody answers, it
  expires after 15 minutes.
- **Typing indicator, offline messages and read receipts.**
- **Friends only.** You can only talk to people you both accepted. There are
  no public profiles and no strangers in your inbox. Put someone on your
  Ignore List and they see you as offline.

## What Buzz will not do

No feed. No infinite scroll. No recommendations. No ads. Buzz is chat and
Buzz!, nothing else. File sharing, voice and video calls, group chat and a
mobile app are out of scope on purpose.

## Install

1. Open the [Releases page](https://github.com/titodoni/buzz/releases) and
   download the file for your system:

   | System | File | Status |
   | --- | --- | --- |
   | Windows 10 / 11 | `Buzz_<version>_x64-setup.exe` | Beta, untested |
   | macOS, Apple Silicon | `Buzz_<version>_aarch64.dmg` | Beta, untested |
   | macOS, Intel | `Buzz_<version>_x64.dmg` | Beta, untested |
   | Linux (Debian, Ubuntu) | `Buzz_<version>_amd64.deb` | Tested |
   | Linux (any) | `Buzz_<version>_amd64.AppImage` | Tested |

   "Beta, untested" means our CI builds it, but nobody has run it on a real
   Windows PC or Mac yet. Please report how it goes.

2. Run it. The beta builds are **not code signed yet**, so Windows and macOS
   will warn you the first time. Step-by-step help for each system is in
   [docs/beta-install.md](docs/beta-install.md).
3. Create an account, add a friend by email, and say hi.

On Linux, Buzz needs a desktop with window compositing (the default on GNOME,
KDE and most others) because its windows have rounded corners.

## Privacy

Only friends see each other. Buzz does not publish profiles and has no way to
find strangers. A friend request goes directly to the person you typed.

**Buzz does not claim that messages are encrypted yet.** Messages are
encrypted on the sender's device in the current build, and the database
refuses plaintext. That has been checked on a test setup, not yet on the live
service with the release installers. Until it is, assume messages can be read
by whoever runs the service's database. Presence and status are not hidden
from the service either.

## Project state

Buzz is a **beta (v0.1.3)** made for Kiroween 2026, in the Resurrection
category. It was developed and checked mainly on Linux. The Windows and macOS
builds compile and are produced by CI, but nobody has run them on those
systems yet, including Now Playing on those systems. Expect rough edges and
please report them in the [issues](https://github.com/titodoni/buzz/issues).

## Build it yourself

Buzz is a Next.js static export inside a Tauri v2 (Rust) shell, with Supabase
as the only backend. Setup, running, tests, installers, and the full build
status are in **[docs/development.md](docs/development.md)**.

Design records and rules: [`docs/adr/`](docs/adr/) ·
[`.kiro/`](.kiro/) (specs and steering, kept in version control for the
Kiroween submission) · [`GLOSSARY.md`](GLOSSARY.md).

## License

MIT, see [LICENSE](LICENSE). All art, emoticons and sounds are original and
covered by the same license. Buzz is an independent community project and is
not affiliated with Yahoo.
