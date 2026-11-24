-- Buzz: follow-up to 20261124124350_security_hardening. That trigger cleared
-- delivered_at on every insert, but the sender's app stamps it on purpose when
-- the friend is online (Req 5.5, 9.1; lib/chat/api.ts). A stamped row is only
-- kept like any delivered message, so there is nothing to block. The server
-- still owns the clock: created_at is always now, and a stamp is moved to now.

create or replace function public.messages_server_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
    if new.delivered_at is not null then
      new.delivered_at := now();
    end if;
  end if;
  return new;
end;
$$;
