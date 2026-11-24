"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { unignoreUser, useIgnoreList, useIgnorers } from "@/lib/friends/ignore"
import { hideIgnorers } from "@/lib/realtime/hideIgnorers"
import { useBuddyAlerts } from "@/lib/alerts/useBuddyAlerts"
import { useBuddyView } from "@/lib/friends/useBuddyView"
import { isValidEmail } from "@/lib/validation/profile"
import { useSession } from "@/lib/auth/session"
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render"
import { useOfflineDelivery } from "@/lib/offline/useOfflineDelivery"
import { useNudgeInbox } from "@/lib/realtime/inbox"
import { useAutoNowPlaying, useShareNowPlaying } from "@/lib/nowPlaying/useAutoNowPlaying"
import { usePresenceTracker } from "@/lib/realtime/presence"
import { useUpForChat } from "@/lib/status/useUpForChat"
import { useMyKeys } from "@/lib/crypto/useMyKeys"
import { openChatWindow } from "@/lib/tauri/windows"
import { HangoutBanner } from "@/components/hangout/HangoutBanner"
import { incomingPending } from "@/lib/hangout/state"
import { useHangouts } from "@/lib/hangout/useHangouts"

type Panel = "search" | "pick" | "about" | "newGroup" | "ignore" | null

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
  const { ignored, ignoredIds, reload: reloadIgnore } = useIgnoreList(me)
  const ignorers = useIgnorers(me)
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
  const [firstStartThisRun] = useState(() => !hasPresenceStarted())
  useEffect(() => {
    markPresenceStarted()
  }, [])
  const { myState, setAvailable, setBusy, setInvisible, friendsPresence, goOffline } = usePresenceTracker(
    me,
    friendIds,
    { startInvisible },
  )
  // People who ignore me appear Offline (Req 15.5, docs/adr/0009).
  const visiblePresence = useMemo(() => hideIgnorers(friendsPresence, ignorers), [friendsPresence, ignorers])
  const friendNames = useMemo(() => new Map(friends.map((f) => [f.id, f.displayName])), [friends])
  const alerts = useBuddyAlerts({
    friendNames,
    presence: visiblePresence,
    myState,
    firstStartThisRun,
    setAvailable,
    setBusy,
    setInvisible,
    goOffline,
  })
  const { unreadBySender } = useOfflineDelivery(me, { onMessage: alerts.onMessage })
  // A nudge from an accepted friend pops their chat window open and shakes it.
  useNudgeInbox(me, (sender) => {
    // Nudges from someone I ignore are dropped (Req 15.3); the server blocks them too.
    if (friendIds.includes(sender) && !ignoredIds.has(sender)) void openChatWindow(sender, { nudge: true })
  })
  // A friend's Hangout shows as a banner at the top of the list (buzz-trigger R3.2).
  const hangouts = useHangouts(me, `hangouts:buddy:${me}`)
  const hangoutBanners = incomingPending(hangouts.rows, me, hangouts.now).filter((h) => friendIds.includes(h.sender_id))
  const totalUnread = Object.values(unreadBySender).reduce((a, b) => a + b, 0)
  // What the computer is playing goes into Now Playing, only if the user turns it on (buzz-trigger R7).
  const share = useShareNowPlaying()
  const onNowPlayingWritten = useCallback(
    (line: string | null) => setMine((m) => (m ? { ...m, nowPlaying: line } : m)),
    [],
  )
  useAutoNowPlaying({
    me,
    profileLine: mine ? mine.nowPlaying : undefined,
    enabled: share.enabled,
    onWritten: onNowPlayingWritten,
  })

  const onStatusSaved = useCallback(
    (status: string | null) => setMine((m) => (m ? { ...m, statusMessage: status } : m)),
    [],
  )
  // This window makes and publishes my encryption key; chat windows only read it (buzz-encryption E1).
  const myKeys = useMyKeys(me, "owner")
  const keyNote =
    myKeys.status === "unavailable"
      ? "Encryption is off: this computer has no keychain to keep your key in."
      : myKeys.status === "error"
        ? "Couldn't set up encryption. Check your connection and restart Buzz."
        : myKeys.status === "ready" && myKeys.startedFresh
          ? "This device started with a new encryption key. Older messages can't be read here."
          : null
  const upForChat = useUpForChat({ me, profile: mine, myState, setAvailable, onStatusSaved })

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
        ...(share.supported
          ? [
              {
                label: "Share What I'm Playing",
                checked: share.enabled,
                onSelect: () => {
                  share.setEnabled(!share.enabled)
                  setNote(
                    share.enabled
                      ? "Buzz stopped sharing what you're playing."
                      : "Friends now see what you're playing. Only the artist and title are shared.",
                  )
                },
              },
            ]
          : []),
        { label: "Preferences", onSelect: () => setNote("Preferences are coming soon.") },
        { label: "Sign Out", onSelect: () => void onSignOut() },
      ],
    },
    {
      label: "Contacts",
      items: [
        { label: "Add a Contact", onSelect: () => openAddFriend("") },
        { label: "New Group...", onSelect: () => openNewGroup() },
        { label: "Ignore List...", onSelect: () => setPanel("ignore") },
        {
          label: "Show Offline Contacts",
          checked: view.showOffline,
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
          onStatusSaved={onStatusSaved}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ym-button"
              style={{ minHeight: 28 }}
              aria-pressed={upForChat.on}
              disabled={!mine || upForChat.busy}
              onClick={upForChat.toggle}
            >
              {upForChat.on ? "Up for Chat: on" : "Up for Chat"}
            </button>
            <Link href="/profile/" className="text-xs underline">
              Edit profile
            </Link>
          </div>
          {upForChat.error ? (
            <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
              {upForChat.error}
            </p>
          ) : null}
        </div>
      </header>

      {hangoutBanners.map((h) => (
        <HangoutBanner
          key={h.id}
          id={h.id}
          fromName={friendNames.get(h.sender_id) ?? "A friend"}
          text={h.text}
          onAnswered={(answer) => {
            // Accepting opens the Chat Window, where both sides read "[Name] accepted: ..." (R3.3).
            if (answer === "accepted") void openChatWindow(h.sender_id)
          }}
        />
      ))}

      {note ? (
        <p role="status" className="m-0 px-2 py-1 text-xs">
          {note}
        </p>
      ) : null}
      {keyNote ? (
        <p role="status" className="m-0 px-2 py-1 text-xs">
          {keyNote}
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
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1" role="toolbar" aria-label="Buddy List tools">
        <button
          type="button"
          className="ym-button shrink-0 px-2"
          style={{ minHeight: 28 }}
          aria-expanded={panel === "search"}
          onClick={() => (panel === "search" ? setPanel(null) : openAddFriend(""))}
        >
          + Add a Friend
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
          style={{ minHeight: 28, minWidth: 96 }}
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
        presence={visiblePresence}
        unreadBySender={unreadBySender}
        ignoredIds={ignoredIds}
        onIgnoreChanged={reloadIgnore}
        keys={myKeys.status === "ready" ? myKeys.keys : myKeys.status === "unavailable" ? "unavailable" : null}
        view={view}
        search={search}
        onToggleGroup={toggleGroup}
        onChanged={reload}
        onGroupsChanged={reloadGroups}
      />
      {/* A request someone sent before I ignored them stays hidden (Req 15.4). */}
      <PendingRequests
        incoming={incoming.filter((r) => !ignoredIds.has(r.id))}
        outgoing={outgoing}
        onChanged={reload}
      />

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
      {/* Browser fallback for the desktop toast (Req 16.4, 16.5). */}
      {alerts.toasts.length > 0 ? (
        <div className="fixed right-2 bottom-2 z-50 flex flex-col gap-1" aria-live="polite">
          {alerts.toasts.map((t) => (
            <button
              key={t.key}
              type="button"
              className="ym-window ym-row flex items-center gap-2 px-3 py-2 text-left text-sm shadow"
              onClick={() => {
                alerts.dismissToast(t.key)
                void openChatWindow(t.friendId)
              }}
            >
              <PresenceDot state="online" size={16} decorative />
              {t.text}
            </button>
          ))}
        </div>
      ) : null}
      {panel === "ignore" ? (
        <section
          aria-label="Ignore List"
          className="border-t px-2 py-1"
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(null)
          }}
        >
          <h2 className="m-0 text-xs font-bold">Ignore List</h2>
          <p className="m-0 text-xs">People here can&apos;t message you, Buzz you, or send you friend requests.</p>
          {ignored.length === 0 ? <p className="m-0 mt-1 text-xs">You&apos;re not ignoring anyone.</p> : null}
          <ul className="m-0 mt-1 list-none p-0">
            {ignored.map((p) => (
              <li key={p.id} className="ym-row flex items-center gap-1 px-1 py-1">
                <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                <button
                  type="button"
                  className="ym-button"
                  onClick={async () => {
                    const res = await unignoreUser(me, p.id)
                    setNote(res.ok ? `You're no longer ignoring ${p.displayName}.` : res.message)
                    reloadIgnore()
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="ym-button mt-1" autoFocus onClick={() => setPanel(null)}>
            Close
          </button>
        </section>
      ) : null}


    </WindowFrame>
  )
}

export default BuddyList
