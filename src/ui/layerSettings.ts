export type LayerId = 'hanging' | 'counts' | 'control' | 'threats' | 'reach'
export type LayerSettings = Record<LayerId, boolean>

/** The optional board layers, in the order of the menu. */
export const LAYERS: { id: LayerId; label: string; hint: string }[] = [
  { id: 'hanging', label: 'Hängende Figuren', hint: 'Ring um Figuren, die angegriffen und ungedeckt sind oder von einer billigeren Figur angegriffen werden' },
  { id: 'counts', label: 'Angreifer und Verteidiger', hint: 'Zahl an jeder Figur: Angreifer / Verteidiger' },
  { id: 'control', label: 'Feldkontrolle', hint: 'Blau: du kontrollierst das Feld mehrfach, Rot: der Gegner (je dunkler, desto größer der Unterschied)' },
  { id: 'threats', label: 'Drohungen', hint: 'Pfeile: was die Seite ohne Zug als Nächstes drohen würde (Nullzug, mit Stockfish)' },
  { id: 'reach', label: 'Angriffsfelder', hint: 'Maus über eine Figur oder antippen: die Felder, die sie angreift' },
]

/** In an open exercise these would give away the answer (what hangs, who controls what); threats and reach do not. */
export const TASK_LOCKED: LayerId[] = ['hanging', 'counts', 'control']

const OFF: LayerSettings = { hanging: false, counts: false, control: false, threats: false, reach: false }

/** Tolerant: anything that is not a stored boolean of a known layer stays off. */
export function parseLayerSettings(raw: string | null): LayerSettings {
  if (!raw) return { ...OFF }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return Object.fromEntries(LAYERS.map((l) => [l.id, o[l.id] === true])) as LayerSettings
  } catch { return { ...OFF } }
}

/** false = free; true = open exercise (answer-revealing layers off); 'all' = Wertungspartie (every layer off). */
export type LayerLock = boolean | 'all'
export const isLocked = (id: LayerId, lock: LayerLock): boolean => lock === 'all' || (lock === true && TASK_LOCKED.includes(id))

export function activeLayers(s: LayerSettings, lock: LayerLock): Set<LayerId> {
  return new Set(LAYERS.filter((l) => s[l.id] && !isLocked(l.id, lock)).map((l) => l.id))
}
