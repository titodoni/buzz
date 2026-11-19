-- Buzz: fixes two gaps found while building the friends UI.
-- 1. Either person in a declined/removed pair may send a new request
--    (the row is reused and the requester/addressee are swapped as needed).
-- 2. Search by email (Req 3.1) without exposing emails: emails live in
--    auth.users, so a security-definer function does the lookup and never
--    returns the email itself.

create or replace function public.enforce_friendship_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'friendships: id and created_at are immutable';
  end if;

  -- Re-request: a party re-opens a declined/removed pair as the new requester.
  -- The pair itself must stay the same (only the direction may flip).
  if old.status in ('removed', 'declined') and new.status = 'pending'
     and uid in (old.requester_id, old.addressee_id)
     and new.requester_id = uid
     and least(new.requester_id, new.addressee_id)
         = least(old.requester_id, old.addressee_id)
     and greatest(new.requester_id, new.addressee_id)
         = greatest(old.requester_id, old.addressee_id) then
    return new;
  end if;

  -- Every other change may touch status only.
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id then
    raise exception 'friendships: only status may be changed';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'declined')
     and uid = old.addressee_id then
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'removed'
     and uid in (old.requester_id, old.addressee_id) then
    return new;
  end if;

  raise exception 'friendships: transition % -> % not allowed for this user',
    old.status, new.status;
end;
$$;

-- Search: display name contains the term (case-insensitive), or the email
-- matches the term exactly (case-insensitive). Exact-only email matching is a
-- deliberate privacy choice: partial email matching would let anyone probe
-- for addresses. The email is never returned.
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
      p.display_name ilike '%' || replace(replace(replace(btrim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or lower(u.email) = lower(btrim(q))
    )
  order by p.display_name
  limit 50;
$$;

revoke all on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;
