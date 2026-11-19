"use client"

import { AuthGuard } from "@/components/AuthGuard"
import { BuddyList } from "@/components/BuddyList"
import { StartupGate } from "@/components/StartupGate"

export default function BuddyListPage() {
  return (
    <StartupGate>
      <AuthGuard>
        <BuddyList />
      </AuthGuard>
    </StartupGate>
  )
}
