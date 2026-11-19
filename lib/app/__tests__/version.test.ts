import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { APP_VERSION } from "../version"

describe("APP_VERSION (Req 13.8)", () => {
  it("matches package.json and the Tauri config, so About never shows a stale version", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
    const tauri = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")) as { version: string }
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe(tauri.version)
  })
})
