-- Buzz: group memberships may only name an accepted friend, and group
-- changes stream to the user's other app instances (review of section 23).

drop policy "contact_group_members_insert_own" on public.contact_group_members;
drop policy "contact_group_members_update_own" on public.contact_group_members;

create policy "contact_group_members_insert_own_friend" on public.contact_group_members for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_friend_of_me(friend_id::text));
create policy "contact_group_members_update_own_friend" on public.contact_group_members for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_friend_of_me(friend_id::text));

-- Unfriending keeps the row on purpose: it is private to the owner, the
-- Buddy List ignores it while they aren't friends, and a re-added friend
-- comes back in the same group.

-- Rows still go through RLS, so each user only receives their own changes.
alter publication supabase_realtime add table public.contact_groups;
alter publication supabase_realtime add table public.contact_group_members;
