# Ignoring someone is enforced by the database, except for presence

When a user ignores a person, Postgres enforces it in the places it owns: the `messages` and friend-request insert policies and the Realtime authorization policies for chat and inbox channels reject anything from an ignored person. Hiding the user's presence from that person is **not** enforceable, because `presence:global` is a public channel that every signed-in client can read (docs/adr/0003). The ignored person's app is told to show the user as Offline, and a modified client could still see them. We chose to ship that honest limit now over building one private presence channel per user, which is a larger change we may make later.

## Consequences

- The user interface must never promise that an ignored person "cannot see you".
- If per-user private presence channels are added, this limit goes away without changing the table or the policies.
