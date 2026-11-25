import { existsSync, readFileSync } from "node:fs"

/** Reads KEY=value lines from the files that exist; process.env wins. */
export function loadEnv(files) {
  const out = {}
  for (const file of files) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2")
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) out[k] = v
  return out
}
