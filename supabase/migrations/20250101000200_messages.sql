-- Buzz: messages table, indexes, receipt-only update guard, RLS, realtime.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
    check (char_length(body) between 1 and 1000 and btrim(body) <> ''),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

create index messages_receiver_delivered_idx
  on public.messages (receiver_id, delivered_at);
create index messages_pair_created_idx
  on public.messages (sender_id, receiver_id, created_at);

-- Receivers may only set delivered_at / read_at; once set they are final.
-- Skipped when there is no JWT user (service role / migrations).
create function public.enforce_message_receipt_update()
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
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'messages: only delivered_at and read_at may be updated';
  end if;

  if (old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at)
     or (old.read_at is not null and new.read_at is distinct from old.read_at) then
    raise exception 'messages: delivered_at and read_at cannot be changed once set';
  end if;

  return new;
end;
$$;

create trigger messages_enforce_receipt_update
  before update on public.messages
  for each row execute function public.enforce_message_receipt_update();

alter table public.messages enable row level security;

-- Visibility follows an accepted friendship (hide on unfriend, restore on
-- re-friend). The EXISTS subquery runs under friendships RLS, which lets
-- either party see their own row.

create policy "messages_select_friends"
  on public.messages for select
  to authenticated
  using (
    (select auth.uid()) in (sender_id, receiver_id)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(messages.sender_id, messages.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(messages.sender_id, messages.receiver_id)
    )
  );

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
  );

create policy "messages_update_receiver_receipts"
  on public.messages for update
  to authenticated
  using (
    receiver_id = (select auth.uid())
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(messages.sender_id, messages.receiver_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(messages.sender_id, messages.receiver_id)
    )
  )
  with check (receiver_id = (select auth.uid()));

-- No delete policy. Retention is handled by pg_cron (separate migration).

-- Realtime: chat delivery (messages INSERT) and the profiles feed (UPDATE).
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.profiles;
