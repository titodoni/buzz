// Generates ORIGINAL placeholder emoticon SVGs into public/emoticons/.
// Simple yellow round faces drawn from basic shapes. Not copied or traced from
// any Yahoo or other vendor artwork. Slugs must match lib/emoticons/shortcode.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "emoticons");
mkdirSync(outDir, { recursive: true });

const S = "#5a3b00"; // stroke / feature color
const f = (d, extra = "") => `<path d="${d}" fill="none" stroke="${S}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const dot = (x, y, r = 2.6, fill = S) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;

const eyes = {
  dots: dot(10, 12) + dot(22, 12),
  wink: dot(10, 12) + f("M19 12 h6"),
  closed: f("M7 12 q3 -3 6 0") + f("M19 12 q3 -3 6 0"),
  big: `<ellipse cx="10" cy="12" rx="3" ry="4" fill="#fff" stroke="${S}" stroke-width="1.6"/><ellipse cx="22" cy="12" rx="3" ry="4" fill="#fff" stroke="${S}" stroke-width="1.6"/>` + dot(10, 12, 1.5) + dot(22, 12, 1.5),
  x: f("M7 9 l6 6 M13 9 l-6 6") + f("M19 9 l6 6 M25 9 l-6 6"),
  shades: `<rect x="5" y="9" width="10" height="6" rx="2" fill="${S}"/><rect x="17" y="9" width="10" height="6" rx="2" fill="${S}"/>` + f("M15 11 h2"),
  glasses: `<circle cx="10" cy="12" r="4.5" fill="#fff" stroke="${S}" stroke-width="2"/><circle cx="22" cy="12" r="4.5" fill="#fff" stroke="${S}" stroke-width="2"/>` + f("M14.5 12 h3") + dot(10, 12, 1.6) + dot(22, 12, 1.6),
  hearts: ["M10 16 l-4 -4 a2.4 2.4 0 0 1 4 -3 a2.4 2.4 0 0 1 4 3 z", "M22 16 l-4 -4 a2.4 2.4 0 0 1 4 -3 a2.4 2.4 0 0 1 4 3 z"].map((d) => `<path d="${d}" fill="#e0245e"/>`).join(""),
  side: `<circle cx="10" cy="12" r="3.6" fill="#fff" stroke="${S}" stroke-width="1.4"/><circle cx="22" cy="12" r="3.6" fill="#fff" stroke="${S}" stroke-width="1.4"/>` + dot(12, 10.5, 1.6) + dot(24, 10.5, 1.6),
  sleepy: f("M6 12 h8") + f("M18 12 h8"),
  angry: dot(10, 13) + dot(22, 13) + f("M6 7 l8 3") + f("M26 7 l-8 3"),
  lash: dot(10, 12) + dot(22, 12) + f("M6 8 l-2 -2 M8 7 l-1 -3 M12 7 l1 -3") + f("M20 7 l-1 -3 M24 7 l1 -3 M26 8 l2 -2"),
  stars: ["M10 8 v8 M6 12 h8", "M22 8 v8 M18 12 h8"].map((d) => f(d)).join(""),
  money: `<text x="10" y="16" font-size="9" text-anchor="middle" fill="#1d7a2e" font-family="sans-serif" font-weight="bold">$</text><text x="22" y="16" font-size="9" text-anchor="middle" fill="#1d7a2e" font-family="sans-serif" font-weight="bold">$</text>`,
  spiral: f("M10 12 m-1 0 a1 1 0 1 1 2 0 a2 2 0 1 1 -4 0 a3 3 0 1 1 6 0") + f("M22 12 m-1 0 a1 1 0 1 1 2 0 a2 2 0 1 1 -4 0 a3 3 0 1 1 6 0"),
};

const mouths = {
  smile: f("M8 21 q8 7 16 0"),
  frown: f("M9 25 q7 -6 14 0"),
  grin: `<path d="M7 20 q9 10 18 0 z" fill="#fff" stroke="${S}" stroke-width="2.2" stroke-linejoin="round"/>`,
  open: `<ellipse cx="16" cy="23" rx="3.5" ry="4.5" fill="${S}"/>`,
  small: `<circle cx="16" cy="23" r="2.2" fill="${S}"/>`,
  tongue: f("M8 21 q8 6 16 0") + `<path d="M13 24 v3 a3 3 0 0 0 6 0 v-3 z" fill="#ff7a8a" stroke="${S}" stroke-width="1.6"/>`,
  flat: f("M9 23 h14"),
  kiss: `<path d="M13 21 q-2 2 0 4 q-1 1 0 0 q3 2 6 0 q2 -2 0 -4 q-3 -2 -6 0z" fill="#e0245e"/>`,
  smirk: f("M9 23 q8 3 15 -3"),
  wavy: f("M7 23 q3 -4 6 0 t6 0 t6 0"),
  cry: f("M9 26 q7 -7 14 0") + `<path d="M8 15 q-3 6 0 8 q3 -2 0 -8z M24 15 q3 6 0 8 q-3 -2 0 -8z" fill="#4aa8ff"/>`,
  laugh: `<path d="M7 19 q9 12 18 0 z" fill="#fff" stroke="${S}" stroke-width="2.2" stroke-linejoin="round"/>` + `<path d="M5 14 q-3 7 0 8 q3 -2 0 -8z M27 14 q3 7 0 8 q-3 -2 0 -8z" fill="#4aa8ff"/>`,
  green: f("M9 24 q3 -3 6 0 q3 3 6 0"),
  zip: f("M8 23 h16") + f("M10 21 v4 M13 21 v4 M16 21 v4 M19 21 v4 M22 21 v4"),
  sick: f("M9 24 q3 -3 6 0 q3 3 6 0"),
  slash: f("M10 24 l12 -3"),
  teeth: `<rect x="9" y="20" width="14" height="6" rx="2" fill="#fff" stroke="${S}" stroke-width="2"/>` + f("M16 20 v6"),
  drool: f("M9 21 q7 5 14 0") + `<path d="M21 22 q2 5 0 7 q-2 -2 0 -7z" fill="#4aa8ff"/>`,
};

const extras = {
  none: "",
  blush: `<ellipse cx="6" cy="19" rx="3" ry="2" fill="#ff6b81" opacity=".7"/><ellipse cx="26" cy="19" rx="3" ry="2" fill="#ff6b81" opacity=".7"/>`,
  horns: `<path d="M5 6 l3 -5 l3 6 z M27 6 l-3 -5 l-3 6 z" fill="#d62828"/>`,
  halo: `<ellipse cx="16" cy="1.5" rx="7" ry="2" fill="none" stroke="#e8b400" stroke-width="2"/>`,
  hat: `<path d="M9 6 l7 -6 l7 6 z" fill="#e0245e"/><circle cx="16" cy="0.8" r="1.8" fill="#4aa8ff"/>`,
  clown: `<circle cx="16" cy="17" r="3.4" fill="#e03131"/><path d="M4 8 q-4 -5 1 -6 M28 8 q4 -5 -1 -6" stroke="#2f9e44" stroke-width="3" fill="none"/>`,
  brow: f("M18 6 q4 -3 8 0"),
  think: f("M26 4 q2 -3 4 0 q0 2 -2 3") + dot(28, 9, 1),
  sweat: `<path d="M26 5 q3 5 0 7 q-3 -2 0 -7z" fill="#4aa8ff"/>`,
  hug: f("M1 14 q-2 6 3 8 M31 14 q2 6 -3 8"),
  hand: `<rect x="24" y="16" width="7" height="12" rx="3" fill="#ffd54a" stroke="${S}" stroke-width="1.6"/>`,
  zzz: `<text x="22" y="7" font-size="7" fill="${S}" font-family="sans-serif" font-weight="bold">z</text>`,
  note: `<text x="23" y="8" font-size="9" fill="${S}" font-family="sans-serif" font-weight="bold">♪</text>`,
  phone: `<rect x="0" y="12" width="5" height="10" rx="1.5" fill="#444"/>`,
  peace: f("M27 6 v-4 M30 6 v-5") + `<rect x="25" y="5" width="7" height="8" rx="2" fill="#ffd54a" stroke="${S}" stroke-width="1.4"/>`,
  clap: f("M2 24 l4 -3 M30 24 l-4 -3 M1 18 l3 0 M31 18 l-3 0"),
  pray: `<path d="M13 28 l3 -6 l3 6 z" fill="#ffd54a" stroke="${S}" stroke-width="1.4"/>`,
  heartbreak: f("M25 3 l2 3 l-2 2 l2 3"),
};

// slug: [skin, eyes, mouth, extra]
const faces = {
  smile: ["yellow", "dots", "smile", "none"],
  frown: ["yellow", "dots", "frown", "none"],
  wink: ["yellow", "wink", "smile", "none"],
  grin: ["yellow", "dots", "grin", "none"],
  lashes: ["yellow", "lash", "smile", "none"],
  hug: ["yellow", "closed", "smile", "hug"],
  confused: ["yellow", "side", "slash", "none"],
  love: ["yellow", "hearts", "smile", "none"],
  blush: ["yellow", "closed", "smile", "blush"],
  tongue: ["yellow", "dots", "tongue", "none"],
  kiss: ["yellow", "closed", "kiss", "none"],
  brokenheart: ["yellow", "dots", "frown", "heartbreak"],
  surprise: ["yellow", "big", "open", "none"],
  angry: ["red", "angry", "frown", "none"],
  smug: ["yellow", "dots", "smirk", "none"],
  cool: ["yellow", "shades", "smile", "none"],
  worried: ["yellow", "side", "wavy", "none"],
  whew: ["yellow", "closed", "frown", "sweat"],
  devil: ["yellow", "angry", "grin", "horns"],
  cry: ["yellow", "closed", "cry", "none"],
  laugh: ["yellow", "closed", "laugh", "none"],
  straight: ["yellow", "dots", "flat", "none"],
  eyebrow: ["yellow", "dots", "smirk", "brow"],
  rofl: ["yellow", "closed", "laugh", "none"],
  angel: ["yellow", "dots", "smile", "halo"],
  nerd: ["yellow", "glasses", "teeth", "none"],
  talktohand: ["yellow", "side", "flat", "hand"],
  sleeping: ["yellow", "sleepy", "flat", "zzz"],
  rollingeyes: ["yellow", "side", "flat", "none"],
  sick: ["green", "x", "sick", "none"],
  donttell: ["yellow", "side", "zip", "none"],
  notalking: ["yellow", "dots", "zip", "none"],
  clown: ["yellow", "dots", "smile", "clown"],
  silly: ["yellow", "big", "tongue", "none"],
  party: ["yellow", "closed", "tongue", "hat"],
  yawn: ["yellow", "sleepy", "open", "none"],
  drooling: ["yellow", "dots", "drool", "none"],
  thinking: ["yellow", "side", "flat", "think"],
  doh: ["yellow", "x", "frown", "none"],
  applause: ["yellow", "closed", "grin", "clap"],
  callme: ["yellow", "dots", "smile", "phone"],
  peace: ["yellow", "dots", "smile", "peace"],
  // hidden
  pig: ["pink", "dots", "small", "none"],
  cow: ["white", "dots", "small", "horns"],
  monkey: ["brown", "dots", "smile", "none"],
  chicken: ["yellow", "dots", "small", "hat"],
  skull: ["white", "x", "teeth", "none"],
  whistling: ["yellow", "dots", "small", "note"],
  dancing: ["yellow", "closed", "grin", "note"],
  witsend: ["yellow", "x", "frown", "sweat"],
  frustrated: ["yellow", "angry", "wavy", "none"],
  praying: ["yellow", "closed", "smile", "pray"],
  money: ["yellow", "money", "grin", "none"],
  sigh: ["yellow", "closed", "frown", "none"],
  bringit: ["yellow", "angry", "smirk", "none"],
  heehee: ["yellow", "closed", "grin", "blush"],
  hypnotized: ["yellow", "spiral", "smile", "none"],
};

const skins = {
  yellow: ["#fff27a", "#f2b800"],
  red: ["#ff9d8a", "#d62828"],
  green: ["#c5e87a", "#6a9c1f"],
  pink: ["#ffc2d4", "#e0709a"],
  white: ["#ffffff", "#b8b8b8"],
  brown: ["#c8905a", "#7a4a1e"],
};

function wrap(slug, inner, skin = "yellow") {
  const [light, dark] = skins[skin];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-2 -4 36 36" role="img" aria-label="${slug}">
<defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>
${inner}
</svg>
`;
}

const face = () => `<circle cx="16" cy="16" r="15" fill="url(#g)" stroke="${S}" stroke-width="1.6"/>`;

let count = 0;
for (const [slug, [skin, e, m, x]] of Object.entries(faces)) {
  const extra = extras[x];
  const body = [face(), eyes[e], mouths[m], extra].join("\n");
  writeFileSync(join(outDir, `${slug}.svg`), wrap(slug, body, skin));
  count++;
}

// Rose: not a face.
writeFileSync(
  join(outDir, "rose.svg"),
  wrap("rose", `<path d="M16 14 v16" stroke="#2f9e44" stroke-width="2.4"/><path d="M16 24 q6 -2 8 -6 q-6 0 -8 6z" fill="#2f9e44"/><circle cx="16" cy="9" r="7" fill="#e0245e" stroke="${S}" stroke-width="1.4"/><path d="M16 9 m-3 0 a3 3 0 1 1 6 0 a1.5 1.5 0 1 1 -3 0" fill="none" stroke="#8b0f33" stroke-width="1.4"/>`),
);
count++;

console.log(`Wrote ${count} SVGs to ${outDir}`);
