-- Buzz: two audit findings (24 Nov 2026).
--
-- S1. Presence moves from the public `presence:global` channel to one private
--     topic per person, `presence:<userId>`. Only that person may track there,
--     and only their accepted friends (who they do not ignore) may listen. A
--     stranger can no longer list who is online, and nobody can fake a
--     friend's state. Client: lib/realtime/presence.ts. After this ships, turn
--     off "Allow public access" in the project's Realtime settings, so every
--     channel needs these policies (supabase/README.md).
--
-- S11. A message's sender key must be the sender's published key. The app
--     also checks the key on its own side (lib/chat/wire.ts), because a
--     database check alone cannot protect against whoever runs the database.

-- Presence: only I may track on my own topic.
create policy "presence_track_own"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and realtime.topic() = 'presence:' || (select auth.uid())::text
  );

-- Presence: I may listen on my own topic, and on an accepted friend's topic
-- unless that friend ignores me (an ignorer looks offline, Req 15.5).
create policy "presence_receive_friends"
  on realtime.messages for select
  to authenticated
  using (
    realtime.topic() like 'presence:%'
    and (
      realtime.topic() = 'presence:' || (select auth.uid())::text
      or (
        public.is_friend_of_me(split_part(realtime.topic(), ':', 2))
        and not public.is_ignored_by(split_part(realtime.topic(), ':', 2))
      )
    )
  );

-- Sender key: an Encrypted Message must carry the key its sender published.
-- Skipped when there is no JWT user (pg_cron, migrations, the owner role).
create function public.messages_sender_key_matches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or not new.encrypted then
    return new;
  end if;
  if new.sender_public_key is distinct from (
    select k.public_key from public.user_keys k where k.user_id = new.sender_id
  ) then
    raise exception 'messages: sender key is not the published key' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger messages_sender_key_matches
  before insert on public.messages
  for each row execute function public.messages_sender_key_matches();
