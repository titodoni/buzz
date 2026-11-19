-- Buzz: friendships table, pair uniqueness, transition guard, RLS.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null
    check (status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- One row per unordered pair.
create unique index friendships_pair_uniq
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index friendships_addressee_idx on public.friendships (addressee_id);
create index friendships_requester_idx on public.friendships (requester_id);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

-- RLS cannot see OLD values, so a trigger enforces the status transitions.
-- Skipped when there is no JWT user (service role / migrations).
create function public.enforce_friendship_transition()
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
     or new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.created_at is distinct from old.created_at then
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

  if old.status in ('removed', 'declined') and new.status = 'pending'
     and uid = old.requester_id then
    return new;
  end if;

  raise exception 'friendships: transition % -> % not allowed for this user',
    old.status, new.status;
end;
$$;

create trigger friendships_enforce_transition
  before update on public.friendships
  for each row execute function public.enforce_friendship_transition();

alter table public.friendships enable row level security;

create policy "friendships_select_parties"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "friendships_insert_as_requester"
  on public.friendships for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
  );

create policy "friendships_update_parties"
  on public.friendships for update
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id))
  with check ((select auth.uid()) in (requester_id, addressee_id));

-- No delete policy: rows are never deleted by clients.
