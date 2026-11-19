"use client"

import { AuthGuard } from "@/components/AuthGuard"
import { ProfileEditor } from "@/components/profile/ProfileEditor"

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileEditor />
    </AuthGuard>
  )
}
