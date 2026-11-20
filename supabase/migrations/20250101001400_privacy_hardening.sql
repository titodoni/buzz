-- Buzz: privacy hardening (buzz-encryption spec, E0.1 to E0.3).
-- 1. A user reads only their own profile, the profiles of accepted friends
--    and of people with a pending request to or from them, and the profiles
--    of people on their own Ignore List. Strangers can no longer list everyone,
--    and the Realtime profiles feed follows the same rule. Friend search stays
--    possible: search_users() is security definer and returns no email.
-- 2. avatar_url may only point at the app's bundled avatars or at the user's
--    own folder in this project's avatars bucket. Friends' apps load that URL,
--    so a free-form value would let a friend track their IP addresses.
-- 3. Nobody can list the avatars bucket. Public image URLs still load,
--    because public buckets serve objects without a SELECT policy.

drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_self_and_related"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.friendships f
      where f.status in ('pending', 'accepted')
        and (select auth.uid()) in (f.requester_id, f.addressee_id)
        and profiles.id in (f.requester_id, f.addressee_id)
    )
    or exists (
      select 1
      from public.ignored_users i
      where i.owner_id = (select auth.uid())
        and i.ignored_id = profiles.id
    )
  );

-- The host below is this project's. Another project, or a local
-- `supabase start`, needs its own host here (the local one is allowed too).
alter table public.profiles
  add constraint profiles_avatar_url_allowed check (
    avatar_url is null
    or avatar_url like '/avatars/%'
    or avatar_url like
      'https://mkeozqwudranxrdferai.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
    or avatar_url like
      'http://127.0.0.1:54321/storage/v1/object/public/avatars/' || id::text || '/%'
  );

drop policy if exists "avatars_read_all" on storage.objects;
