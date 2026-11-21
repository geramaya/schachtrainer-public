import type { ContentBundle } from './types.ts'
import { checkBundle } from './schema.ts'
import { EngineError } from '../engine/service.ts'
import { assetUrl } from '../ui/asset-url.ts'

/** Fetches and checks the content bundle; every failure is an Error with a message meant for the page (no raw parser or network text). */
export async function fetchBundle(fetchFn: typeof fetch, base = '/'): Promise<ContentBundle> {
  let res: Response
  try { res = await fetchFn(assetUrl('content/bundle.json', base)) } catch { throw new Error('Die Inhalte sind nicht erreichbar. Läuft der Server, und besteht eine Verbindung?') }
  if (!res.ok) throw new Error(`Die Inhalte konnten nicht geladen werden (HTTP ${res.status}).`)
  let data: unknown
  try { data = await res.json() } catch { throw new Error('Die Inhaltsdatei ist nicht lesbar (der Server lieferte keine gültige Datei, z. B. eine Fehlerseite).') }
  const b = checkBundle(data)
  if (!Array.isArray(b.openings) || typeof b.trees !== 'object' || b.trees === null) throw new Error('Die Inhaltsdatei ist unvollständig. Bitte Inhalte neu bauen (npm run build:content).')
  return b
}

/** Text for the page when Stockfish fails (worker file missing, blocked, hung); the raw message belongs in a tooltip, not in the sentence. */
export function engineErrorText(e: unknown): string {
  if (e instanceof EngineError) return 'Stockfish ist nicht erreichbar. Fehlen die Engine-Dateien (npm run engine), oder hat der Browser sie blockiert?'
  return e instanceof Error ? e.message : String(e)
}
