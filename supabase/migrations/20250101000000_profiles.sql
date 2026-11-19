-- Buzz: profiles table, signup trigger, updated_at trigger, RLS.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 50),
  avatar_url text,
  status_message text
    check (status_message is null or char_length(status_message) <= 140),
  now_playing text
    check (now_playing is null or char_length(now_playing) <= 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared trigger function: keep updated_at current on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when a user signs up (Req 1.3).
-- Default avatar is an app-bundled asset path (assumption; see supabase/README.md).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(btrim(left(split_part(coalesce(new.email, ''), '@', 1), 50)), ''),
      'buddy'
    ),
    '/avatars/default.png'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policies: rows are created by the trigger and removed
-- by the auth.users cascade.
