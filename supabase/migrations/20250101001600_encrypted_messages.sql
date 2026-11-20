-- Buzz: Encrypted Messages, step 1 of 2 (buzz-encryption E2, ADR 0010).
-- Additive and safe for old app builds: plaintext messages still work.
-- An encrypted row holds two ciphertexts of { body, format }, one for the
-- receiver and one for the sender, and no readable body. The database cannot
-- read the text, so the 1000 character rule is the app's; here only the
-- stored size is limited. 6000 matches MAX_CIPHER_LENGTH in lib/crypto/payload.ts.

alter table public.messages
  add column encrypted boolean not null default false,
  add column cipher_receiver text,
  add column cipher_sender text;

alter table public.messages alter column body drop not null;

alter table public.messages add constraint messages_body_or_cipher check (
  (
    not encrypted
    and body is not null
    and cipher_receiver is null
    and cipher_sender is null
  )
  or (
    encrypted
    and body is null
    and format is null
    and cipher_receiver is not null
    and cipher_sender is not null
    and char_length(cipher_receiver) between 1 and 6000
    and char_length(cipher_sender) between 1 and 6000
  )
);

-- Receivers may still only set delivered_at / read_at. The ciphertexts and the
-- encrypted flag are the sender's and are final, like the body.
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
