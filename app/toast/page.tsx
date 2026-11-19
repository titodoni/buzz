"use client"
import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { PresenceDot } from "@/components/PresenceDot"
import { TOAST_MS } from "@/lib/alerts/useBuddyAlerts"
import { closeWindow, openChatWindow } from "@/lib/tauri/windows"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The "<name> is now online" desktop toast (Req 16.4, 16.5); its window is made by the Rust shell. */
function Toast() {
  const params = useSearchParams()
  const friendId = params.get("friendId") ?? ""
  const text = (params.get("text") ?? "").slice(0, 200)
  useEffect(() => {
    const t = setTimeout(() => void closeWindow(), TOAST_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void closeWindow()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [])
  return (
    <button
      type="button"
      className="ym-window block w-screen px-3 text-left text-sm"
      style={{ height: "100vh", cursor: "pointer", boxSizing: "border-box" }}
      onClick={async () => {
        if (UUID.test(friendId)) await openChatWindow(friendId).catch(() => undefined)
        await closeWindow()
      }}
    >
      {/* WebKitGTK ignores flex on <button> itself, so the row lives on an inner element. */}
      <span className="flex h-full items-center gap-2">
      <PresenceDot state="online" size={22} decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{text || "A friend is now online"}</span>
        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
          Click to say hi
        </span>
      </span>
      </span>
    </button>
  )
}

export default function ToastPage() {
  return (
    <Suspense>
      <Toast />
    </Suspense>
  )
}
