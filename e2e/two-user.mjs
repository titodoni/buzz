// Two-user check (tasks.md 29.1). User A runs in the real Buzz desktop app,
// driven through tauri-driver; user B runs the same web files in headless
// Chrome. They sign in with the throwaway accounts from e2e/setup-accounts.mjs
// and go through presence, a chat window, messages both ways, a Buzz!, and a
// sign-out and back. The result is written to e2e/report.md.
//
//   npm run tauri build -- --debug --no-bundle   # the app and out/
//   node e2e/setup-accounts.mjs                    # once
//   node e2e/two-user.mjs
//
// Linux needs WebKitWebDriver (apt: webkitgtk-webdriver), tauri-driver
// (cargo install tauri-driver) and Xvfb; A runs on a private screen. Windows
// needs msedgedriver matching WebView2: set E2E_NATIVE_DRIVER to its path.
// Close any running Buzz first: Buzz is single instance.
import { spawn } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"
import puppeteer from "puppeteer-core"
import { loadEnv } from "./env.mjs"
import { serveStatic } from "./static-server.mjs"
import { WebDriver } from "./webdriver.mjs"

const env = loadEnv([".env", process.env.E2E_ACCOUNTS ?? ".env.e2e.local"])
const WIN = process.platform === "win32"
const APP = resolve(env.E2E_APP ?? (WIN ? "src-tauri/target/debug/buzz.exe" : "src-tauri/target/debug/buzz"))
const CHROME = env.CHROME_PATH ?? (WIN ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome")
const A = { email: env.BUZZ_E2E_A_EMAIL, password: env.BUZZ_E2E_A_PASSWORD, name: "E2E Ann" }
const B = { email: env.BUZZ_E2E_B_EMAIL, password: env.BUZZ_E2E_B_PASSWORD, name: "E2E Bob" }
const WAIT = Number(env.E2E_WAIT_MS ?? 25_000)
const OUT_DIR = "e2e/out"
/** The static web files B loads; E2E_WEB lets CI test a build of another commit. */
const WEB = env.E2E_WEB ?? "out"

for (const [what, ok] of [
  ["the app (npm run tauri build -- --debug --no-bundle)", existsSync(APP)],
  [`${WEB}/ (the same build makes it)`, existsSync(join(WEB, "index.html"))],
  ["the test accounts (node e2e/setup-accounts.mjs)", Boolean(A.email && B.email)],
]) if (!ok) throw new Error(`Missing ${what}`)

// ---------- helpers that run inside a page (Chrome and the app alike) ----------

const page = {
  fillLogin(email, password) {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }
    const e = document.querySelector('input[type="email"]')
    const p = document.querySelector('input[type="password"]')
    const go = document.querySelector('button[type="submit"]')
    if (!e || !p || !go) return false
    set(e, email)
    set(p, password)
    go.click()
    return true
  },
  rowLabel(name) {
    const li = [...document.querySelectorAll("li[aria-label]")].find((el) => el.getAttribute("aria-label").startsWith(`${name}, `))
    return li ? li.getAttribute("aria-label") : null
  },
  openRow(name) {
    const li = [...document.querySelectorAll("li[aria-label]")].find((el) => el.getAttribute("aria-label").startsWith(`${name}, `))
    if (!li) return false
    li.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    return true
  },
  openStatusMenu() {
    const b = document.querySelector('button[aria-label^="Your status:"]')
    if (!b) return false
    if (b.getAttribute("aria-expanded") !== "true") b.click()
    return true
  },
  pickStatus(label) {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === label)
    if (!item) return false
    item.click()
    return true
  },
  myStatus() {
    return document.querySelector('button[aria-label^="Your status:"]')?.getAttribute("aria-label") ?? null
  },
  chatReady() {
    return Boolean(document.querySelector('textarea[aria-label="Type a message"]') && document.querySelector('[role="log"]'))
  },
  send(text) {
    const box = document.querySelector('textarea[aria-label="Type a message"]')
    const go = document.querySelector("button.ym-send")
    if (!box || !go) return false
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, text)
    box.dispatchEvent(new Event("input", { bubbles: true }))
    go.click()
    return true
  },
  logText() {
    return document.querySelector('[role="log"]')?.textContent ?? ""
  },
  notes() {
    return [...document.querySelectorAll('[role="status"],[role="alert"]')].map((el) => el.textContent.trim()).filter(Boolean).join(" | ")
  },
  buzz() {
    const b = document.querySelector("button.ym-chip-buzz")
    if (!b || b.disabled) return b ? "disabled" : "missing"
    b.click()
    return "clicked"
  },
  /** Desktop only: whether this window can read my private key from the keychain. */
  async keyInKeychain() {
    const k = Object.keys(localStorage).find((x) => x.startsWith("sb-") && x.endsWith("-auth-token"))
    const me = k && JSON.parse(localStorage.getItem(k))?.user?.id
    if (!me) return "not signed in"
    try {
      const v = await window.__TAURI_INTERNALS__.invoke("key_store_get", { account: me })
      return v ? "yes" : "no"
    } catch (e) {
      return `error: ${e}`
    }
  },
  bodyText() {
    return document.body?.innerText.slice(0, 300) ?? ""
  },
}

