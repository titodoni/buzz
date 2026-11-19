import { isTauri } from "../tauri/windows";
import { NUDGE_SHAKE_MS } from "./cooldown";

let audioCtx: AudioContext | null = null;
let osShakeRunning = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    // Cast: older WebKit exposes only the prefixed constructor, absent from lib.dom types.
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

/** Original short buzz (~0.45 s): low sawtooth with a fast tremolo. */
export function playNudgeSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const t0 = ctx.currentTime;
    const dur = 0.45;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(170, t0);
    osc.frequency.linearRampToValueAtTime(150, t0 + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    env.gain.setValueAtTime(0.35, t0 + dur - 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    // Tremolo: LFO modulates a gain stage around 0.5.
    const trem = ctx.createGain();
    trem.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 28;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(trem.gain);

    osc.connect(trem).connect(env).connect(ctx.destination);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  } catch {
    // Sound is best-effort.
  }
}

const OFFSETS = [-8, 8, -7, 7, -5, 5, -3, 3, -1, 1];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shakeOsWindow(): Promise<void> {
  if (osShakeRunning) return;
  osShakeRunning = true;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const { PhysicalPosition } = await import("@tauri-apps/api/dpi");
    const win = getCurrentWindow();
    let maximized = false;
    try {
      maximized = await win.isMaximized();
    } catch {
      // Permission missing: assume not maximized.
    }
    if (maximized) return;
    const origin = await win.outerPosition();
    try {
      const step = NUDGE_SHAKE_MS / OFFSETS.length;
      for (const dx of OFFSETS) {
        await win.setPosition(new PhysicalPosition(origin.x + dx, origin.y));
        await sleep(step);
      }
    } finally {
      await win.setPosition(new PhysicalPosition(origin.x, origin.y));
    }
  } catch {
    // Shaking is cosmetic.
  } finally {
    osShakeRunning = false;
  }
}

function shakeElement(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.remove("ym-shake");
  void el.offsetWidth; // restart the animation
  el.classList.add("ym-shake");
  window.setTimeout(() => el.classList.remove("ym-shake"), NUDGE_SHAKE_MS);
}

export async function shakeChatWindow(el: HTMLElement | null): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    shakeElement(el);
    if (isTauri() && !prefersReducedMotion()) await shakeOsWindow();
  } catch {
    // never throw
  }
}
