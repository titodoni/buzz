-- Buzz: message formatting (Req 17.2, 17.4).
-- `format` is null (default look) or exactly these six keys:
--   { font, size, color, bold, italic, underline }
-- font  : one of Tahoma, Verdana, Arial, Times New Roman
-- size  : whole number of points, 10 to 24
-- color : lowercase #rrggbb
-- bold, italic, underline : booleans
-- Clients still validate on display (lib/chat/format.ts), so a row that
-- somehow got past this shows in the default format, never as raw style.
alter table public.messages add column format jsonb;

alter table public.messages add constraint messages_format_valid check (
  format is null or (
    jsonb_typeof(format) = 'object'
    -- all six keys present: a missing one would make its test NULL, and a
    -- CHECK lets NULL through
    and format ?& array['font', 'size', 'color', 'bold', 'italic', 'underline']
    -- no keys other than the six
    and format - array['font', 'size', 'color', 'bold', 'italic', 'underline'] = '{}'::jsonb
    and jsonb_typeof(format -> 'font') = 'string'
    and format ->> 'font' in ('Tahoma', 'Verdana', 'Arial', 'Times New Roman')
    and jsonb_typeof(format -> 'size') = 'number'
    -- CASE so the cast only runs on two-digit whole numbers
    and case when format ->> 'size' ~ '^[0-9]{2}$'
             then (format ->> 'size')::int between 10 and 24
             else false end
    and jsonb_typeof(format -> 'color') = 'string'
    and format ->> 'color' ~ '^#[0-9a-f]{6}$'
    and jsonb_typeof(format -> 'bold') = 'boolean'
    and jsonb_typeof(format -> 'italic') = 'boolean'
    and jsonb_typeof(format -> 'underline') = 'boolean'
  )
);

-- Receivers may still only set delivered_at / read_at: the format is the
-- sender's and is final like the body.
create or replace function public.enforce_message_receipt_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.body is distinct from old.body
     or new.format is distinct from old.format
     or new.created_at is distinct from old.created_at then
    raise exception 'messages: only delivered_at and read_at may be updated';
  end if;
  if (old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at)
     or (old.read_at is not null and new.read_at is distinct from old.read_at) then
    raise exception 'messages: delivered_at and read_at cannot be changed once set';
  end if;
  return new;
end;
$$;
