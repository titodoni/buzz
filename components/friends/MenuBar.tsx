"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"

export interface MenuItemDef {
  label: string
  onSelect: () => void
  /** Set for an on/off item: it is announced as a checkbox and shows a tick when on. */
  checked?: boolean
  /** Key hint shown on the right, e.g. "F3". The caller handles the key itself. */
  shortcut?: string
  disabled?: boolean
}
export interface MenuDef {
  label: string
  items: MenuItemDef[]
}

/** Simple accessible menu bar. Click or Down opens, Enter picks, Escape closes, arrows move. */
export function MenuBar({ menus, label = "Main menu" }: { menus: MenuDef[]; label?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openIndex === null) return
    rootRef.current?.querySelector<HTMLElement>("[role=menu] [role=menuitem], [role=menu] [role=menuitemcheckbox]")?.focus()
    const onDown = (e: MouseEvent) => {
      // event targets are typed EventTarget; a mousedown target is always a Node
      if (!rootRef.current?.contains(e.target as Node)) setOpenIndex(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [openIndex])

  function onMenuKeyDown(e: KeyboardEvent<HTMLUListElement>, i: number) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem], [role=menuitemcheckbox]"))
    const at = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1
    if (e.key === "Escape") {
      e.preventDefault()
      setOpenIndex(null)
      rootRef.current?.querySelectorAll<HTMLElement>("[aria-haspopup]")[i]?.focus()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      items[(at + 1) % items.length]?.focus()
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      items[(at - 1 + items.length) % items.length]?.focus()
    }
  }

  return (
    <div ref={rootRef} role="menubar" aria-label={label} className="ym-menubar flex flex-wrap border-b">
      {menus.map((m, i) => (
        <div key={m.label} className="ym-menu-item">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openIndex === i}
            className="ym-row cursor-pointer border-0 bg-transparent px-2 py-1"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setOpenIndex(i)
              } else if (e.key === "Escape") setOpenIndex(null)
            }}
          >
            {m.label}
          </button>
          {openIndex === i ? (
            <ul
              role="menu"
              aria-label={m.label}
              className="ym-dropdown m-0 list-none border p-0 shadow"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                // As wide as its longest item, but never wider than the window.
                width: "max-content",
                minWidth: "min(190px, calc(100vw - 8px))",
                maxWidth: "calc(100vw - 8px)",
                background: "var(--window-bg)",
                zIndex: 50,
              }}
              onKeyDown={(e) => onMenuKeyDown(e, i)}
            >
              {m.items.map((item) => (
                <li key={item.label} role="none">
                  <button
                    role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                    aria-checked={item.checked}
                    aria-disabled={item.disabled || undefined}
                    type="button"
                    className="ym-row flex w-full cursor-pointer items-center border-0 bg-transparent px-3 py-1 text-left"
                    style={item.disabled ? { color: "var(--text-muted)", cursor: "default" } : undefined}
                    onClick={() => {
                      if (item.disabled) return
                      setOpenIndex(null)
                      item.onSelect()
                    }}
                  >
                    {/* Fixed-width tick column, so the label never moves when toggled. */}
                    <span aria-hidden="true" className="inline-block w-4 shrink-0">
                      {item.checked ? "✓" : ""}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut ? (
                      <span className="pl-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}
