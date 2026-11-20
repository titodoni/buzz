-- Buzz: public keys for Encrypted Messages (buzz-encryption E1.4, ADR 0010).
-- One public key per account. The private key never reaches the database.
-- Friends read it to encrypt to you; only you can write it. A fresh start on a
-- new device replaces the row (one key per account, Q4).
--
-- Clients read the key right before sending, so no Realtime publication is needed.

create table public.user_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- A base64url X25519 public key: 32 bytes, 43 characters, no padding.
  public_key text not null
    check (char_length(public_key) = 43 and public_key ~ '^[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_keys_set_updated_at
  before update on public.user_keys
  for each row execute function public.set_updated_at();

alter table public.user_keys enable row level security;

-- You, and people you are accepted friends with. Not pending requests, not
-- removed friends, not strangers.
create policy "user_keys_select_self_and_friends"
  on public.user_keys for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (select auth.uid()) in (f.requester_id, f.addressee_id)
        and user_keys.user_id in (f.requester_id, f.addressee_id)
    )
  );

create policy "user_keys_insert_own"
  on public.user_keys for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_keys_update_own"
  on public.user_keys for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No delete policy: a key row goes away only with its profile.
