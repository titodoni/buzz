// Original short alert sounds made with Web Audio, like the Buzz! sound:
// nothing is copied or sampled from any other messenger (docs/adr/0006).
import { getAudioContext } from "../nudge/effects"

interface Note {
  /** Pitch in Hz. */
  freq: number
  /** Start, in seconds after the sound begins. */
  at: number
  /** Length in seconds. */
  dur: number
}

function playNotes(notes: readonly Note[], type: OscillatorType, peak: number): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined)
    const t0 = ctx.currentTime + 0.01
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(n.freq, t0 + n.at)
      // Quick attack, smooth release, so there are no clicks.
      gain.gain.setValueAtTime(0, t0 + n.at)
      gain.gain.linearRampToValueAtTime(peak, t0 + n.at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0 + n.at)
      osc.stop(t0 + n.at + n.dur + 0.02)
    }
  } catch {
    // Sound is a nicety; never let it break the app.
  }
}

/** A message arrived: two quick rising notes (Req 16.1, 16.2). */
export function playMessageSound(): void {
  playNotes(
    [
      { freq: 880, at: 0, dur: 0.09 },
      { freq: 1175, at: 0.1, dur: 0.14 },
    ],
    "triangle",
    0.18,
  )
}

/** A friend came online: a soft three-note chime (Req 16.4). */
export function playOnlineSound(): void {
  playNotes(
    [
      { freq: 523, at: 0, dur: 0.12 },
      { freq: 659, at: 0.11, dur: 0.12 },
      { freq: 784, at: 0.22, dur: 0.22 },
    ],
    "sine",
    0.16,
  )
}

/** Signed in: a short upward sweep of two notes. */
export function playSignInSound(): void {
  playNotes(
    [
      { freq: 392, at: 0, dur: 0.12 },
      { freq: 784, at: 0.12, dur: 0.2 },
    ],
    "sine",
    0.14,
  )
}
