"use client"

import { AuthGuard } from "@/components/AuthGuard"
import { BuddyList } from "@/components/BuddyList"

export default function BuddyListPage() {
  return (
    <AuthGuard>
      <BuddyList />
    </AuthGuard>
  )
}
