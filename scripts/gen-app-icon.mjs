// Renders Buzz's app icon (original art, ADR 0006) from lib/brand/logo.ts.
// Run: node scripts/gen-app-icon.mjs [theme] [--sheet]
//   theme   classic (default), sakura, ember, midnight
//   --sheet also writes one preview PNG per theme to /tmp/buzz-logo-<theme>.png
// Then: npx tauri icon src-tauri/icons/app-icon.png   (writes every size and format)
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logoSvg, logoThemeNames } from "../lib/brand/logo.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const theme = args.find((a) => !a.startsWith("--")) ?? "classic";
if (!logoThemeNames.includes(theme)) {
  console.error(`Unknown theme "${theme}". Pick one of: ${logoThemeNames.join(", ")}`);
  process.exit(1);
}
const render = (name, file) =>
  sharp(Buffer.from(logoSvg(name, true)), { density: 1152 }).resize(1024, 1024).png().toFile(file);

const out = join(root, "src-tauri", "icons", "app-icon.png");
await render(theme, out);
console.log(`wrote ${out} (${theme})`);
if (args.includes("--sheet")) {
  for (const name of logoThemeNames) {
    const file = `/tmp/buzz-logo-${name}.png`;
    await render(name, file);
    console.log(`wrote ${file}`);
  }
}
