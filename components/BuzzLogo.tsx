import { useId } from "react";
import { logoInner, type LogoThemeName } from "@/lib/brand/logo";

export interface BuzzLogoProps {
  size?: number;
  theme?: LogoThemeName;
  /** The burst and sparkles behind the letters. Off by default below 48px, where they turn to noise. */
  sparks?: boolean;
}

/** The Buzz "B!" logo (original art, ADR 0006). The drawing lives in lib/brand/logo.ts, which also builds the app icon. */
export function BuzzLogo({ size = 16, theme = "classic", sparks }: BuzzLogoProps) {
  // useId returns ":r1:"; colons are not valid in url(#...) references.
  const id = `buzz-logo-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Buzz"
      style={{ flexShrink: 0 }}
      // Static markup built from constants in lib/brand/logo.ts; no user input reaches it.
      dangerouslySetInnerHTML={{ __html: logoInner(theme, sparks ?? size >= 48, id) }}
    />
  );
}
