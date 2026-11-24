-- Buzz: Hangouts (buzz-trigger R3, R6). A Hangout is a one-line invitation
-- from one friend to another: "Play a game?". It has state (pending,
-- accepted, declined, expired), so unlike a Nudge it is stored.
-- Numbering: 1400 to 1610 belong to buzz-encryption; this follows them.

create table public.hangouts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  text text not null
    check (char_length(text) between 1 and 60 and btrim(text) <> ''),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);

create index hangouts_receiver_status_idx
  on public.hangouts (receiver_id, status, created_at);
create index hangouts_pair_status_idx
  on public.hangouts (sender_id, receiver_id, status);

-- One pending Hangout per pair, whichever way round (R3.6).
create unique index hangouts_one_pending_per_pair
  on public.hangouts (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id)
  )
  where status = 'pending';

-- Who may change what. Skipped when there is no JWT user (pg_cron, migrations).
--   receiver: pending to accepted or declined
--   sender:   pending to expired, only once the Hangout is 15 minutes old
-- A Hangout that has been answered is final. The ids, text and created_at never change.
create function public.enforce_hangout_update()
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
     or new.created_at is distinct from old.created_at then
    raise exception 'hangouts: only status may be updated';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'hangouts: an answered hangout cannot change';
  end if;

  if auth.uid() = old.receiver_id and new.status in ('accepted', 'declined') then
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

create trigger hangouts_enforce_update
  before update on public.hangouts
  for each row execute function public.enforce_hangout_update();

alter table public.hangouts enable row level security;

-- Only the two people involved, and only while they are accepted friends
-- (same pattern as messages: hidden on unfriend, restored on re-friend).
create policy "hangouts_select_parties"
  on public.hangouts for select
  to authenticated
  using (
    (select auth.uid()) in (sender_id, receiver_id)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(hangouts.sender_id, hangouts.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(hangouts.sender_id, hangouts.receiver_id)
    )
  );

-- Send: as yourself, to an accepted friend who has not ignored you (ADR 0009).
create policy "hangouts_insert_as_sender"
  on public.hangouts for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and status = 'pending'
    and responded_at is null
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(hangouts.sender_id, hangouts.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(hangouts.sender_id, hangouts.receiver_id)
    )
    and not public.is_ignored_by(hangouts.receiver_id::text)
  );

-- Answer or expire. The trigger above decides which party may do which change.
create policy "hangouts_update_parties"
  on public.hangouts for update
  to authenticated
  using (
    (select auth.uid()) in (sender_id, receiver_id)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(hangouts.sender_id, hangouts.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(hangouts.sender_id, hangouts.receiver_id)
    )
  )
  with check ((select auth.uid()) in (sender_id, receiver_id));

-- No delete policy: nothing deletes a Hangout from the client.

-- Realtime: the banner and the system lines follow row changes.
alter publication supabase_realtime add table public.hangouts;

-- Expire unanswered Hangouts every minute (R3.5). A row older than 15 minutes
-- already reads as expired in the app, so this only tidies the table and
-- frees the pair for a new Hangout. cron.schedule replaces a job of the same name.
select cron.schedule(
  'expire_pending_hangouts',
  '* * * * *',
  $$ update public.hangouts
        set status = 'expired'
      where status = 'pending'
        and created_at < now() - interval '15 minutes' $$
);
