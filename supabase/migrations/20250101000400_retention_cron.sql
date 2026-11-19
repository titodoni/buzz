-- Buzz: daily purge of undelivered messages older than 30 days (Req 9.6).

create extension if not exists pg_cron;

-- cron.schedule with a job name replaces any existing job of that name.
select cron.schedule(
  'purge_undelivered_messages',
  '0 3 * * *',
  $$ delete from public.messages
      where delivered_at is null
        and created_at < now() - interval '30 days' $$
);
