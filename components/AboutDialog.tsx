"use client"
import { APP_VERSION } from "@/lib/app/version"
import { BuzzLogo } from "./BuzzLogo"
import { Dialog } from "./Dialog"

/** About Buzz (Req 13.8): version, copyright, and that Buzz is not Yahoo's. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About Buzz" onClose={onClose}>
      <div className="flex flex-col items-center gap-2 p-2 text-center">
        <div
          className="flex w-full items-center justify-center gap-3 rounded-sm border px-3 py-3"
          style={{
            background: "linear-gradient(to bottom, #e5effb, #f6f9fe)",
            borderColor: "#c8d6ea",
          }}
        >
          <BuzzLogo size={48} sparks />
          <div className="text-left leading-none">
            <p
              className="m-0 font-black tracking-tight"
              style={{
                fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif',
                fontSize: 24,
                color: "#5f1f9e",
                textShadow: "1px 1px 0 #d8c8f0",
              }}
            >
              Buzz!
            </p>
            <p
              className="m-0 mt-0.5 font-bold uppercase"
              style={{
                fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif',
                fontSize: 10,
                letterSpacing: 3.2,
                color: "#6b32ad",
              }}
            >
              MESSENGER
            </p>
          </div>
        </div>
        <p className="m-0 text-xs font-bold">Buzz! Messenger ({APP_VERSION})</p>
        <p className="m-0 text-xs">© 2026 the Buzz authors.</p>
        <p className="m-0 text-xs">
          A love letter to classic instant messengers. Buzz is not affiliated with or endorsed by Yahoo.
        </p>
        <button type="button" className="ym-button mt-1 px-7" onClick={onClose}>
          OK
        </button>
      </div>
    </Dialog>
  )
}
