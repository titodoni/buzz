-- Buzz: security hardening found in the 24 Nov 2026 audit. Nothing here changes
-- what an honest app does; each part closes something a modified app could do.
--
-- 1. Messages: the server decides created_at and delivered_at.
-- 2. Hangouts: the receiver cannot accept after 15 minutes, and responded_at is the server's.
-- 3. Friend search: names need 3+ letters, and 20 results at most (exact email still works).
-- 4. Missing indexes for the cron jobs and the ignore lookups.
-- 5. Table grants: nothing for anon, no TRUNCATE, REFERENCES or TRIGGER for signed-in users.
-- 6. avatar_url length limit.

-- 1. Without this, a sender could insert with delivered_at already set, which
-- the 30-day purge (delivered_at is null) never deletes, or back- and
-- future-date created_at to jump the order. Skipped when there is no JWT user
-- (pg_cron, migrations, the owner role).
create function public.messages_server_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

create trigger messages_server_fields
  before insert on public.messages
  for each row execute function public.messages_server_fields();

-- 2. Same function as before, with two additions: the receiver may only answer
-- a Hangout that is still inside its 15 minutes (R3.5), and responded_at can
-- no longer be edited on a row whose status did not change.
create or replace function public.enforce_hangout_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.text is distinct from old.text
     or new.created_at is distinct from old.created_at
     or (new.status = old.status and new.responded_at is distinct from old.responded_at) then
    raise exception 'hangouts: only status may be updated';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'hangouts: an answered hangout cannot change';
  end if;

  if auth.uid() = old.receiver_id
     and new.status in ('accepted', 'declined')
     and old.created_at > now() - interval '15 minutes' then
    new.responded_at := now();
    return new;
  end if;

  if auth.uid() = old.sender_id
     and new.status = 'expired'
     and old.created_at <= now() - interval '15 minutes' then
    new.responded_at := now();
    return new;
  end if;

  raise exception 'hangouts: this status change is not allowed';
end;
$$;

-- 3. A one-letter search used to list up to 50 people, so a script could walk
-- the whole user table. Exact email matching is unchanged (ADR 0004).
create or replace function public.search_users(q text)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  status_message text,
  now_playing text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_url, p.status_message, p.now_playing
  from public.profiles p
  join auth.users u on u.id = p.id
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(q)) between 1 and 100
    and (
      (
        length(btrim(q)) >= 3
        and p.display_name ilike '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
      or lower(u.email) = lower(btrim(q))
    )
  order by p.display_name
  limit 20;
$$;

revoke all on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;

-- 4. ignorers_of_me() and the profile feed filter by ignored_id; the daily
-- purge and the minute-by-minute hangout expiry scan by age.
create index if not exists ignored_users_ignored_idx
  on public.ignored_users (ignored_id);
create index if not exists messages_undelivered_idx
  on public.messages (created_at) where delivered_at is null;
create index if not exists hangouts_pending_idx
  on public.hangouts (created_at) where status = 'pending';
create index if not exists contact_group_members_friend_idx
  on public.contact_group_members (friend_id);
create index if not exists contact_group_members_group_owner_idx
  on public.contact_group_members (group_id, owner_id);

-- 5. RLS already blocks anon, but a grant that is never used is a risk that
-- only one mistake away from a hole. PostgREST does not expose TRUNCATE.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 6. The pattern check allowed any length.
alter table public.profiles
  add constraint profiles_avatar_url_len
  check (avatar_url is null or char_length(avatar_url) <= 512);
