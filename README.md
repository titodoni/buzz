# Buzz — Kiro spec pack

Kiroween 2026, category Resurrection. Buzz is a Yahoo Messenger revival:
a web chat app built around people being present, not infinite scroll.

## What is in this pack

- `.kiro/specs/buzz/requirements.md` — what the app must do, in WHEN/THEN form
- `.kiro/specs/buzz/design.md` — architecture, data model, screens, security
- `.kiro/specs/buzz/tasks.md` — build order, one small task at a time
- `.kiro/steering/product.md` — product rules Kiro must follow
- `.kiro/steering/tech.md` — technical rules Kiro must follow

## How to use it

1. Create the repo (suggested name: `buzz`, public, MIT license).
2. Copy the whole `.kiro` folder from this pack into the repo root.
   It must stay in version control. Never add it to `.gitignore`,
   Devpost disqualifies submissions without it.
3. Open the repo folder in the Kiro desktop IDE.
4. Run the spec workflow for `buzz` (requirements, then design,
   then tasks), or just start with task 1 and work down the list.
5. After each task, run typecheck and the tests before moving on.

## Stack (locked)

Next.js App Router + TypeScript, Supabase (Auth, Postgres, Realtime),
Tailwind CSS, deployed on Vercel. No other backend, no other database.

## Scope (locked)

In: email sign-in, profiles, friend list, live presence, custom status
and now playing, 1:1 real-time chat, Nudge, classic emoticons and YM-era
skin, offline messages, typing indicator.

Out: voice/video calls, group chat, file sharing beyond small images,
mobile app, end-to-end encryption claims.
