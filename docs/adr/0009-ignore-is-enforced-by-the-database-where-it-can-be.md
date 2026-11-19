# Ignoring someone is enforced by the database, except for presence

When a user ignores a person, Postgres enforces it in the places it owns: the `messages` and friend-request insert policies and the Realtime authorization policies for chat and inbox channels reject anything from an ignored person. Hiding the user's presence from that person is **not** enforceable, because `presence:global` is a public channel that every signed-in client can read (docs/adr/0003). The ignored person's app is told to show the user as Offline, and a modified client could still see them. We chose to ship that honest limit now over building one private presence channel per user, which is a larger change we may make later.

## How it works (migration `20250101001000`)

- `ignored_users` is readable only by its owner, so policies that check
  *someone else's* list call the security-definer `is_ignored_by(owner)`.
  The `messages` and friend-request insert policies, a trigger on friend
  re-requests, and the chat and inbox broadcast policies all refuse a sender
  the receiver has ignored. Ignoring is one-way: the ignorer can still reach
  the ignored person.
- `ignorers_of_me()` returns the people who ignore the signed-in user. Their
  app shows those people as Offline (`hideIgnorers`), which also disables
  Buzz!. It refreshes when the window gets focus, so the change reaches the
  ignored person then, not instantly.
- Failures are reported in the same generic words as any other failure
  ("This message was not sent.").
- Supabase checks Realtime broadcast permissions when a client joins a
  channel. Someone already joined to `chat:<pair>` or `inbox:<id>` when they
  are ignored can still get typing and Buzz! through until they rejoin
  (reconnect or reopen). The ignorer's app drops those too, so nothing shows.
- A friend request sent before the ignore stays in the database as pending,
  but the ignorer's Buddy List hides it.

## Consequences

- The user interface must never promise that an ignored person "cannot see you".
- `is_ignored_by` and `ignorers_of_me` let a person's own (possibly modified)
  client find out who ignores them. The app never says so (Req 15.7), but this
  is a deliberate trade for hiding presence at all; only per-user private
  presence channels would remove it.
- If per-user private presence channels are added, this limit goes away without changing the table or the policies.
