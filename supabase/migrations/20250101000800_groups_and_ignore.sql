-- Buzz: Buddy List groups and the ignore list (Requirements 14, 15).
-- Every row belongs to one user and only that user can see or change it.

-- Groups the user sorts friends into. The default group "Friends" has no row,
-- so the name is reserved; a friend with no membership row is in it.
create table public.contact_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 40
    and lower(name) <> 'friends'
  ),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- Lets memberships require that the group has the same owner.
  unique (id, owner_id)
);

create unique index contact_groups_owner_name_uniq on public.contact_groups (owner_id, lower(name));

alter table public.contact_groups enable row level security;

create policy "contact_groups_select_own" on public.contact_groups for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "contact_groups_insert_own" on public.contact_groups for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "contact_groups_update_own" on public.contact_groups for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "contact_groups_delete_own" on public.contact_groups for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Which of the user's groups each friend is in (at most one). Deleting a
-- group deletes its rows, which moves those friends back to "Friends".
create table public.contact_group_members (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null,
  primary key (owner_id, friend_id),
  foreign key (group_id, owner_id) references public.contact_groups (id, owner_id) on delete cascade,
  check (owner_id <> friend_id)
);

create index contact_group_members_group_idx on public.contact_group_members (group_id);

alter table public.contact_group_members enable row level security;

create policy "contact_group_members_select_own" on public.contact_group_members for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "contact_group_members_insert_own" on public.contact_group_members for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "contact_group_members_update_own" on public.contact_group_members for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "contact_group_members_delete_own" on public.contact_group_members for delete to authenticated
  using (owner_id = (select auth.uid()));

-- People the user has blocked. Only the owner can read it, so nobody can find
-- out they were ignored (Req 15.7). Enforcement comes with Section 24.
create table public.ignored_users (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  ignored_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, ignored_id),
  check (owner_id <> ignored_id)
);

alter table public.ignored_users enable row level security;

create policy "ignored_users_select_own" on public.ignored_users for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "ignored_users_insert_own" on public.ignored_users for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "ignored_users_delete_own" on public.ignored_users for delete to authenticated
  using (owner_id = (select auth.uid()));
