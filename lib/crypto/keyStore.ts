import { isTauri } from "../tauri/windows"
import { keychainAvailable, keychainDelete, keychainGet, keychainSet } from "../tauri/keyStore"

/**
 * Where my private key lives (ADR 0010, E1.2, E1.3).
 * - "keychain": the desktop app's OS keychain. The only place a real key is kept.
 * - "browser-dev": localStorage in a plain browser, for development only. The
 *   app must not claim encryption there.
 * - "unavailable": the desktop app found no usable keychain. There is no
 *   fallback; encryption stays off and the user is told why.
 */
export type KeyStoreKind = "keychain" | "browser-dev"

export interface KeyStore {
  kind: KeyStoreKind
  get(account: string): Promise<string | null>
  set(account: string, key: string): Promise<void>
  remove(account: string): Promise<void>
}

export type OpenedKeyStore = { kind: "unavailable" } | KeyStore

export function browserKeyStore(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">): KeyStore {
  const name = (account: string) => `buzz:dev-private-key:${account}`
  return {
    kind: "browser-dev",
    get: async (account) => storage.getItem(name(account)),
    set: async (account, key) => storage.setItem(name(account), key),
    remove: async (account) => storage.removeItem(name(account)),
  }
}

export const keychainKeyStore: KeyStore = {
  kind: "keychain",
  get: keychainGet,
  set: keychainSet,
  remove: keychainDelete,
}

/** The choice rule, apart from the browser so it can be tested. */
export async function chooseKeyStore(env: {
  desktop: boolean
  keychainAvailable: () => Promise<boolean>
  keychain: KeyStore
  browser: KeyStore
}): Promise<OpenedKeyStore> {
  if (!env.desktop) return env.browser
  // In the desktop app a missing keychain never falls back to localStorage.
  return (await env.keychainAvailable()) ? env.keychain : { kind: "unavailable" }
}

export function openKeyStore(): Promise<OpenedKeyStore> {
  return chooseKeyStore({
    desktop: isTauri(),
    keychainAvailable,
    keychain: keychainKeyStore,
    browser: browserKeyStore(localStorage),
  })
}
