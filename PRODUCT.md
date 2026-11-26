# Product

<!-- impeccable:product-schema 1 -->

<!-- Written 24 Nov 2026 from .kiro/steering/product.md, tech.md, the README and
the ADRs, without an interview. Every fact below comes from those files; check
it and correct anything that is off. -->

## Platform

web (the landing page). The product itself is a native desktop app built with Tauri; this record covers the website.

## Users

- **Kiroween 2026 jury:** open the landing page from Devpost, decide in a minute whether Buzz is worth installing, then test the desktop app.
- **Friends of the maker and early testers:** people who remember Yahoo Messenger and want a small, friends-only chat that feels like it did.

## Product Purpose

Buzz is a Yahoo Messenger revival as a native desktop app for Windows, Linux and macOS. The website is a single landing page whose job is to get a visitor to download and install the beta (docs/adr/0012). Success is a visitor who understands what Buzz is within the first screen and leaves with the right installer.

## Positioning

Chat built around people being present. The Buddy List is the home screen, every friend gets their own window, and the Nudge ("Buzz!") shakes their window with a sound. No feed, no algorithm, no infinite scroll, no recommendations.

## Operating Context

The page is static HTML on Hostinger at https://trybuzz.me/ (and alias https://buzz.asmorodonitito.my.id/), deployed from `website/`. Downloads come from GitHub Releases (tag `v0.1.4`). The installers are not code signed; `docs/beta-install.md` explains the first-launch warnings.

## Capabilities and Constraints

- Built and checked on Linux. The Windows and macOS builds come from CI and have **not been run on a real machine**; the page must say so.
- Encryption claims are forbidden until the two-user check passes (docs/adr/0010). Never say Buzz hides who talks to whom, Presence, Status or Now Playing, or that a stranger or the server cannot see them.
- People can find others by display name (3+ letters) or exact email and send a friend request. Only accepted friends can chat.
- Now Playing is shown on the profile and is off by default.

## Brand Commitments

- Name: **Buzz!** with the tilted `B!` + golden smiley logo (original art, docs/adr/0006; drawn in `lib/brand/logo.ts`).
- YM-era tone: warm, a little playful, never corporate. Plain words, one tap one action.
- All art and sounds are original. Buzz is not affiliated with Yahoo; never use Yahoo's logo or art.
- The landing page's visual world is pinned by the owner: a 2000s website, in the spirit of the original Yahoo! Messenger download page.

## Evidence on Hand

- Real unretouched desktop screenshots captured from the desktop build (`website/assets/screens/{login,buddylist,chat,about}.png`), the app's skin, 58 SVG emoticons (`public/emoticons/`), and original logo artwork.
- No testimonials, user counts, benchmarks or press. Do not invent any. No measured memory or speed figures.

## Product Principles

1. Presence first: who is online matters more than what was said.
2. Every claim on the page must be true today.
3. Nostalgia with modern engineering, not a museum piece.
4. Friends only; no feeds, no algorithms, ever.
