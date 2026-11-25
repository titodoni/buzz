-- Buzz: allow registration to supply display_name via auth user metadata,
-- falling back to the email prefix (Req 1.3) when omitted or blank.
create or replace function public.handle_new_user()
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
      nullif(btrim(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 50)), ''),
      nullif(btrim(left(split_part(coalesce(new.email, ''), '@', 1), 50)), ''),
      'buddy'
    ),
    '/avatars/default.png'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
