# Tech steering — Buzz

## Stack (locked)

Next.js App Router + TypeScript (strict), Supabase (Auth, Postgres,
Realtime, Storage), Tailwind CSS, Vercel. No other backend or database.

## Rules

- TypeScript strict, no `any` without a comment explaining why.
- Never invent a dependency. If a package is needed, name it and say
  why before adding it.
- Supabase only through the typed clients in `lib/supabase/`. No raw
  fetch to Supabase URLs from components.
- Row Level Security on for every table, verified with two test users.
  The service key never leaves the server and never goes in the browser.
- Realtime for chat, presence, and typing. No polling loops.
- Presence lives in the Realtime channel, never as a Postgres column.
- One small task at a time, in the order in tasks.md. Run typecheck
  after each task and fix errors before moving on.
- Keep the `/.kiro` directory in version control. Never add it to
  `.gitignore`.
