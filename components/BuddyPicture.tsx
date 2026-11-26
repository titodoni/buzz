"use client"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)
  return letters.toUpperCase()
}

/** A small square picture for the Buddy List, like classic buddy icons. Falls back to initials. */
export function BuddyPicture({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  const box = {
    width: size,
    height: size,
    flexShrink: 0,
    border: "1px solid #b8b2c9",
    borderRadius: 2,
    background: "#ffffff",
    padding: 1,
    boxShadow: "0 1px 1px rgb(0 0 0 / 0.08)",
    boxSizing: "border-box",
  } as const
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar in a static export
      <img src={url} alt="" width={size} height={size} style={{ ...box, objectFit: "cover" }} />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{
        ...box,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom, var(--ym-purple), var(--ym-purple-deep))",
        color: "var(--titlebar-text)",
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
      }}
    >
      {initials(name)}
    </span>
  )
}
