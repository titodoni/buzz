-- Buzz: the sender of a pending friend request can take it back.
-- pending -> removed, by the requester only. The pair can then be re-requested
-- through the existing removed -> pending path (rate limits still apply).
-- Everything else in enforce_friendship_transition() is unchanged from
-- 20250101000500_friend_search_and_rerequest.sql.

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

  -- Cancel: the sender withdraws their own pending request.
  if old.status = 'pending' and new.status = 'removed'
     and uid = old.requester_id then
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
