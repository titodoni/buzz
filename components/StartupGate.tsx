"use client"
import { useEffect, useState, type ReactNode } from "react"
import { hasRunStarted, loadSignInOptions, markRunStarted } from "@/components/auth/remember"
import { shouldDiscardSession } from "@/lib/auth/options"
import { discardLocalSession } from "@/lib/auth/session"

/**
 * Main window only (chat windows have their own fresh page session).
 * With "Sign in automatically" off, a session left from an earlier run is
 * dropped before anything renders, so the user signs in again (Req 13.3).
 */
export function StartupGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      const { autoSignIn } = loadSignInOptions()
      if (shouldDiscardSession({ autoSignIn, startedThisRun: hasRunStarted() })) await discardLocalSession()
      markRunStarted()
      if (active) setReady(true)
    })()
    return () => {
      active = false
    }
  }, [])
  if (!ready) {
    return (
      <p role="status" className="p-4 text-sm">
        Starting Buzz...
      </p>
    )
  }
  return <>{children}</>
}
