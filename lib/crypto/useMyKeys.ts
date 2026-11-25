"use client"

import { useEffect, useState } from "react"
import type { KeyPair } from "./box"
import { ensureMyKeyPair, loadMyKeyPair } from "./identity"
import { fetchPublicKey, publishPublicKey } from "./keys"
import { openKeyStore } from "./keyStore"

export type MyKeys =
  | { status: "loading" }
  /** Desktop app with no usable keychain: encryption stays off. */
  | { status: "unavailable" }
  /** A chat window found no key yet (the Buddy List window makes it). */
  | { status: "none" }
  | { status: "error" }
  | {
      status: "ready"
      keys: KeyPair
      /** True only for the desktop keychain. A browser development key is never called encryption. */
      secure: boolean
      /** This device started with a new key. Older messages cannot be read here. */
      startedFresh: boolean
    }

/** A chat window looks for the key every 1.5 s for up to a minute. */
const READER_RETRY_MS = 1500
const READER_RETRIES = 40

/**
 * `owner` is the Buddy List window: it makes and publishes the key. Chat
 * windows are `reader`s so two windows never make two different keys.
 */
export function useMyKeys(me: string, role: "owner" | "reader"): MyKeys {
  const [state, setState] = useState<MyKeys>({ status: "loading" })

  useEffect(() => {
    let active = true
    const set = (s: MyKeys) => {
      if (active) setState(s)
    }
    ;(async () => {
      const store = await openKeyStore()
      if (store.kind === "unavailable") return set({ status: "unavailable" })
      const secure = store.kind === "keychain"
      if (role === "reader") {
        // The Buddy List window makes the key. On a first sign-in a chat can open
        // before that is done, so keep looking for a while instead of giving up.
        for (let tries = 0; active; tries++) {
          const keys = await loadMyKeyPair(me, store)
          if (keys) return set({ status: "ready", keys, secure, startedFresh: false })
          set({ status: "none" })
          if (tries >= READER_RETRIES) return
          await new Promise((resolve) => setTimeout(resolve, READER_RETRY_MS))
        }
        return
      }
      const r = await ensureMyKeyPair(me, store, { fetchPublished: fetchPublicKey, publish: publishPublicKey })
      set(r.ok ? { status: "ready", keys: r.keys, secure, startedFresh: r.created && r.replacedOther } : { status: "error" })
    })().catch(() => set({ status: "error" }))
    return () => {
      active = false
    }
  }, [me, role])

  return state
}
