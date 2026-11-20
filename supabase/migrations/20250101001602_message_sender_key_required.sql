-- Buzz: an encrypted row must carry a sender key. In 20250101001601 the regex
-- test alone let NULL through, because a CHECK passes when its result is NULL.
-- Messages tests: "encrypted without sender key" must be rejected.

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
    and sender_public_key is not null
    and sender_public_key ~ '^[A-Za-z0-9_-]{43}$'
  )
);
