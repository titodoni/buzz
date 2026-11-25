// Makes the two throwaway accounts the two-user check signs in with, and makes
// them friends. Run once:  node e2e/setup-accounts.mjs
//
// The accounts are only for this check (their encryption keys are replaced on
// every run), so they are separate from the BUZZ_TEST_* accounts in
// .env.test.local. Their logins go to .env.e2e.local, which git ignores.
// Running it again reuses that file and only repairs the friendship.
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"
import { loadEnv } from "./env.mjs"

// E2E_ACCOUNTS picks another file, e.g. for CI, which makes new accounts each run
// unless BUZZ_E2E_A_EMAIL..BUZZ_E2E_B_PASSWORD are already provided in the environment.
const FILE = process.env.E2E_ACCOUNTS ?? ".env.e2e.local"
const env = { ...loadEnv([".env", FILE]), ...process.env }
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error("Put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env")

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

let accounts
if (env.BUZZ_E2E_A_EMAIL && env.BUZZ_E2E_A_PASSWORD && env.BUZZ_E2E_B_EMAIL && env.BUZZ_E2E_B_PASSWORD) {
  accounts = {
    a: { email: env.BUZZ_E2E_A_EMAIL, password: env.BUZZ_E2E_A_PASSWORD, name: "E2E Ann" },
    b: { email: env.BUZZ_E2E_B_EMAIL, password: env.BUZZ_E2E_B_PASSWORD, name: "E2E Bob" },
  }
  if (!existsSync(FILE)) {
    writeFileSync(
      FILE,
      [
        "# Reused accounts for e2e/two-user.mjs (git-ignored).",
        `BUZZ_E2E_A_EMAIL=${accounts.a.email}`,
        `BUZZ_E2E_A_PASSWORD=${accounts.a.password}`,
        `BUZZ_E2E_B_EMAIL=${accounts.b.email}`,
        `BUZZ_E2E_B_PASSWORD=${accounts.b.password}`,
        "",
      ].join("\n"),
      { mode: 0o600 },
    )
  }
} else {
  const tag = randomBytes(3).toString("hex")
  const pw = () => randomBytes(12).toString("base64url")
  accounts = {
    a: { email: `buzz.e2e.ann.${tag}@example.com`, password: pw(), name: "E2E Ann" },
    b: { email: `buzz.e2e.bob.${tag}@example.com`, password: pw(), name: "E2E Bob" },
  }
  for (const acc of Object.values(accounts)) {
    const { data, error } = await client().auth.signUp({
      email: acc.email,
      password: acc.password,
      options: { data: { display_name: acc.name } },
    })
    if (error) throw new Error(`sign-up of ${acc.email} failed: ${error.message}`)
    if (!data.session) throw new Error("Email confirmation is on; confirm both addresses, then run this again")
  }
  writeFileSync(
    FILE,
    [
      "# Throwaway accounts for e2e/two-user.mjs (git-ignored). Made by e2e/setup-accounts.mjs.",
      `BUZZ_E2E_A_EMAIL=${accounts.a.email}`,
      `BUZZ_E2E_A_PASSWORD=${accounts.a.password}`,
      `BUZZ_E2E_B_EMAIL=${accounts.b.email}`,
      `BUZZ_E2E_B_PASSWORD=${accounts.b.password}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  )
  console.log(`Made ${accounts.a.email} and ${accounts.b.email}; logins saved in ${FILE}`)
}

async function signIn(acc) {
  const c = client()
  const { data, error } = await c.auth.signInWithPassword({ email: acc.email, password: acc.password })
  if (error) throw new Error(`sign-in of ${acc.email} failed: ${error.message}`)
  return { c, id: data.user.id }
}

const A = await signIn(accounts.a)
const B = await signIn(accounts.b)

const { data: rows, error } = await A.c
  .from("friendships")
  .select("id,status,requester_id")
  .or(`and(requester_id.eq.${A.id},addressee_id.eq.${B.id}),and(requester_id.eq.${B.id},addressee_id.eq.${A.id})`)
if (error) throw error
let row = rows[0]
if (!row) {
  const ins = await A.c.from("friendships").insert({ requester_id: A.id, addressee_id: B.id, status: "pending" }).select().single()
  if (ins.error) throw ins.error
  row = ins.data
}
if (row.status === "pending") {
  const addressee = row.requester_id === A.id ? B : A
  const upd = await addressee.c.from("friendships").update({ status: "accepted" }).eq("id", row.id)
  if (upd.error) throw upd.error
} else if (row.status !== "accepted") {
  throw new Error(`The friendship is "${row.status}". Delete ${FILE} and run again for fresh accounts.`)
}
console.log("E2E Ann and E2E Bob are friends.")
