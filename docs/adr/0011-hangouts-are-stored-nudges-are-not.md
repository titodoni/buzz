# Hangouts are stored, Nudges are not

A Hangout is a one-line invitation from one friend to another ("Play a game?"). Unlike a Nudge (ADR 0007), it has state: pending, accepted, declined, or expired. Both people need to read the same answer later, even if one window was closed when it came. So a Hangout is a row in a `hangouts` table, and a Nudge stays an ephemeral broadcast.

The rules live in the database, not in the client:

- Row Level Security: only the sender and receiver read a Hangout, and only while they are accepted friends (the same rule as `messages`).
- A partial unique index allows one pending Hangout per pair, in either direction.
- A sender the receiver has ignored cannot insert (`is_ignored_by`, ADR 0009).
- A trigger decides who changes what. The receiver moves pending to accepted or declined. The sender can move pending to expired, only once it is 15 minutes old. An answered Hangout is final. `text`, the ids and `created_at` never change.
- There is no delete policy. A `pg_cron` job marks unanswered Hangouts expired every minute. The app also reads a pending row older than 15 minutes as expired, so the screen is right between job runs.

## Consequences

- Hangouts reach the app through `postgres_changes` on the table, filtered to rows I send and rows I receive. Nothing is broadcast, so there is no Hangout traffic on a public channel. The design note suggested an extra broadcast on `inbox:<userId>` for speed; it is left out until the two-user check shows `postgres_changes` is too slow for the 2 second target (R3.2).
- System lines ("Bob accepted: Play a game?", "Hangout declined", "Hangout expired") are drawn from the row. They are never inserted into `messages`.
- Hangout text is stored in plain text. Encrypted Messages (ADR 0010) cover chat messages only. Do not describe Hangouts as encrypted.
- An unanswered Hangout from the other side blocks a new one for up to a minute after it passes 15 minutes, until the cron job runs. The sender's own stale Hangout is expired by the app at send time.
