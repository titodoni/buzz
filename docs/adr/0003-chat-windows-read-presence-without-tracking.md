# Chat windows read presence without tracking it

The Buddy List window is the only window that calls `track()`, on its own private topic `presence:<userId>`, so each signed-in user has one presence entry no matter how many chat windows are open. Chat windows still need the friend's presence (to enable the Nudge button and stamp `delivered_at`), so they **subscribe read-only to that friend's topic and never track**. Subscribing without tracking adds no presence entry. We chose this over relaying presence from the Buddy List to each chat window through Tauri events, because it needs no cross-window plumbing and also works when the app runs in a plain browser during development.

## Consequences

- Each person's presence lives on their own private topic. Realtime Authorization (migration `20261124124401`) lets only the owner track there and only accepted friends who are not ignored listen. A stranger cannot see who is online, and nobody can fake a friend's state: every entry on `presence:<id>` belongs to `<id>`, whatever presence key it uses.
- The Buddy List opens one read-only channel per friend. That is fine at Buzz's size (Supabase's default allows 100 channels per client); a very large friend list would need a different design.
- Until every tester runs a build with private presence, "Allow public access" stays on in the Realtime settings for the old `presence:global` channel. Turn it off afterwards (supabase/README.md).
- This replaced a public `presence:global` channel (24 Nov 2026 audit, finding S1), where anyone with the publishable key could list online user ids and a signed-in user could track under someone else's id.
