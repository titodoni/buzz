import type { RealtimeChannel, RealtimeChannelOptions } from "@supabase/supabase-js";
import { getSupabase } from "../supabase/browser-client";

// supabase-js hands back the SAME channel object for a topic until that
// channel has been fully removed. React runs effects twice in development
// (mount, unmount, mount) and reconnects re-enter the same code, so the
// second `client.channel(topic)` can return a channel that is still joined
// and waiting to be removed. Adding a presence or postgres_changes listener
// to it throws "cannot add `presence` callbacks ... after `subscribe()`".
//
// So every channel in the app is opened with `openChannel` and closed with
// `closeChannel`: opening waits for any removal of the same topic to finish.

const removals = new Map<string, Promise<void>>();

/**
 * Returns a fresh channel for `name`, after any earlier removal of that name
 * has completed. Resolves to null if `isCancelled()` turns true while waiting
 * (the caller was cleaned up), so no stray channel is created.
 */
export async function openChannel(
  name: string,
  options?: RealtimeChannelOptions,
  isCancelled: () => boolean = () => false,
): Promise<RealtimeChannel | null> {
  // Yield once before doing anything. React's dev double-mount runs
  // effect, cleanup, effect in one synchronous pass; without this yield the
  // first effect would create the channel before its cleanup could cancel it,
  // and the second effect would be handed that same channel (already
  // subscribing). After the yield the cancelled first effect gets null and
  // only the second one creates the channel.
  await Promise.resolve();
  let pending = removals.get(name);
  while (pending) {
    await pending;
    pending = removals.get(name);
  }
  if (isCancelled()) return null;
  return getSupabase().channel(name, options);
}

/** Removes `channel` and records the removal so `openChannel` can wait for it. */
export function closeChannel(name: string, channel: RealtimeChannel): Promise<void> {
  const removal: Promise<void> = getSupabase()
    .removeChannel(channel)
    .then(
      () => undefined,
      () => undefined, // a failed removal must not block reopening the topic
    )
    .then(() => {
      if (removals.get(name) === removal) removals.delete(name);
    });
  removals.set(name, removal);
  return removal;
}
