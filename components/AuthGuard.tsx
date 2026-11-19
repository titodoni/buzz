"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { signOut, useSession } from "@/lib/auth/session"

/** Ends the session and returns to the sign-in page (Req 1.5, 1.6). */
export function useSignOut(): () => Promise<void> {
  const router = useRouter()
  return useCallback(async () => {
    await signOut()
    router.replace("/login/")
  }, [router])
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading && !session) router.replace("/login/")
  }, [loading, session, router])

  if (loading || !session) {
    return (
      <p role="status" className="p-4 text-sm">
        Signing in...
      </p>
    )
  }
  return <>{children}</>
}

export default AuthGuard
