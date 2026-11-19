import { contrastRatio } from "./contrast";

export const skinTokens = {
  "ym-purple": "#6400cd",
  "ym-purple-deep": "#2f1050",
  "ym-blue": "#0067fa",
  "titlebar-text": "#ffffff",
  "window-bg": "#ececec",
  "panel-bg": "#ffffff",
  border: "#b8b8b8",
  "row-hover": "#d9e8ff",
  "text-body": "#1a1a1a",
  "text-muted": "#595959",
  smiley: "#ffcc00",
  idle: "#f5a000",
  busy: "#e8820a",
  offline: "#8a8a8a",
  "buzz-red": "#cc0000",
  "msg-self": "#0067fa",
  "msg-friend": "#cc3300",
} as const;

export type SkinTokenName = keyof typeof skinTokens;

export interface SkinPair {
  name: string;
  fg: string;
  bg: string;
}

const t = skinTokens;

/** Every text/background combination the skin uses. All must reach 4.5:1 (WCAG AA). */
export const skinTextPairs: readonly SkinPair[] = [
  { name: "titlebar text on purple", fg: t["titlebar-text"], bg: t["ym-purple"] },
  { name: "titlebar text on purple-deep", fg: t["titlebar-text"], bg: t["ym-purple-deep"] },
  { name: "body text on window-bg", fg: t["text-body"], bg: t["window-bg"] },
  { name: "body text on panel-bg", fg: t["text-body"], bg: t["panel-bg"] },
  { name: "body text on row-hover", fg: t["text-body"], bg: t["row-hover"] },
  { name: "muted text on panel-bg", fg: t["text-muted"], bg: t["panel-bg"] },
  { name: "muted text on window-bg", fg: t["text-muted"], bg: t["window-bg"] },
  { name: "self sender name on panel-bg", fg: t["msg-self"], bg: t["panel-bg"] },
  { name: "friend sender name on panel-bg", fg: t["msg-friend"], bg: t["panel-bg"] },
  { name: "buzz-red on panel-bg", fg: t["buzz-red"], bg: t["panel-bg"] },
  { name: "link blue on panel-bg", fg: t["ym-blue"], bg: t["panel-bg"] },
  { name: "button text on purple", fg: "#ffffff", bg: t["ym-purple"] },
  { name: "button text on purple-deep", fg: "#ffffff", bg: t["ym-purple-deep"] },
];

export function minSkinContrast(): number {
  return Math.min(...skinTextPairs.map((p) => contrastRatio(p.fg, p.bg)));
}
