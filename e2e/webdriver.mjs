// A small W3C WebDriver client: just the calls the two-user check needs, so the
// check adds no WebDriver library. It talks to tauri-driver, which drives the
// real Buzz desktop app (WebKitWebDriver on Linux, msedgedriver on Windows).

export class WebDriver {
  constructor(base) {
    this.base = base.replace(/\/$/, "")
    this.id = null
  }

  async cmd(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.value?.error) {
      const v = json.value ?? {}
      throw new Error(`WebDriver ${method} ${path}: ${v.error ?? res.status} ${v.message ?? ""}`.trim())
    }
    return json.value
  }

  s(path) {
    return `/session/${this.id}${path}`
  }

  async start(application, env) {
    const value = await this.cmd("POST", "/session", {
      capabilities: { alwaysMatch: { "tauri:options": { application, ...(env ? { env } : {}) } } },
    })
    this.id = value.sessionId
  }

  async quit() {
    if (!this.id) return
    await this.cmd("DELETE", this.s("")).catch(() => undefined)
    this.id = null
  }

  /** Runs `fn` (a function, sent as source) in the current window with `args`. */
  async run(fn, ...args) {
    return this.cmd("POST", this.s("/execute/sync"), { script: `return (${fn}).apply(null, arguments)`, args })
  }

  async handles() {
    return this.cmd("GET", this.s("/window/handles"))
  }

  async current() {
    return this.cmd("GET", this.s("/window"))
  }

  async switchTo(handle) {
    await this.cmd("POST", this.s("/window"), { handle })
  }

  async screenshot() {
    return Buffer.from(await this.cmd("GET", this.s("/screenshot")), "base64")
  }
}
