"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { SignInForm } from "@/components/auth/SignInForm"
import { useSession } from "@/lib/auth/session"

export default function SignInPage() {
  const router = useRouter()
  const { session, loading } = useSession()

  useEffect(() => {
    if (session) router.replace("/")
  }, [session, router])

  if (loading || session) {
    return (
      <p role="status" className="p-4 text-sm">
        Loading...
      </p>
    )
  }
  return <SignInForm />
}
