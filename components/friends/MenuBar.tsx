"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"

export interface MenuItemDef {
  label: string
  onSelect: () => void
}
export interface MenuDef {
  label: string
  items: MenuItemDef[]
}

/** Simple accessible menu bar. Click or Down opens, Enter picks, Escape closes, arrows move. */
export function MenuBar({ menus }: { menus: MenuDef[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openIndex === null) return
    rootRef.current?.querySelector<HTMLElement>("[role=menu] [role=menuitem]")?.focus()
    const onDown = (e: MouseEvent) => {
      // event targets are typed EventTarget; a mousedown target is always a Node
      if (!rootRef.current?.contains(e.target as Node)) setOpenIndex(null)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [openIndex])

  function onMenuKeyDown(e: KeyboardEvent<HTMLUListElement>, i: number) {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"))
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
    <div ref={rootRef} role="menubar" aria-label="Main menu" className="ym-menubar flex flex-wrap border-b">
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
                minWidth: "min(190px, 100%)",
                background: "var(--window-bg)",
                zIndex: 50,
              }}
              onKeyDown={(e) => onMenuKeyDown(e, i)}
            >
              {m.items.map((item) => (
                <li key={item.label} role="none">
                  <button
                    role="menuitem"
                    type="button"
                    className="ym-row block w-full cursor-pointer border-0 bg-transparent px-3 py-1 text-left"
                    onClick={() => {
                      setOpenIndex(null)
                      item.onSelect()
                    }}
                  >
                    {item.label}
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
