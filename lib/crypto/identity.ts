import { generateKeyPair, publicKeyOf, type KeyPair } from "./box"
import type { KeyStore } from "./keyStore"

/** What the setup does, given what this device holds and what the server shows. */
export type SetupPlan = "create" | "publish" | "ready"

export function planKeySetup(localPrivate: string | null, published: string | null, localPublic: string | null): SetupPlan {
  if (localPrivate === null) return "create"
  return published === localPublic ? "ready" : "publish"
}

export interface KeyApi {
  fetchPublished(me: string): Promise<string | null>
  publish(me: string, publicKey: string): Promise<boolean>
}

export type SetupResult =
  | {
      ok: true
      keys: KeyPair
      /** A new key was made on this device. */
      created: boolean
      /** The server held a different key (another device or an older install); it is now replaced. */
      replacedOther: boolean
    }
  | { ok: false; reason: "publish-failed" }

/**
 * Buddy List window only. Makes sure this device has a private key in the key
 * store and that the server shows its public key. The private key is saved
 * first, so a failure after that can never lose a key that was already shared.
 * One key per account: a device with no key starts fresh and replaces the published one.
 */
export async function ensureMyKeyPair(me: string, store: KeyStore, api: KeyApi): Promise<SetupResult> {
  const localPrivate = await store.get(me)
  const localPublic = localPrivate === null ? null : await publicKeyOf(localPrivate)
  // A failed read here throws; creating a key on a network error would lose history for nothing.
  const published = await api.fetchPublished(me)
  const plan = planKeySetup(localPrivate, published, localPublic)

  if (plan === "ready" && localPrivate !== null && localPublic !== null) {
    return { ok: true, keys: { privateKey: localPrivate, publicKey: localPublic }, created: false, replacedOther: false }
  }

  let keys: KeyPair
  if (plan === "create") {
    keys = await generateKeyPair()
    await store.set(me, keys.privateKey)
  } else if (localPrivate !== null && localPublic !== null) {
    keys = { privateKey: localPrivate, publicKey: localPublic }
  } else {
    throw new Error("unreachable")
  }
  if (!(await api.publish(me, keys.publicKey))) return { ok: false, reason: "publish-failed" }
  return { ok: true, keys, created: plan === "create", replacedOther: published !== null }
}

/** Chat windows only: reads my key if the Buddy List window has made one. Never creates. */
export async function loadMyKeyPair(me: string, store: KeyStore): Promise<KeyPair | null> {
  const privateKey = await store.get(me)
  if (privateKey === null) return null
  return { privateKey, publicKey: await publicKeyOf(privateKey) }
}
