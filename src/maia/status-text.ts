import type { MaiaStatus } from './client.ts'
import { MODEL_BYTES } from './load.ts'

const mb = (bytes: number): number => Math.round(bytes / 1_000_000)

/** The line the page shows for the state of Maia (loading bar text, check, ready, error with the fallback hint). */
export function loadingText(s: MaiaStatus): string {
  switch (s.state) {
    case 'idle': return `Maia lädt beim Start (${mb(MODEL_BYTES)} MB, einmalig).`
    case 'loading': return s.phase === 'verify' ? 'Modell wird geprüft …' : `Maia wird geladen … ${mb(s.loaded)} von ${mb(s.total || MODEL_BYTES)} MB (${Math.floor((s.loaded / (s.total || MODEL_BYTES)) * 100)} %)`
    case 'ready': return 'Maia bereit'
    case 'error': return 'Maia konnte nicht geladen werden. Stockfish spielt stattdessen.'
  }
}

/** How long "Maia bereit" stays visible after loading. */
export const READY_SHOWN_MS = 3000
export type MaiaStatusMode = 'full' | 'line' | 'none'

/**
 * How much room the Maia state takes: the full block (text, bar, button; fixed height) while loading, checking or failed -
 * and in the setup while idle (the "preload" offer); "ready" is one short line for READY_SHOWN_MS, then gone.
 */
export function maiaStatusMode(s: MaiaStatus, o: { setup: boolean; readyShownMs: number }): MaiaStatusMode {
  switch (s.state) {
    case 'loading': case 'error': return 'full'
    case 'idle': return o.setup ? 'full' : 'none'
    case 'ready': return o.readyShownMs < READY_SHOWN_MS ? 'line' : 'none'
  }
}
