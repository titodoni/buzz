"use client"

import { AuthGuard } from "@/components/AuthGuard"
import { PreferencesWindow } from "@/components/PreferencesWindow"
import { useSession } from "@/lib/auth/session"

function PreferencesContent() {
  const { user } = useSession()
  if (!user) return null
  return <PreferencesWindow me={user.id} />
}

export default function PreferencesPage() {
  return (
    <AuthGuard>
      <PreferencesContent />
    </AuthGuard>
  )
}
