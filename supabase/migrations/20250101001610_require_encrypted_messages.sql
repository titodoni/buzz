-- Buzz: Encrypted Messages, step 2 of 2: the cutover (buzz-encryption E4.2).
-- DO NOT APPLY until the app build that encrypts has been released to every
-- user. After this, an old build can no longer send: its plaintext insert fails.
-- Rows already stored stay as they are, marked not encrypted.
--
-- Same rules as before (sender, friendship, ignore list) plus `encrypted`.

drop policy "messages_insert_as_sender" on public.messages;

create policy "messages_insert_as_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and read_at is null
    and encrypted
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(messages.sender_id, messages.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(messages.sender_id, messages.receiver_id)
    )
    and not public.is_ignored_by(receiver_id::text)
  );
