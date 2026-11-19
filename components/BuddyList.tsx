"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSignOut } from "@/components/AuthGuard"
import { WindowFrame } from "@/components/WindowFrame"
import { AboutDialog } from "@/components/AboutDialog"
import { PresenceDot } from "@/components/PresenceDot"
import { hasPresenceStarted, loadSignInOptions, markPresenceStarted } from "@/components/auth/remember"
import { shouldStartInvisible } from "@/lib/auth/options"
import { StatusSelector } from "@/components/StatusSelector"
import { FriendList } from "@/components/friends/FriendList"
import { FriendSearch } from "@/components/friends/FriendSearch"
import { MenuBar, type MenuDef } from "@/components/friends/MenuBar"
import { PendingRequests } from "@/components/friends/PendingRequests"
import { getProfile, useFriends, type PublicProfile } from "@/lib/friends/api"
import { createGroup, useGroups } from "@/lib/friends/groups"
import { useBuddyView } from "@/lib/friends/useBuddyView"
import { isValidEmail } from "@/lib/validation/profile"
import { useSession } from "@/lib/auth/session"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import { useOfflineDelivery } from "@/lib/offline/useOfflineDelivery"
import { useNudgeInbox } from "@/lib/realtime/inbox"
import { usePresenceTracker } from "@/lib/realtime/presence"
import { openChatWindow } from "@/lib/tauri/windows"

type Panel = "search" | "pick" | "about" | "newGroup" | null

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
  const { groups, memberships, reload: reloadGroups } = useGroups(me)
  const { view, toggleGroup, setShowOffline } = useBuddyView()
  const [search, setSearch] = useState("")
  const [addQuery, setAddQuery] = useState("")
  const [groupName, setGroupName] = useState("")
  const [groupError, setGroupError] = useState<string | null>(null)
  const friendIds = useMemo(() => friends.map((f) => f.id), [friends])
  // "Sign in as invisible to everyone" applies once per run (Req 13.4); after a
  // reload the user's own last choice wins. Marked in an effect, not here,
  // because React may call this initializer twice in development.
  const [startInvisible] = useState(() =>
    shouldStartInvisible({
      signInInvisible: loadSignInOptions().signInInvisible,
      presenceStartedThisRun: hasPresenceStarted(),
    }),
  )
  useEffect(() => {
    markPresenceStarted()
  }, [])
  const { myState, setAvailable, setBusy, setInvisible, friendsPresence } = usePresenceTracker(me, friendIds, {
    startInvisible,
  })
  const { unreadBySender } = useOfflineDelivery(me)
  // A nudge from an accepted friend pops their chat window open and shakes it.
  useNudgeInbox(me, (sender) => {
    if (friendIds.includes(sender)) void openChatWindow(sender, { nudge: true })
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

  function openAddFriend(query: string) {
    setAddQuery(query)
    setPanel("search")
  }
  function openNewGroup() {
    setGroupName("")
    setGroupError(null)
    setPanel("newGroup")
  }
  async function saveGroup() {
    const res = await createGroup(me, groupName, groups)
    if (!res.ok) return setGroupError(res.message)
    setPanel(null)
    reloadGroups()
  }
  const menus: MenuDef[] = [
    {
      label: "Messenger",
      items: [
        { label: "My Status", onSelect: () => setStatusMenu(true) },
        { label: "Preferences", onSelect: () => setNote("Preferences are coming soon.") },
        { label: "Sign Out", onSelect: () => void onSignOut() },
      ],
    },
    {
      label: "Contacts",
      items: [
        { label: "Add a Contact", onSelect: () => openAddFriend("") },
        { label: "New Group...", onSelect: () => openNewGroup() },
        {
          // A tick shows the current setting (Req 14.8).
          label: `${view.showOffline ? "✓ " : ""}Show Offline Contacts`,
          onSelect: () => setShowOffline(!view.showOffline),
        },
      ],
    },
    { label: "Actions", items: [{ label: "Send an Instant Message", onSelect: () => setPanel("pick") }] },
    { label: "Help", items: [{ label: "About Buzz", onSelect: () => setPanel("about") }] },
  ]

  return (
    <WindowFrame title="Buzz" icon={<PresenceDot state={myState} size={14} />} menuBar={<MenuBar menus={menus} />}>
      <header className="flex items-start gap-2 border-b px-2 py-2">
        <StatusSelector
          me={me}
          state={myState}
          profile={mine}
          onAvailable={setAvailable}
          onBusy={setBusy}
          onInvisible={setInvisible}
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
      <div className="flex items-center gap-1 border-b px-2 py-1" role="toolbar" aria-label="Buddy List tools">
        <button
          type="button"
          className="ym-button shrink-0 px-2"
          aria-expanded={panel === "search"}
          title="Add a Friend"
          onClick={() => (panel === "search" ? setPanel(null) : openAddFriend(""))}
        >
          + Add
        </button>
        <input
          type="search"
          aria-label="Find a friend in your list, or type an email and press Enter to add someone"
          placeholder="Find a friend"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && isValidEmail(search.trim())) {
              e.preventDefault()
              openAddFriend(search.trim())
              setSearch("")
            } else if (e.key === "Escape") {
              setSearch("")
            }
          }}
          className="min-w-0 flex-1"
        />
      </div>
      {panel === "search" ? (
        <FriendSearch key={addQuery} me={me} initialQuery={addQuery} onSent={reload} />
      ) : null}
      {panel === "newGroup" ? (
        <form
          aria-label="New group"
          className="border-b p-2"
          onSubmit={(e) => {
            e.preventDefault()
            void saveGroup()
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(null)
          }}
        >
          <label className="block text-xs font-bold">
            Group name
            <input
              type="text"
              autoFocus
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value)
                setGroupError(null)
              }}
              className="mt-1 block w-full font-normal"
            />
          </label>
          {groupError ? (
            <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
              {groupError}
            </p>
          ) : null}
          <div className="mt-1 flex gap-1">
            <button type="submit" className="ym-button">
              Create
            </button>
            <button type="button" className="ym-button" onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <FriendList
        me={me}
        friends={friends}
        groups={groups}
        memberships={memberships}
        presence={friendsPresence}
        unreadBySender={unreadBySender}
        view={view}
        search={search}
        onToggleGroup={toggleGroup}
        onChanged={reload}
        onGroupsChanged={reloadGroups}
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

      {panel === "about" ? <AboutDialog onClose={() => setPanel(null)} /> : null}


    </WindowFrame>
  )
}

export default BuddyList
