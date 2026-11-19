# A nudge is a broadcast, with the cooldown on the sender

A nudge is an ephemeral Realtime broadcast on the pair's `chat:<pairKey>` channel. It is never stored, and there is no `nudges` table. The 10-second cooldown is enforced by the sender's client, not the server. A nudge is "delivered" when the Realtime server acknowledges the broadcast (`ack: true`), which does not prove the friend's chat window was open to receive it. We accepted that because storing nudges adds a table, policies, and cleanup for a signal that is meaningless a few seconds later.
