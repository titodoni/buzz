# Chat windows read presence without tracking it

The Buddy List window is the only window that calls `track()` on the `presence:global` channel, so each signed-in user has one presence entry no matter how many chat windows are open. Chat windows still need the friend's presence (to enable the Nudge button and stamp `delivered_at`), so they **subscribe to the same channel read-only and never track**. Subscribing without tracking adds no presence entry. We chose this over relaying presence from the Buddy List to each chat window through Tauri events, because it needs no cross-window plumbing and also works when the app runs in a plain browser during development.

## Consequences

- Every subscriber receives all users' presence and filters to friends on the client. Presence carries only a user id and a state, never profile data.
