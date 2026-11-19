-- Buzz: the Buddy List subscribes to postgres_changes on friendships so
-- incoming requests, accepts, and removals appear live (lib/friends/api.ts
-- useFriends). Realtime only streams tables in the supabase_realtime
-- publication; friendships was missing. Rows still go through its RLS, so
-- each user only receives changes to their own friendships.
alter publication supabase_realtime add table public.friendships;
