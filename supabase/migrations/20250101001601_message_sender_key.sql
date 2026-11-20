-- Buzz: Encrypted Messages carry the sender's public key as it was when the
-- message was sent (buzz-encryption E2). Without it, a friend who later starts
-- fresh with a new key would make all their old messages to you unreadable.
-- The key is not secret. Additive: plaintext rows leave it null.

alter table public.messages add column sender_public_key text;

alter table public.messages drop constraint messages_body_or_cipher;
alter table public.messages add constraint messages_body_or_cipher check (
  (
    not encrypted
    and body is not null
    and cipher_receiver is null
    and cipher_sender is null
    and sender_public_key is null
  )
  or (
    encrypted
    and body is null
    and format is null
    and cipher_receiver is not null
    and cipher_sender is not null
    and char_length(cipher_receiver) between 1 and 6000
    and char_length(cipher_sender) between 1 and 6000
    and sender_public_key ~ '^[A-Za-z0-9_-]{43}$'
  )
);

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
     or new.encrypted is distinct from old.encrypted
     or new.cipher_receiver is distinct from old.cipher_receiver
     or new.cipher_sender is distinct from old.cipher_sender
     or new.sender_public_key is distinct from old.sender_public_key
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
