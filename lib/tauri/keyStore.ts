// Thin wrapper over src-tauri/src/key_store.rs (buzz-encryption E1.2).
// Only the Buddy List and chat windows have permission to call these.
import { isTauri } from "./windows"

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

/** True when this is the desktop app and its keychain can be used. */
export async function keychainAvailable(): Promise<boolean> {
  if (!isTauri()) return false
  return call<boolean>("key_store_available").catch(() => false)
}

export async function keychainGet(account: string): Promise<string | null> {
  const v = await call<unknown>("key_store_get", { account })
  return typeof v === "string" ? v : null
}

export async function keychainSet(account: string, key: string): Promise<void> {
  await call<void>("key_store_set", { account, key })
}

export async function keychainDelete(account: string): Promise<void> {
  await call<void>("key_store_delete", { account })
}
