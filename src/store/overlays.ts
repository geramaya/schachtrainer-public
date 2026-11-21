/** Own move choice of the user per positionKey (uci). */
export type Overlays = Record<string, string>
/** One overlay map per opening id. Until a bundle is known, an old file may carry the legacy groups "white"/"black" (see migrateProgress). */
export type OpeningOverlays = Record<string, Overlays>

export function setOwnMove(ov: OpeningOverlays, openingId: string, key: string, uci: string): OpeningOverlays {
  return { ...ov, [openingId]: { ...ov[openingId], [key]: uci } }
}

export function clearOwnMove(ov: OpeningOverlays, openingId: string, key: string): OpeningOverlays {
  const rest = { ...ov[openingId] }
  delete rest[key]
  return { ...ov, [openingId]: rest }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const allStrings = (v: Record<string, unknown>): v is Overlays => Object.values(v).every((u) => typeof u === 'string')

/** Accepts the per-opening form as it is; the oldest flat form is grouped by the side to move in the position key ("white"/"black"). Throws on anything else. */
export function migrateOverlays(raw: unknown): OpeningOverlays {
  const bad = new Error('Die eigenen Züge in der Datei sind beschädigt')
  if (!isRecord(raw)) throw bad
  const values = Object.values(raw)
  if (values.every(isRecord)) {
    if (!values.every((v) => allStrings(v as Record<string, unknown>))) throw bad
    return raw as OpeningOverlays
  }
  if (!allStrings(raw)) throw bad
  const out: OpeningOverlays = { white: {}, black: {} }
  for (const [key, uci] of Object.entries(raw)) out[key.split(' ')[1] === 'b' ? 'black' : 'white']![key] = uci
  return out
}
