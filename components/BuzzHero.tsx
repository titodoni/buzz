import { useId } from "react";
import { heroInner, type LogoThemeName } from "@/lib/brand/logo";

/** The B! logo over a full-width burst. It fills its parent's width and crops, never stretches. */
export function BuzzHero({ theme = "classic", height = 200 }: { theme?: LogoThemeName; height?: number }) {
  const id = `buzz-hero-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox="0 0 300 200"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Buzz"
      style={{ display: "block", flexShrink: 0 }}
      // Static markup built from constants in lib/brand/logo.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: heroInner(theme, id) }}
    />
  );
}
