// The Buzz "B!" logo, drawn once and used by the BuzzLogo component and by
// scripts/gen-app-icon.mjs (Node runs this file directly, so it has no imports
// and only uses syntax that can be stripped). Original art, ADR 0006.

export interface LogoTheme {
  name: string;
  tileTop: string;
  tileBottom: string;
  /** Color of the burst rays behind the letters. */
  rays: string;
  /** Color of the sparkles. */
  spark: string;
  letter: string;
  outline: string;
}

export const logoThemes = {
  classic: {
    name: "Classic Purple",
    tileTop: "#7828c8",
    tileBottom: "#400080",
    rays: "#ffffff",
    spark: "#fff3a0",
    letter: "#ffcc00",
    outline: "#3a2a00",
  },
  sakura: {
    name: "Sakura",
    tileTop: "#ff7fb0",
    tileBottom: "#c2185b",
    rays: "#ffffff",
    spark: "#ffffff",
    letter: "#fff6c8",
    outline: "#5a0d33",
  },
  ember: {
    name: "Ember",
    tileTop: "#ff7a2f",
    tileBottom: "#a8200d",
    rays: "#ffe08a",
    spark: "#fff3a0",
    letter: "#ffffff",
    outline: "#4a0f05",
  },
  midnight: {
    name: "Midnight",
    tileTop: "#1c2f6b",
    tileBottom: "#070b24",
    rays: "#4de1ff",
    spark: "#8ff0ff",
    letter: "#4de1ff",
    outline: "#020512",
  },
} as const satisfies Record<string, LogoTheme>;

export type LogoThemeName = keyof typeof logoThemes;
export const logoThemeNames = Object.keys(logoThemes) as LogoThemeName[];

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A burst of thin and wide wedges from the middle, like a manga focus-line background. */
function burst(color: string, cx = 50, cy = 50, far = 90, rays = 18): string {
  const step = (Math.PI * 2) / rays;
  let d = "";
  for (let i = 0; i < rays; i++) {
    const a = i * step;
    const half = step * (i % 2 === 0 ? 0.28 : 0.12);
    const p = (angle: number) => `${r2(cx + far * Math.cos(angle))} ${r2(cy + far * Math.sin(angle))}`;
    d += `M${cx} ${cy}L${p(a - half)}L${p(a + half)}Z`;
  }
  return `<path d="${d}" fill="${color}" fill-opacity=".3"/>`;
}

/** A four-point sparkle. */
function sparkle(cx: number, cy: number, r: number, color: string): string {
  const k = r * 0.22;
  const d =
    `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}` +
    `Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}` +
    `Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

/**
 * The inside of the logo's <svg viewBox="0 0 100 100">. `idPrefix` keeps the
 * gradient and clip ids unique when several logos share one page.
 */
export function logoInner(theme: LogoThemeName, sparks: boolean, idPrefix: string): string {
  const t: LogoTheme = logoThemes[theme];
  const tile = `${idPrefix}-tile`;
  const clip = `${idPrefix}-clip`;
  const letters = `${idPrefix}-b`;
  const bang = `${idPrefix}-bang`;
  const back = sparks
    ? `<g clip-path="url(#${clip})">${burst(t.rays)}</g>` +
      sparkle(16, 20, 8, t.spark) +
      sparkle(83, 17, 5.5, t.spark) +
      sparkle(13, 72, 5, t.spark) +
      sparkle(83, 81, 6.5, t.spark)
    : "";
  const stroke = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<defs>` +
    `<linearGradient id="${tile}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.tileTop}"/><stop offset="1" stop-color="${t.tileBottom}"/></linearGradient>` +
    `<clipPath id="${clip}"><rect x="4" y="4" width="92" height="92" rx="20"/></clipPath>` +
    // B, then a big "!": a tall bar like a capital I with its dot on the baseline.
    `<g id="${letters}" ${stroke}><path d="M24 24V76M24 24H43C60 24 60 49 43 49H24M24 49H47C67 49 67 76 47 76H24"/></g>` +
    `<g id="${bang}" ${stroke}><path d="M81 24V58"/><path d="M81 76V76.1"/></g>` +
    `</defs>` +
    `<rect x="4" y="4" width="92" height="92" rx="20" fill="url(#${tile})"/>` +
    `<rect x="7" y="6" width="86" height="42" rx="17" fill="#fff" fill-opacity=".14"/>` +
    back +
    `<g transform="translate(4.5 4.5) scale(.91)">` +
    `<use href="#${letters}" stroke="${t.outline}" stroke-width="19"/>` +
    `<use href="#${bang}" stroke="${t.outline}" stroke-width="23"/>` +
    `<use href="#${letters}" stroke="${t.letter}" stroke-width="11"/>` +
    `<use href="#${bang}" stroke="${t.letter}" stroke-width="15"/>` +
    `</g>`
  );
}

/** A standalone SVG file, for the icon script and the preview sheet. */
export function logoSvg(theme: LogoThemeName, sparks: boolean): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${logoInner(theme, sparks, "buzz")}</svg>`;
}

/**
 * A wide banner: the burst fills the whole width, with the letters and sparkles
 * on top. Use it in an <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
 * so it covers any window width.
 */
export function heroInner(theme: LogoThemeName, idPrefix: string): string {
  const t: LogoTheme = logoThemes[theme];
  const bg = `${idPrefix}-bg`;
  const letters = `${idPrefix}-b`;
  const bang = `${idPrefix}-bang`;
  const stroke = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<defs>` +
    `<linearGradient id="${bg}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.tileTop}"/><stop offset="1" stop-color="${t.tileBottom}"/></linearGradient>` +
    `<g id="${letters}" ${stroke}><path d="M24 24V76M24 24H43C60 24 60 49 43 49H24M24 49H47C67 49 67 76 47 76H24"/></g>` +
    `<g id="${bang}" ${stroke}><path d="M81 24V58"/><path d="M81 76V76.1"/></g>` +
    `</defs>` +
    `<rect width="300" height="200" fill="url(#${bg})"/>` +
    burst(t.rays, 150, 100, 400, 28) +
    sparkle(32, 40, 15, t.spark) +
    sparkle(268, 34, 11, t.spark) +
    sparkle(46, 164, 10, t.spark) +
    sparkle(262, 160, 14, t.spark) +
    sparkle(228, 74, 6, t.spark) +
    `<svg x="70" y="14" width="160" height="160" viewBox="0 0 100 100" overflow="visible">` +
    `<use href="#${letters}" stroke="${t.outline}" stroke-width="19"/>` +
    `<use href="#${bang}" stroke="${t.outline}" stroke-width="23"/>` +
    `<use href="#${letters}" stroke="${t.letter}" stroke-width="11"/>` +
    `<use href="#${bang}" stroke="${t.letter}" stroke-width="15"/>` +
    `</svg>`
  );
}
