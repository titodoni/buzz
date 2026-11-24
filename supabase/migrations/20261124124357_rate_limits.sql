-- Buzz: rate limits found missing in the 24 Nov 2026 audit (S3). Every limit is
-- far above what a person does by hand, so honest use never meets one. Each is
-- skipped when there is no JWT user (pg_cron, migrations, the owner role).
--
--   messages          60 per minute per sender
--   hangouts          10 per 10 minutes per sender
--   friend requests   20 new or re-opened requests per hour per sender
--   a declined request cannot be re-opened for an hour

create index if not exists messages_sender_created_idx
  on public.messages (sender_id, created_at desc);
create index if not exists hangouts_sender_created_idx
  on public.hangouts (sender_id, created_at desc);
create index if not exists friendships_requester_pending_idx
  on public.friendships (requester_id, updated_at desc) where status = 'pending';

create function public.messages_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (select count(*) from public.messages m
          where m.sender_id = new.sender_id
            and m.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'messages: slow down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function public.messages_rate_limit();

create function public.hangouts_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (select count(*) from public.hangouts h
          where h.sender_id = new.sender_id
            and h.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'hangouts: slow down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger hangouts_rate_limit
  before insert on public.hangouts
  for each row execute function public.hangouts_rate_limit();

-- Runs for a brand new request and for re-opening a declined or removed pair.
-- OLD.updated_at is when the pair last changed, so a decline starts the wait.
create function public.friendships_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (old.status in ('declined', 'removed') and new.status = 'pending') then
      return new;
    end if;
    if old.status = 'declined' and old.updated_at > now() - interval '1 hour' then
      raise exception 'friendships: wait before asking again' using errcode = 'P0001';
    end if;
  end if;

  if (select count(*) from public.friendships f
      where f.requester_id = new.requester_id
        and f.status = 'pending'
        and f.updated_at > now() - interval '1 hour') >= 20 then
    raise exception 'friendships: too many requests' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger friendships_rate_limit
  before insert or update on public.friendships
  for each row execute function public.friendships_rate_limit();
