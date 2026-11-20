-- Buzz: handle_new_user() is a trigger function. It must not be callable
-- through /rest/v1/rpc by anon or signed-in users (security advisor 0028, 0029).
-- The signup trigger still fires: trigger functions are not checked for
-- EXECUTE at fire time.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