// ---------- running and reporting ----------

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(what, fn, ms = WAIT) {
  const until = Date.now() + ms
  let last
  while (Date.now() < until) {
    try {
      last = await fn()
      if (last) return last
    } catch (e) {
      last = e.message
    }
    await sleep(400)
  }
  throw new Error(`timed out after ${ms / 1000}s waiting for ${what} (last: ${String(last).slice(0, 160)})`)
}
let shot = 0
/** What each window says on screen (status and alert lines), for a failed step. */
async function onScreen() {
  const out = []
  try {
    const here = await a.current()
    for (const h of await a.handles()) {
      await a.switchTo(h)
      out.push(`A ${await aRun(() => location.pathname)}: ${(await aRun(page.notes)) || "-"}`)
    }
    await a.switchTo(here)
  } catch {}
  for (const [n, p] of [["B", bPage], ["B chat", bChat]]) {
    if (p && !p.isClosed()) out.push(`${n}: ${(await p.evaluate(page.notes).catch(() => "")) || "-"}`)
  }
  return out.join("; ")
}
async function snap(label) {
  const files = []
  try {
    const f = join(OUT_DIR, `${++shot}-${label}-A.png`)
    writeFileSync(f, await a.screenshot())
    files.push(f)
  } catch {}
  for (const [i, p] of [bPage, bChat].entries()) {
    if (!p || p.isClosed()) continue
    try {
      const f = join(OUT_DIR, `${shot}-${label}-B${i ? "-chat" : ""}.png`)
      await p.screenshot({ path: f })
      files.push(f)
    } catch {}
  }
  return files
}
let stop = false
async function step(id, title, fn) {
  if (stop) {
    results.push({ id, title, result: "NOT RUN", notes: "an earlier step it depends on failed" })
    return
  }
  const t0 = Date.now()
  try {
    const notes = (await fn()) ?? ""
    results.push({ id, title, result: "PASS", notes: `${notes}${notes ? " " : ""}(${((Date.now() - t0) / 1000).toFixed(1)}s)` })
    console.log(`PASS ${id} ${title}`)
  } catch (e) {
    const seen = await onScreen()
    const files = await snap(id)
    results.push({ id, title, result: "FAIL", notes: `${e.message}${seen ? ` On screen: ${seen}.` : ""}${files.length ? ` Screenshots: ${files.join(", ")}` : ""}` })
    console.log(`FAIL ${id} ${title}: ${e.message}`)
    if (fn.critical) stop = true
  }
}
const critical = (fn) => Object.assign(fn, { critical: true })

// ---------- set up both users ----------

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
const procs = []
const cleanups = []
let a, browser, bPage, bChat, mainHandle, aChat

const server = await serveStatic(WEB, Number(env.E2E_PORT ?? 48711))
cleanups.push(() => server.close())

// Each user keeps a profile between runs, as a real user does: the saved
// sign-in, the encryption key (B's; A's is in the keychain) and the friend keys
// already trusted. E2E_FRESH=1 starts both over (then also use new accounts,
// because the old messages were sent with the old keys).
const PROFILES = resolve("e2e/.profiles")
if (env.E2E_FRESH === "1") rmSync(PROFILES, { recursive: true, force: true })
const profile = join(PROFILES, "a")
const profileB = join(PROFILES, "b")
mkdirSync(profileB, { recursive: true })
const appEnv = { ...process.env }
if (!WIN) {
  const display = env.E2E_DISPLAY ?? ":99"
  if (!env.E2E_DISPLAY) {
    const x = spawn("Xvfb", [display, "-screen", "0", "1280x900x24", "-nolisten", "tcp"], { stdio: "ignore" })
    procs.push(x)
    await sleep(800)
  }
  Object.assign(appEnv, {
    DISPLAY: display,
    GDK_BACKEND: "x11",
    // A keeps its own Buzz profile here; the keychain (session D-Bus) is the real one.
    XDG_DATA_HOME: join(profile, "data"),
    XDG_CONFIG_HOME: join(profile, "config"),
    XDG_CACHE_HOME: join(profile, "cache"),
  })
  delete appEnv.WAYLAND_DISPLAY
  for (const d of ["data", "config", "cache"]) mkdirSync(join(profile, d), { recursive: true })
}
// Windows talks to msedgedriver directly (what tauri-driver does there), so its
// verbose log can go into e2e/out when the app does not start.
const driver = WIN
  ? spawn(env.E2E_NATIVE_DRIVER ?? "msedgedriver", ["--port=4444", "--verbose", `--log-path=${join(OUT_DIR, "msedgedriver.log")}`], {
      env: appEnv,
      stdio: ["ignore", "inherit", "inherit"],
    })
  : spawn(env.TAURI_DRIVER ?? "tauri-driver", ["--port", "4444"], { env: appEnv, stdio: ["ignore", "inherit", "inherit"] })
