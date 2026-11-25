"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSignOut } from "@/components/AuthGuard"
import { WindowFrame } from "@/components/WindowFrame"
import { AboutDialog } from "@/components/AboutDialog"
import { PresenceDot } from "@/components/PresenceDot"
import { hasPresenceStarted, loadSignInOptions, markPresenceStarted } from "@/components/auth/remember"
import { shouldStartInvisible } from "@/lib/auth/options"
import { StatusSelector } from "@/components/StatusSelector"
import { BuddyPicture } from "@/components/BuddyPicture"
import { AddFriendIcon, RecentBuzzesIcon, SendImIcon, ToolButton, UpForChatIcon } from "@/components/ToolButton"
import { IgnoreListPanel, NewGroupForm, PickFriendPanel, ToastStack } from "@/components/friends/BuddyPanels"
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
import { sharingNote } from "@/lib/nowPlaying/note"
import { useAutoNowPlaying, useShareNowPlaying } from "@/lib/nowPlaying/useAutoNowPlaying"
import { usePresenceTracker } from "@/lib/realtime/presence"
import { useUpForChat } from "@/lib/status/useUpForChat"
import { useMyKeys } from "@/lib/crypto/useMyKeys"
import { chatWindowState, openChatWindow, openPreferencesWindow } from "@/lib/tauri/windows"
import { readPrefs } from "@/lib/prefs/usePrefs"
import { RecentNudgesPanel } from "@/components/friends/RecentNudgesPanel"
import { addBadge, clearBadge, type NudgeBadges, type RecentNudge } from "@/lib/nudge/recent"
import { nudgeBackText, sendNudgeBack } from "@/lib/nudge/send"
import { loadRecentNudges, onChatSeen, saveReceivedNudge } from "@/lib/nudge/store"
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
  const router = useRouter()
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
  // Recent Buzzes, the row shake, and the red count (buzz-trigger R4.1 to R4.3).
  const [recentNudges, setRecentNudges] = useState<RecentNudge[]>(() => loadRecentNudges())
  const [nudgeBadges, setNudgeBadges] = useState<NudgeBadges>({})
  const [shakingIds, setShakingIds] = useState<ReadonlySet<string>>(new Set())
  const [nudgePanel, setNudgePanel] = useState(false)
  const [nudgeNote, setNudgeNote] = useState<string | null>(null)
  // When the panel was opened; the "3 min ago" texts are measured from here.
  const [nudgePanelAt, setNudgePanelAt] = useState(0)
  const shakeRow = useCallback((id: string) => {
    setShakingIds((cur) => new Set(cur).add(id))
    window.setTimeout(() => {
      setShakingIds((cur) => {
        const next = new Set(cur)
        next.delete(id)
        return next
      })
    }, 600)
  }, [])
  const clearNudgeBadge = useCallback((id: string) => setNudgeBadges((cur) => clearBadge(cur, id)), [])
  // A Chat Window that is open and in view clears its friend's red count.
  useEffect(() => onChatSeen(clearNudgeBadge), [clearNudgeBadge])
  // A nudge from an accepted friend pops their chat window open and shakes it.
  useNudgeInbox(me, (sender, receivedAt) => {
    // Nudges from someone I ignore are dropped (Req 15.3); the server blocks them too.
    if (!friendIds.includes(sender) || ignoredIds.has(sender)) return
    // "Allow Buzz!" off in Preferences drops every Buzz (Req 18.2).
    if (!readPrefs().buzz.allow) return
    setRecentNudges(saveReceivedNudge({ senderId: sender, receivedAt }))
    shakeRow(sender)
    void (async () => {
      try {
        await openChatWindow(sender, { nudge: true })
        // Give the window a moment to take focus. If it did not (or this
        // cannot be told), the row keeps a red count until that chat is seen.
        await new Promise((resolve) => window.setTimeout(resolve, 600))
        const state = await chatWindowState(sender).catch(() => null)
        if (state !== "focused") setNudgeBadges((cur) => addBadge(cur, sender))
      } catch {
        setNudgeBadges((cur) => addBadge(cur, sender))
      }
    })()
  })
  async function nudgeBack(friendId: string) {
    const name = friendNames.get(friendId) ?? "your friend"
    setNudgeNote(null)
    const result = await sendNudgeBack(me, friendId, visiblePresence[friendId] ?? "offline")
    setNudgeNote(nudgeBackText(result, name))
  }
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
        { label: "Edit Profile...", onSelect: () => router.push("/profile/") },
        ...(share.supported
          ? [
              {
                label: "Share What I'm Playing",
                checked: share.enabled,
                onSelect: () => {
                  share.setEnabled(!share.enabled)
                  setNote(sharingNote(!share.enabled, share.platform))
                },
              },
            ]
          : []),
        { label: "Preferences...", onSelect: () => void openPreferencesWindow().catch(() => setNote("Couldn't open Preferences. Try again.")) },
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

  const visibleIncoming = useMemo(
    () => incoming.filter((r) => !ignoredIds.has(r.id)),
    [incoming, ignoredIds],
  )

  return (
    <WindowFrame title="Buzz" icon={<PresenceDot state={myState} size={14} />} menuBar={<MenuBar menus={menus} />}>
      <div className="ym-buddy">
        <header className="ym-me">
        <Link href="/profile/" title="Edit my profile" aria-label="Edit my profile" className="shrink-0">
          <BuddyPicture name={mine?.displayName ?? "Me"} url={mine?.avatarUrl ?? null} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
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
            <span className="truncate font-bold">{mine?.displayName ?? "Me"}</span>
          </div>
          {shouldShowField(mine?.statusMessage) ? (
            <div className="ym-friend-sub truncate text-xs">{mine?.statusMessage}</div>
          ) : null}
          {hasNowPlaying(mine?.nowPlaying) ? (
            <div className="ym-friend-sub truncate text-xs">
              <span aria-hidden="true">♪ </span>
              {mine?.nowPlaying}
            </div>
          ) : null}
          {upForChat.error ? (
            <p role="alert" className="m-0 text-xs" style={{ color: "var(--buzz-red)" }}>
              {upForChat.error}
            </p>
          ) : null}
        </div>
      </header>
      <div className="ym-toolbar" role="toolbar" aria-label="Buddy List tools">
        <ToolButton
          label="Add"
          title="Add a Friend"
          icon={AddFriendIcon}
          expanded={panel === "search"}
          onClick={() => (panel === "search" ? setPanel(null) : openAddFriend(""))}
        />
        <ToolButton
          label="Message"
          title="Send an Instant Message"
          icon={SendImIcon}
          expanded={panel === "pick"}
          onClick={() => setPanel(panel === "pick" ? null : "pick")}
        />
        <ToolButton
          label="Up for Chat"
          title={upForChat.on ? "Up for Chat is on. Tap to turn it off." : "Tell friends you're up for chat"}
          icon={UpForChatIcon}
          pressed={upForChat.on}
          disabled={!mine || upForChat.busy}
          onClick={upForChat.toggle}
        />
        <ToolButton
          label="Buzzes"
          title="Recent Buzzes"
          icon={RecentBuzzesIcon}
          expanded={nudgePanel}
          onClick={() => {
            setNudgePanelAt(Date.now())
            setNudgePanel((v) => !v)
          }}
        />
      </div>

      {nudgePanel ? (
        <RecentNudgesPanel
          items={recentNudges}
          names={friendNames}
          presence={visiblePresence}
          now={nudgePanelAt}
          note={nudgeNote}
          onNudgeBack={(id) => void nudgeBack(id)}
          onClose={() => setNudgePanel(false)}
        />
      ) : null}

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
        <p role="status" className="ym-notice">
          You have {totalUnread} offline {totalUnread === 1 ? "message" : "messages"}
        </p>
      ) : null}
      <div className="border-b px-2 py-1">
        <input
          type="search"
          aria-label="Find a friend in your list, or type an email and press Enter to add someone"
          placeholder="Find a contact"
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
          className="ym-find"
        />
      </div>
      {panel === "search" ? (
        <FriendSearch
          key={addQuery}
          me={me}
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          ignoredIds={ignoredIds}
          initialQuery={addQuery}
          onSent={reload}
        />
      ) : null}
      {panel === "newGroup" ? (
        <NewGroupForm
          name={groupName}
          error={groupError}
          onNameChange={(name) => {
            setGroupName(name)
            setGroupError(null)
          }}
          onSubmit={() => void saveGroup()}
          onCancel={() => setPanel(null)}
        />
      ) : null}
      {panel === "pick" ? (
        <PickFriendPanel
          friends={friends}
          onPick={(id) => {
            void openChatWindow(id)
            setPanel(null)
          }}
        />
      ) : null}
      {panel === "ignore" ? (
        <IgnoreListPanel
          ignored={ignored}
          onClose={() => setPanel(null)}
          onRemove={async (p) => {
            const res = await unignoreUser(me, p.id)
            setNote(res.ok ? `You're no longer ignoring ${p.displayName}.` : res.message)
            reloadIgnore()
          }}
        />
      ) : null}
      {/* A request someone sent before I ignored them stays hidden (Req 15.4). */}
      <PendingRequests
        incoming={visibleIncoming}
        onChanged={reload}
      />
      <FriendList
        me={me}
        friends={friends}
        pending={outgoing}
        groups={groups}
        memberships={memberships}
        presence={visiblePresence}
        unreadBySender={unreadBySender}
        nudgeBadges={nudgeBadges}
        shakingIds={shakingIds}
        onChatOpened={clearNudgeBadge}
        ignoredIds={ignoredIds}
        onIgnoreChanged={reloadIgnore}
        keys={myKeys.status === "ready" ? myKeys.keys : myKeys.status === "unavailable" ? "unavailable" : null}
        view={view}
        search={search}
        onToggleGroup={toggleGroup}
        onChanged={reload}
        onGroupsChanged={reloadGroups}
      />
      </div>

      {panel === "about" ? <AboutDialog onClose={() => setPanel(null)} /> : null}
      <ToastStack
        toasts={alerts.toasts}
        onOpen={(t) => {
          alerts.dismissToast(t.key)
          void openChatWindow(t.friendId)
        }}
      />
    </WindowFrame>
  )
}

export default BuddyList
