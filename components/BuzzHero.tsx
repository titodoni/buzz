import { useId } from "react";
import { heroInner, type LogoThemeName } from "@/lib/brand/logo";

/** Open YM-style tilted B! + glossy smiley emblem, sized proportionally without stretching. */
export function BuzzHero({ theme = "classic", height = 128 }: { theme?: LogoThemeName; height?: number }) {
  const id = `buzz-hero-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox="0 0 300 132"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Buzz!"
      style={{ display: "block", flexShrink: 0 }}
      // Static markup built from constants in lib/brand/logo.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: heroInner(theme, id) }}
    />
  );
}
