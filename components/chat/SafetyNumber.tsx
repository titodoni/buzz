"use client"

import { useEffect, useState } from "react"
import { fetchPublicKey } from "@/lib/crypto/keys"
import { safetyNumber } from "@/lib/crypto/safetyNumber"

/**
 * The Safety Number for me and one friend: 30 digits both of us see
 * (ADR 0010, E3.2). Read from the server now, so it shows the key that
 * the next message would use.
 */
export function SafetyNumber({ myPublicKey, friendId, friendName }: { myPublicKey: string; friendId: string; friendName: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "none" } | { status: "error" } | { status: "ready"; number: string }>({
    status: "loading",
  })

  useEffect(() => {
    let active = true
    fetchPublicKey(friendId)
      .then(async (key) => {
        if (!active) return
        setState(key ? { status: "ready", number: await safetyNumber(myPublicKey, key) } : { status: "none" })
      })
      .catch(() => active && setState({ status: "error" }))
    return () => {
      active = false
    }
  }, [myPublicKey, friendId])

  return (
    <div className="mt-2 text-xs" aria-label="Safety Number">
      <p className="m-0 font-bold">Safety Number</p>
      {state.status === "ready" ? (
        <>
          <p className="m-0 font-mono" style={{ letterSpacing: 1 }}>
            {state.number}
          </p>
          <p className="m-0">
            Read this to {friendName} in person or on a call. If their number is different, don&apos;t trust the chat.
          </p>
        </>
      ) : state.status === "loading" ? (
        <p className="m-0">Loading...</p>
      ) : state.status === "none" ? (
        <p className="m-0">{friendName} hasn&apos;t set up encryption yet.</p>
      ) : (
        <p className="m-0">Couldn&apos;t load it. Try again.</p>
      )}
    </div>
  )
}
