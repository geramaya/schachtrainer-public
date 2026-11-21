import { BASE } from '../ui/assetBase.ts'
import { parseEcoTable } from './eco.ts'
import type { EcoTable } from './eco.ts'

let cached: Promise<EcoTable | null> | null = null

/** Loads public/eco/eco.json once, when it is needed; null if it is missing or broken (games are then completed later). */
export function loadEco(): Promise<EcoTable | null> {
  cached ??= fetch(`${BASE}eco/eco.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => parseEcoTable(j))
    .catch(() => null)
    .then((t) => { if (!t) cached = null; return t })
  return cached
}
