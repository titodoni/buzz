-- Buzz: Realtime Authorization for the private broadcast channels.
--
-- `inbox:<userId>` and `chat:<idA>_<idB>` are joined with `private: true`, so
-- Realtime checks these RLS policies on realtime.messages before letting a
-- client receive (SELECT) or send (INSERT) on a topic. Without them any
-- signed-in user could send nudges or typing signals to anyone
-- (review finding; docs/adr/0007).
--
-- postgres_changes on the chat channel is still authorised by the
-- `messages` table RLS; these policies only govern broadcast traffic and the
-- right to join the topic.

-- True when `other` is an accepted friend of the signed-in user.
create or replace function public.is_friend_of_me(other text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id::text = other)
        or (f.addressee_id = auth.uid() and f.requester_id::text = other)
      )
  );
$$;

revoke all on function public.is_friend_of_me(text) from public, anon;
grant execute on function public.is_friend_of_me(text) to authenticated;

-- Inbox: only I can listen on my inbox.
create policy "inbox_receive_own"
  on realtime.messages for select
  to authenticated
  using (realtime.topic() = 'inbox:' || (select auth.uid())::text);

-- Inbox: only my accepted friends can send to it, and only broadcasts.
create policy "inbox_send_from_friends"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'inbox:%'
    and public.is_friend_of_me(split_part(realtime.topic(), ':', 2))
  );

-- Chat: topic is `chat:<min>_<max>` (lib/friends/search.ts pairKey). Only the
-- two people of an accepted pair may join it or broadcast on it.
create policy "chat_pair_receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.topic() like 'chat:%'
    and (select auth.uid())::text in (
      split_part(split_part(realtime.topic(), ':', 2), '_', 1),
      split_part(split_part(realtime.topic(), ':', 2), '_', 2)
    )
    and public.is_friend_of_me(
      case
        when split_part(split_part(realtime.topic(), ':', 2), '_', 1) = (select auth.uid())::text
          then split_part(split_part(realtime.topic(), ':', 2), '_', 2)
        else split_part(split_part(realtime.topic(), ':', 2), '_', 1)
      end
    )
  );

create policy "chat_pair_send"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'chat:%'
    and (select auth.uid())::text in (
      split_part(split_part(realtime.topic(), ':', 2), '_', 1),
      split_part(split_part(realtime.topic(), ':', 2), '_', 2)
    )
    and public.is_friend_of_me(
      case
        when split_part(split_part(realtime.topic(), ':', 2), '_', 1) = (select auth.uid())::text
          then split_part(split_part(realtime.topic(), ':', 2), '_', 2)
        else split_part(split_part(realtime.topic(), ':', 2), '_', 1)
      end
    )
  );
