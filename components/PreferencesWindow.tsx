"use client"

import { useEffect, useState, type ReactNode } from "react"

import { WindowFrame } from "@/components/WindowFrame"
import { FormatBar } from "@/components/chat/FormatBar"
import { loadSignInOptions, saveSignInOptions } from "@/components/auth/remember"
import { DEFAULT_SIGN_IN_OPTIONS, type SignInOptions } from "@/lib/auth/options"
import { useChatView } from "@/lib/chat/useChatView"
import { formatToStyle } from "@/lib/chat/format"
import { unignoreUser, useIgnoreList } from "@/lib/friends/ignore"
import { useBuddyView } from "@/lib/friends/useBuddyView"
import { usePrefs } from "@/lib/prefs/usePrefs"

const CATEGORIES = ["General", "Alerts and Sounds", "Messages", "Buzz!", "Ignore List"] as const
type Category = (typeof CATEGORIES)[number]

function Check(props: { label: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 py-1" style={props.disabled ? { opacity: 0.6 } : undefined}>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      {props.label}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col">
      <h2 className="m-0 mb-1 text-sm font-bold">{title}</h2>
      {children}
    </section>
  )
}

/**
 * The Preferences window (Req 19). Every switch saves on this device at once
 * and reaches the other open windows through the `storage` event; the Ignore
 * List belongs to the account (Req 19.8).
 */
export function PreferencesWindow({ me }: { me: string }) {
  const [category, setCategory] = useState<Category>("General")
  const { prefs, update } = usePrefs()
  const { view: buddyView, setShowOffline } = useBuddyView()
  const { view: chatView, update: updateChatView } = useChatView()
  const { ignored, reload: reloadIgnore } = useIgnoreList(me)
  const [note, setNote] = useState<string | null>(null)
  const [signIn, setSignIn] = useState<SignInOptions>(DEFAULT_SIGN_IN_OPTIONS)
  useEffect(() => {
    // Read after mount: localStorage doesn't exist during the static prerender.
    queueMicrotask(() => setSignIn(loadSignInOptions()))
  }, [])
  const changeSignIn = (change: Partial<SignInOptions>) => {
    const next = { ...signIn, ...change }
    setSignIn(next)
    saveSignInOptions(next)
  }
  const soundsOff = !prefs.alerts.allSounds

  return (
    <WindowFrame title="Buzz Preferences">
      <div className="flex h-full min-h-0 gap-2 p-2 text-sm">
        <nav aria-label="Categories" className="flex shrink-0 flex-col gap-1" style={{ width: 128 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className="ym-row px-2 py-1 text-left"
              aria-current={c === category ? "page" : undefined}
              style={c === category ? { fontWeight: 700, background: "var(--ym-select, #dcd0f0)" } : undefined}
              onClick={() => {
                setCategory(c)
                setNote(null)
              }}
            >
              {c}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-auto">
          {category === "General" ? (
            <Section title="General">
              <Check
                label="Sign in automatically"
                checked={signIn.autoSignIn}
                onChange={(on) => changeSignIn({ autoSignIn: on })}
              />
              <Check
                label="Sign in as invisible to everyone"
                checked={signIn.signInInvisible}
                onChange={(on) => changeSignIn({ signInInvisible: on })}
              />
              <Check label="Show Offline Contacts" checked={buddyView.showOffline} onChange={setShowOffline} />
            </Section>
          ) : null}
          {category === "Alerts and Sounds" ? (
            <Section title="Alerts and Sounds">
              <Check label="Play sounds" checked={prefs.alerts.allSounds} onChange={(on) => update({ alerts: { allSounds: on } })} />
              <div className="pl-4">
                <Check
                  label="Sound when a message arrives"
                  checked={prefs.alerts.messageSound}
                  disabled={soundsOff}
                  onChange={(on) => update({ alerts: { messageSound: on } })}
                />
                <Check
                  label="Sound when a friend comes online"
                  checked={prefs.alerts.onlineSound}
                  disabled={soundsOff}
                  onChange={(on) => update({ alerts: { onlineSound: on } })}
                />
              </div>
              <Check
                label="Show a notice when a friend comes online"
                checked={prefs.alerts.onlineToast}
                onChange={(on) => update({ alerts: { onlineToast: on } })}
              />
            </Section>
          ) : null}
          {category === "Messages" ? (
            <Section title="Messages">
              <p className="m-0 mb-1 text-xs">Your messages are sent in this font:</p>
              <FormatBar format={chatView.myFormat} onChange={(f) => updateChatView({ myFormat: f })} />
              <p className="m-0 my-2 rounded border px-2 py-1" style={formatToStyle(chatView.myFormat)}>
                Hey, are you there? :)
              </p>
              <Check
                label="Show Timestamps"
                checked={chatView.showTimestamps}
                onChange={(on) => updateChatView({ showTimestamps: on })}
              />
              <Check
                label="Show my friends' fonts"
                checked={chatView.showFriendsFonts}
                onChange={(on) => updateChatView({ showFriendsFonts: on })}
              />
            </Section>
          ) : null}
          {category === "Buzz!" ? (
            <Section title="Buzz!">
              <Check label="Allow Buzz!" checked={prefs.buzz.allow} onChange={(on) => update({ buzz: { allow: on } })} />
              <div className="pl-4">
                <Check
                  label="Play the Buzz! sound"
                  checked={prefs.buzz.sound}
                  disabled={!prefs.buzz.allow || soundsOff}
                  onChange={(on) => update({ buzz: { sound: on } })}
                />
                <Check
                  label="Shake the window for a Buzz!"
                  checked={prefs.buzz.shake}
                  disabled={!prefs.buzz.allow}
                  onChange={(on) => update({ buzz: { shake: on } })}
                />
              </div>
              {!prefs.buzz.allow ? (
                <p className="m-0 mt-1 text-xs">Friends can still Buzz you, but you won&apos;t see or hear it.</p>
              ) : null}
            </Section>
          ) : null}
          {category === "Ignore List" ? (
            <Section title="Ignore List">
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
            </Section>
          ) : null}
          {note ? (
            <p role="status" className="m-0 mt-2 text-xs">
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </WindowFrame>
  )
}
