# A nudge is a broadcast, with the cooldown on the sender

A nudge is an ephemeral Realtime broadcast, sent both on the pair's `chat:<pairKey>` channel (reaches an open chat window) and on the friend's personal `inbox:<friendId>` channel (reaches their Buddy List, which opens the chat window and shakes it, as classic Yahoo Messenger did). It is never stored, and there is no `nudges` table. The 10-second cooldown is enforced by the sender's client (persisted in `localStorage` per friend), not the server. A nudge is "delivered" when the Realtime server accepts either broadcast, which does not prove the friend received it; a friend who is offline simply misses it, and the Nudge button is disabled for offline friends anyway. We accepted that because storing nudges adds a table, policies, and cleanup for a signal that is meaningless a few seconds later.

## Consequences

- Inbox channels are public Realtime channels: anyone signed in who knows a user id could send to that inbox. The Buddy List ignores nudges from non-friends, so the worst case is a no-op. Private channels with Realtime authorization would close this if it ever matters.