procs.push(driver)
await sleep(1500)

/** Opens the app and signs in if it asks; a saved sign-in goes straight to the Buddy List. */
async function signInIfAsked(run, acc, friend) {
  return waitFor(`${acc.name}'s Buddy List`, async () => {
    const row = await run(page.rowLabel, friend.name)
    if (row) return row
    await run(page.fillLogin, acc.email, acc.password)
    return null
  }, 45_000)
}
async function startB() {
  // The server keeps the same origin (port) so B's saved profile applies.
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: profileB,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-first-run"],
  })
  bPage = (await browser.pages())[0] ?? (await browser.newPage())
  browser.on("targetcreated", async (t) => {
    if (t.type() === "page" && t.url().includes("/chat/")) bChat = await t.page()
  })
  await bPage.goto(`${server.url}/`)
  await signInIfAsked((fn, ...args) => bPage.evaluate(fn, ...args), B, A)
}
async function stopB() {
  bChat = null
  await browser?.close()
  browser = null
  bPage = null
}
// Object-method source ("name(a) {...}") is not an expression; make it one.
const source = (fn) => {
  const src = fn.toString()
  if (/^(async\s+)?function\b/.test(src) || /^(async\s*)?\(?[\w$,\s]*\)?\s*=>/.test(src)) return src
  const m = /^(async\s+)?(.*)$/s.exec(src)
  return `${m[1] ?? ""}function ${m[2]}`
}
const aRun = (fn, ...args) => a.run(source(fn), ...args)
const bRow = () => bPage.evaluate(page.rowLabel, A.name)
const aRow = async () => {
  await a.switchTo(mainHandle)
  return aRun(page.rowLabel, B.name)
}

