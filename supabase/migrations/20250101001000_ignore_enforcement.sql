-- Buzz: enforce the ignore list (Requirement 15; docs/adr/0009).
-- If A ignores B, B can no longer message A, send A a friend request, or
-- broadcast (Buzz!, typing) to A. A can still reach B: ignoring is one-way.

-- RLS hides ignored_users from everyone but its owner, so policies that check
-- someone else's list need this security-definer helper.
-- True when `owner` has ignored the signed-in user.
create or replace function public.is_ignored_by(owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ignored_users i
    where i.owner_id::text = owner
      and i.ignored_id = auth.uid()
  );
$$;

-- The people who ignore the signed-in user. Presence is a public channel the
-- database can't filter, so the ignored person's app uses this to show them
-- as Offline. A modified client could learn it was ignored (docs/adr/0009).
create or replace function public.ignorers_of_me()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.owner_id from public.ignored_users i where i.ignored_id = auth.uid();
$$;

revoke all on function public.is_ignored_by(text) from public, anon;
revoke all on function public.ignorers_of_me() from public, anon;
grant execute on function public.is_ignored_by(text) to authenticated;
grant execute on function public.ignorers_of_me() to authenticated;

-- Messages (Req 15.2).
drop policy "messages_insert_as_sender" on public.messages;
create policy "messages_insert_as_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and read_at is null
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(messages.sender_id, messages.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(messages.sender_id, messages.receiver_id)
    )
    and not public.is_ignored_by(messages.receiver_id::text)
  );

-- New friend requests (Req 15.4).
drop policy "friendships_insert_as_requester" on public.friendships;
create policy "friendships_insert_as_requester"
  on public.friendships for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and not public.is_ignored_by(addressee_id::text)
  );

-- Re-requests reuse a declined/removed row (an UPDATE), so a trigger covers them.
create or replace function public.reject_request_to_ignorer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.status = 'pending'
     and old.status is distinct from 'pending'
     and new.requester_id = auth.uid()
     and public.is_ignored_by(new.addressee_id::text) then
    -- Deliberately vague: the person must not learn they were ignored (Req 15.7).
    raise exception 'friendships: request not allowed';
  end if;
  return new;
end;
$$;

create trigger friendships_reject_request_to_ignorer
  before update on public.friendships
  for each row execute function public.reject_request_to_ignorer();

-- Buzz! to the inbox (Req 15.3).
drop policy "inbox_send_from_friends" on realtime.messages;
create policy "inbox_send_from_friends"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'inbox:%'
    and public.is_friend_of_me(split_part(realtime.topic(), ':', 2))
    and not public.is_ignored_by(split_part(realtime.topic(), ':', 2))
  );

-- Buzz! and typing on the pair's chat channel (Req 15.3).
drop policy "chat_pair_send" on realtime.messages;
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
    and not public.is_ignored_by(
      case
        when split_part(split_part(realtime.topic(), ':', 2), '_', 1) = (select auth.uid())::text
          then split_part(split_part(realtime.topic(), ':', 2), '_', 2)
        else split_part(split_part(realtime.topic(), ':', 2), '_', 1)
      end
    )
  );
