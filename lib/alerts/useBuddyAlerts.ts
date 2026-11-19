"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Availability, PresenceState } from "@/lib/presence/state"
import {
  chatWindowState,
  flashChatWindow,
  onShellEvent,
  openChatWindow,
  quitApp,
  setTrayStatus,
  showToast,
  SHELL_EVENTS,
} from "@/lib/tauri/windows"
import { friendOnlineAlerts, incomingMessagePlan } from "./plan"
import { playMessageSound, playOnlineSound, playSignInSound } from "./sounds"

/**
 * Right after start-up every friend "comes online" at once as presence
 * syncs; announcements start only after this long (Req 16.4).
 */
const SETTLE_MS = 8_000
/** How long an in-window toast stays (Rust closes the desktop toast after the same time). */
export const TOAST_MS = 5_000

// Sounds and Toasts are always on until Preferences (Section 28) adds the switches.
const SWITCHES = { allSounds: true, messageSound: true, onlineSound: true, onlineToast: true }

export interface InWindowToast {
  key: number
  friendId: string
  text: string
}

/**
 * Buddy List alerts (Req 16): the sign-in sound, "now online" toasts, what an
 * incoming message does to its chat window, the tray icon, and the tray
 * menu's status and Exit choices.
 */
export function useBuddyAlerts(input: {
  friendNames: ReadonlyMap<string, string>
  presence: Readonly<Record<string, PresenceState>>
  myState: Availability
  firstStartThisRun: boolean
  setAvailable: () => void
  setBusy: () => void
  setInvisible: () => void
  goOffline: () => Promise<void>
}): { onMessage: (senderId: string) => void; toasts: InWindowToast[]; dismissToast: (key: number) => void } {
  const latest = useRef(input)
  useEffect(() => {
    latest.current = input
  })
  const [toasts, setToasts] = useState<InWindowToast[]>([])
  const dismissToast = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), [])

  // Sign-in sound, once per run.
  useEffect(() => {
    if (input.firstStartThisRun) playSignInSound()
  }, [input.firstStartThisRun])

  // "<name> is now online" (Req 16.4, 16.5).
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(t)
  }, [])
  const prevPresence = useRef(input.presence)
  const nextKey = useRef(0)
  useEffect(() => {
    const alerts = friendOnlineAlerts(prevPresence.current, input.presence, { settled, ...SWITCHES })
    prevPresence.current = input.presence
    if (alerts.sound) playOnlineSound()
    for (const id of alerts.toastFor) {
      const text = `${latest.current.friendNames.get(id) ?? "A friend"} is now online`
      // A failed desktop toast falls back to one inside the Buddy List window.
      void showToast(id, text)
        .catch(() => false)
        .then((shown) => {
          if (shown) return
          const key = ++nextKey.current
          setToasts((t) => [...t, { key, friendId: id, text }])
          setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), TOAST_MS)
        })
    }
  }, [input.presence, settled])

  // Tray icon follows my Availability; "offline" once signed out (Req 16.6).
  useEffect(() => {
    void setTrayStatus(input.myState).catch(() => undefined)
  }, [input.myState])
  useEffect(() => () => void setTrayStatus("offline").catch(() => undefined), [])

  // Tray menu: status choices and Exit (Req 16.8).
  useEffect(() => {
    const stops: Array<() => void> = []
    let active = true
    void onShellEvent(SHELL_EVENTS.setStatus, (status) => {
      if (status === "online") latest.current.setAvailable()
      else if (status === "busy") latest.current.setBusy()
      else if (status === "invisible") latest.current.setInvisible()
    }).then((stop) => (active ? stops.push(stop) : stop()))
    void onShellEvent(SHELL_EVENTS.exitRequested, () => {
      // Go Offline first so friends see it at once, then quit (Rust quits anyway after a grace period).
      void latest.current
        .goOffline()
        .catch(() => undefined)
        .then(() => quitApp())
    }).then((stop) => (active ? stops.push(stop) : stop()))
    return () => {
      active = false
      for (const stop of stops) stop()
    }
  }, [])

  // A friend's message arrived (Req 16.1, 16.2).
  const onMessage = useCallback((senderId: string) => {
    void (async () => {
      const state = await chatWindowState(senderId).catch(() => null)
      // In a browser the chat window can't be seen; just play the sound.
      const plan = incomingMessagePlan(state ?? "unfocused", SWITCHES)
      if (plan.sound) playMessageSound()
      if (state === null) return
      if (plan.open) await openChatWindow(senderId, { focus: false }).catch(() => undefined)
      else if (plan.flash) await flashChatWindow(senderId).catch(() => undefined)
    })()
  }, [])

  return { onMessage, toasts, dismissToast }
}