try {
  await step("T1", "B opens Buzz (browser), signs in if asked, and sees A in the Buddy List", critical(async () => {
    await startB()
    return `B's row for A: "${await bRow()}"`
  }))

  await step("T2", "A opens Buzz (desktop app), signs in if asked, and the Buddy List loads", critical(async () => {
    a = new WebDriver("http://127.0.0.1:4444")
    await a.start(APP, WIN)
    mainHandle = await a.current()
    const row = await signInIfAsked(aRun, A, B)
    return `A's row for B: "${row}"`
  }))

  await step("T3", "Each sees the other Online", async () => {
    const ab = await waitFor("A to see B online", async () => ((await aRow())?.includes(", online") ? await aRow() : null))
    const ba = await waitFor("B to see A online", async () => ((await bRow())?.includes(", online") ? await bRow() : null))
    return `A sees "${ab}"; B sees "${ba}"`
  })

  await step("T4", "A sets Busy; B sees A Busy; A goes back to Available", async () => {
    await a.switchTo(mainHandle)
    await waitFor("A's status menu", () => aRun(page.openStatusMenu))
    await waitFor("the Busy item", () => aRun(page.pickStatus, "Busy"))
    await waitFor("B to see A busy", async () => (await bRow())?.includes(", busy"))
    await waitFor("A's status menu", () => aRun(page.openStatusMenu))
    await waitFor("the Available item", () => aRun(page.pickStatus, "Available"))
    await waitFor("B to see A online again", async () => (await bRow())?.includes(", online"))
    return "busy and back seen by B"
  })

  await step("T5", "A opens a chat window with B (a real app window)", critical(async () => {
    await a.switchTo(mainHandle)
    const before = await a.handles()
    await waitFor("A's row for B", () => aRun(page.openRow, B.name))
    aChat = await waitFor("a new window", async () => (await a.handles()).find((h) => !before.includes(h)))
    await a.switchTo(aChat)
    await waitFor("the chat window to load (message box and conversation)", () => aRun(page.chatReady))
    const chatKey = await aRun(page.keyInKeychain)
    await a.switchTo(mainHandle)
    const mainKey = await aRun(page.keyInKeychain)
    await a.switchTo(aChat)
    return `windows: ${before.length} -> ${(await a.handles()).length}; key readable from Buddy List: ${mainKey}, from chat: ${chatKey}`
  }))

  const m1 = `hello from A ${Date.now()}`
  await step("T6", "A sends a message; B's Buddy List shows it waiting", async () => {
    await a.switchTo(aChat)
    await aRun(page.send, m1)
    await waitFor("the message in A's own chat", async () => (await aRun(page.logText)).includes(m1))
    const label = await waitFor("B's row to show 1 waiting", async () => {
      const l = await bRow()
      return l?.includes("waiting") ? l : null
    })
    return `B's row: "${label}"`
  })

  await step("T7", "B opens the chat and reads A's message", critical(async () => {
    await bPage.evaluate(page.openRow, A.name)
    await waitFor("B's chat window", async () => bChat && !bChat.isClosed() && (await bChat.evaluate(page.chatReady)))
    await waitFor("A's message, decrypted, in B's chat", async () => (await bChat.evaluate(page.logText)).includes(m1))
    return "message readable on B"
  }))

  const m2 = `reply from B ${Date.now()}`
  await step("T8", "B replies; A's open chat shows it", async () => {
    await bChat.evaluate(page.send, m2)
    await a.switchTo(aChat)
    await waitFor("B's reply in A's chat", async () => (await aRun(page.logText)).includes(m2))
  })

  await step("T9", "A sends a Buzz!; B's chat shows BUZZ!!!", async () => {
    await a.switchTo(aChat)
    const r = await waitFor("the BUZZ! button to be enabled", async () => {
      const s = await aRun(page.buzz)
      return s === "clicked" ? s : null
    })
    await waitFor("BUZZ!!! in B's chat", async () => (await bChat.evaluate(page.logText)).includes("BUZZ!!!"))
    return `button ${r}`
  })

  await step("T10", "A closes the chat window; B quits; A sees B Offline and the app still answers", async () => {
    await a.switchTo(aChat)
    // The title bar's Close button, as a person would.
    await aRun(() => document.querySelector('button[aria-label="Close"]')?.click())
    const closed = aChat
    await waitFor("the chat window to close", async () => !(await a.handles()).includes(closed))
    aChat = null
    await a.switchTo(mainHandle)
    await stopB()
    const label = await waitFor("A to see B offline", async () => {
      const l = await aRow()
      return l?.includes(", offline") ? l : null
    }, 60_000)
    return `A sees "${label}"`
  })

  await step("T11", "B opens Buzz again; A sees B Online again without freezing", critical(async () => {
    await startB()
    const label = await waitFor("A to see B online", async () => {
      const l = await aRow()
      return l?.includes(", online") ? l : null
    }, 60_000)
    // The "is now online" toast opens its own window; the app must keep answering.
    const handles = await a.handles()
    return `A sees "${label}"; app windows open: ${handles.length}`
  }))

  await step("T12", "A opens B's chat again after B came back and sees the earlier messages", async () => {
    await a.switchTo(mainHandle)
    const before = await a.handles()
    await waitFor("A's row for B", () => aRun(page.openRow, B.name))
    aChat = await waitFor("a new chat window", async () => {
      for (const h of await a.handles()) {
        if (before.includes(h)) continue
        await a.switchTo(h)
        if (await aRun(() => location.pathname).then((p) => p.startsWith("/chat"))) return h
      }
      await a.switchTo(mainHandle)
      return null
    })
    await waitFor("the chat window to load", () => aRun(page.chatReady))
    await waitFor("the earlier messages in the reopened chat", async () => {
      const log = await aRun(page.logText)
      return log.includes(m1) && log.includes(m2)
    })
    return "history shows both earlier messages"
  })
} finally {
  await a?.quit()
  await browser?.close().catch(() => undefined)
  for (const p of procs.reverse()) p.kill()
  for (const c of cleanups) await c()
}

// ---------- report ----------

const pass = results.filter((r) => r.result === "PASS").length
const lines = [
  "# Two-user check (automated)",
  "",
  `Date: ${new Date().toISOString()}  Platform: ${process.platform}  App: ${APP}${env.E2E_LABEL ? `  Build: ${env.E2E_LABEL}` : ""}`,
  "",
  `User A: the Buzz desktop app, driven by ${WIN ? "msedgedriver" : "tauri-driver"}. User B: the same web files in headless Chrome.`,
  "Both use the throwaway accounts from `e2e/setup-accounts.mjs` on the hosted Supabase project.",
  "Not judged here: the shake you see and the sound you hear, the tray, and anything only a person can notice.",
  "",
  `Result: ${pass} of ${results.length} PASS`,
  "",
  "| # | Step | Result | Notes |",
  "| --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.id} | ${r.title} | ${r.result} | ${r.notes.replace(/\|/g, "\\|")} |`),
  "",
]
const REPORT = env.E2E_REPORT ?? "e2e/report.md"
writeFileSync(REPORT, lines.join("\n"))
console.log(`\n${pass}/${results.length} PASS. Report: ${REPORT}`)
process.exit(pass === results.length ? 0 : 1)
