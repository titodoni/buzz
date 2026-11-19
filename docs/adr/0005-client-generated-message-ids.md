# The client generates message ids

When sending, the chat window creates the message id with `crypto.randomUUID()` and inserts it, instead of letting Postgres default it. The message appears at once as "sending", and when the insert's confirmation or its Realtime echo arrives, it is matched to the same item by id instead of being shown twice. This keeps the conversation reducer (`lib/chat/conversation.ts`) pure and deterministic; the alternative of matching echoes by sender, body, and time was fragile.
