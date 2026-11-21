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
