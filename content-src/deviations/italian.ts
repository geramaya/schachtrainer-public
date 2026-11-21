import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { ROWS } from '../explanations/italian.ts'

const ROOT = 'italian-game'

/**
 * Opponent deviations after 3. Lc4 (not 3…Lc5 / 3…Sf6). Their explanations are the rows of the named lines
 * (same position), so nothing is added to the explanation list: the drill only points at them.
 */
const dev = (variation: string, reply: string, answer: string): DeviationSpec => {
  const r = ROWS.find((x) => x.spec.v === `${ROOT}-${variation}`)
  if (!r) throw new Error(`Italian: Zeile ${variation} fehlt`)
  return { ...r.spec, v: ROOT, reply, answer }
}

export const DEVIATION_SPECS: DeviationSpec[] = [
  dev('paris-defense', 'd6', 'c3'),
  dev('hungarian-defense', 'Be7', 'd4'),
  dev('anti-fried-liver-defense', 'h6', 'd4'),
  dev('rousseau-gambit', 'f5', 'd4'),
  dev('blackburne-kostic-gambit', 'Nd4', 'Nxd4'),
]

export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
