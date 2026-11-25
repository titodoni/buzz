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

/** A chat window looks quickly at first (250 ms), then every 1 s up to ~60 s. */
const READER_FAST_MS = 250
const READER_FAST_TRIES = 20
const READER_SLOW_MS = 1000
const READER_MAX_WAIT_TRIES = 75
const OWNER_RETRY_DELAYS_MS = [1000, 2500] as const

export const keyReadyStorageKey = (me: string) => `buzz:key-ready:${me}`

function notifyKeyReady(me: string): void {
  try {
    window.localStorage.setItem(keyReadyStorageKey(me), String(Date.now()))
  } catch {
    // Storage unavailable: the reader's own poll still picks up the key.
  }
}

/**
 * `owner` is the Buddy List window: it makes and publishes the key. Chat
 * windows are `reader`s so two windows never make two different keys.
 */
export function useMyKeys(me: string, role: "owner" | "reader"): MyKeys {
  const [state, setState] = useState<MyKeys>({ status: "loading" })

  useEffect(() => {
    let active = true
    let wakeReader: (() => void) | null = null
    const set = (s: MyKeys) => {
      if (active) setState(s)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyReadyStorageKey(me) || e.key === null) wakeReader?.()
    }
    if (role === "reader") window.addEventListener("storage", onStorage)

    ;(async () => {
      const store = await openKeyStore()
      if (!active) return
      if (store.kind === "unavailable") return set({ status: "unavailable" })
      const secure = store.kind === "keychain"
      if (role === "reader") {
        // The Buddy List window makes the key. On a first sign-in a chat can open
        // before that is done, so listen for the storage wakeup and keep polling.
        for (let tries = 0; active; tries++) {
          const keys = await loadMyKeyPair(me, store)
          if (!active) return
          if (keys) return set({ status: "ready", keys, secure, startedFresh: false })
          set({ status: "none" })
          if (tries >= READER_MAX_WAIT_TRIES) return
          const delay = tries < READER_FAST_TRIES ? READER_FAST_MS : READER_SLOW_MS
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              wakeReader = null
              resolve()
            }, delay)
            wakeReader = () => {
              window.clearTimeout(timer)
              wakeReader = null
              resolve()
            }
          })
        }
        return
      }
      for (let attempt = 0; active; attempt++) {
        try {
          const r = await ensureMyKeyPair(me, store, { fetchPublished: fetchPublicKey, publish: publishPublicKey })
          if (!active) return
          if (r.ok) {
            notifyKeyReady(me)
            return set({ status: "ready", keys: r.keys, secure, startedFresh: r.created && r.replacedOther })
          }
        } catch {
          // Transient network or keychain hiccup right after sign-in: retry before failing.
        }
        if (attempt >= OWNER_RETRY_DELAYS_MS.length) return set({ status: "error" })
        await new Promise((resolve) => window.setTimeout(resolve, OWNER_RETRY_DELAYS_MS[attempt]))
      }
    })().catch(() => set({ status: "error" }))
    return () => {
      active = false
      wakeReader = null
      if (role === "reader") window.removeEventListener("storage", onStorage)
    }
  }, [me, role])

  return state
}
