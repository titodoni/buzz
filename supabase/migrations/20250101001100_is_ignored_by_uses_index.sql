-- Buzz: is_ignored_by runs on every message insert and broadcast, so compare
-- uuids (the ignored_users primary key can then be used) instead of casting
-- the column to text. A topic part that isn't a uuid simply means "no".
create or replace function public.is_ignored_by(owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (
        select 1 from public.ignored_users i
        where i.owner_id = owner::uuid
          and i.ignored_id = auth.uid()
      )
    else false
  end;
$$;
