"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSignOut } from "@/components/AuthGuard"
import { WindowFrame } from "@/components/WindowFrame"
import { StatusSelector } from "@/components/StatusSelector"
import { FriendList } from "@/components/friends/FriendList"
import { FriendSearch } from "@/components/friends/FriendSearch"
import { MenuBar, type MenuDef } from "@/components/friends/MenuBar"
import { PendingRequests } from "@/components/friends/PendingRequests"
import { getProfile, useFriends, type PublicProfile } from "@/lib/friends/api"
import { useSession } from "@/lib/auth/session"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import { useOfflineDelivery } from "@/lib/offline/useOfflineDelivery"
import { useNudgeInbox } from "@/lib/realtime/inbox"
import { usePresenceTracker } from "@/lib/realtime/presence"
import { openChatWindow } from "@/lib/tauri/windows"

type Panel = "search" | "pick" | "about" | null

export function BuddyList() {
  const { user } = useSession()
  const signOut = useSignOut()
  if (!user) return null
  return <BuddyListInner me={user.id} onSignOut={signOut} />
}

function BuddyListInner({ me, onSignOut }: { me: string; onSignOut: () => Promise<void> }) {
  const { friends, incoming, outgoing, loading, error, reload } = useFriends(me)
  const [mine, setMine] = useState<PublicProfile | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [note, setNote] = useState<string | null>(null)
  const [statusMenu, setStatusMenu] = useState(false)
  const friendIds = useMemo(() => friends.map((f) => f.id), [friends])
  const { myState, setAvailable, setBusy, friendsPresence } = usePresenceTracker(me, friendIds)
  const { unreadBySender } = useOfflineDelivery(me)
  // A nudge from an accepted friend pops their chat window open and shakes it.
  useNudgeInbox(me, (sender) => {
    if (friendIds.includes(sender)) void openChatWindow(sender, { buzz: true })
  })
  const totalUnread = Object.values(unreadBySender).reduce((a, b) => a + b, 0)

  useEffect(() => {
    let active = true
    getProfile(me)
      .then((p) => {
        if (active) setMine(p)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [me])

  const menus: MenuDef[] = [
    {
      label: "Messenger",
      items: [
        { label: "My Status", onSelect: () => setStatusMenu(true) },
        { label: "Preferences", onSelect: () => setNote("Preferences are coming soon.") },
        { label: "Sign Out", onSelect: () => void onSignOut() },
      ],
    },
    { label: "Contacts", items: [{ label: "Add a Contact", onSelect: () => setPanel("search") }] },
    { label: "Actions", items: [{ label: "Send an Instant Message", onSelect: () => setPanel("pick") }] },
    { label: "Help", items: [{ label: "About Buzz", onSelect: () => setPanel("about") }] },
  ]

  return (
    <WindowFrame title="Buzz" menuBar={<MenuBar menus={menus} />}>
      <header className="flex items-start gap-2 border-b px-2 py-2">
        <StatusSelector
          me={me}
          state={myState}
          profile={mine}
          onAvailable={setAvailable}
          onBusy={setBusy}
          onStatusSaved={(status) => setMine((m) => (m ? { ...m, statusMessage: status } : m))}
          menuOpen={statusMenu}
          onMenuOpenChange={setStatusMenu}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{mine?.displayName ?? "Me"}</div>
          {shouldShowField(mine?.statusMessage) ? (
            <div className="truncate text-xs">{mine?.statusMessage}</div>
          ) : null}
          {hasNowPlaying(mine?.nowPlaying) ? (
            <div className="truncate text-xs">
              <span aria-hidden="true">♪ </span>
              {mine?.nowPlaying}
            </div>
          ) : null}
          <Link href="/profile/" className="text-xs underline">
            Edit profile
          </Link>
        </div>
      </header>

      {note ? (
        <p role="status" className="m-0 px-2 py-1 text-xs">
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="px-2 text-xs">
          {error}
        </p>
      ) : null}
      {loading ? <p className="px-2 text-xs">Loading your buddies...</p> : null}

      {totalUnread > 0 ? (
        <p role="status" className="m-0 px-2 py-1 text-xs font-bold">
          You have {totalUnread} offline {totalUnread === 1 ? "message" : "messages"}
        </p>
      ) : null}
      <FriendList
        friends={friends}
        presence={friendsPresence}
        unreadBySender={unreadBySender}
        onChanged={reload}
      />
      <PendingRequests incoming={incoming} outgoing={outgoing} onChanged={reload} />

      {panel === "pick" ? (
        <section aria-label="Send an Instant Message" className="border-t px-2 py-1">
          <h2 className="m-0 text-xs font-bold">Who do you want to talk to?</h2>
          {friends.length === 0 ? <p className="text-xs">Add a friend first!</p> : null}
          <ul className="m-0 list-none p-0">
            {friends.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="ym-row w-full cursor-pointer border-0 bg-transparent px-1 py-1 text-left"
                  onClick={() => {
                    void openChatWindow(f.id)
                    setPanel(null)
                  }}
                >
                  {f.displayName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {panel === "about" ? (
        <section aria-label="About Buzz" className="border-t px-2 py-1 text-xs">
          <p className="m-0 font-bold">Buzz</p>
          <p className="m-0">Chat with your friends and see who&apos;s around. Give them a nudge!</p>
          <button type="button" className="ym-button mt-1" onClick={() => setPanel(null)}>
            Close
          </button>
        </section>
      ) : null}

      <footer className="border-t">
        <button
          type="button"
          className="ym-row w-full cursor-pointer border-0 bg-transparent px-2 py-1 text-left"
          aria-expanded={panel === "search"}
          onClick={() => setPanel(panel === "search" ? null : "search")}
        >
          + Add a friend
        </button>
        {panel === "search" ? <FriendSearch me={me} onSent={reload} /> : null}
      </footer>
    </WindowFrame>
  )
}

export default BuddyList
