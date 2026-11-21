import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { TARRASCH_DEV_SRC, TARRASCH_IDS, TARRASCH_LINES as L } from '../explanations/tarrasch.ts'

/**
 * What White plays instead of 3. Sc3. The document names no reply: the answer is the engine best move (assumption).
 * The explanation sits on the position after the deviation.
 */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: TARRASCH_IDS.R, line: L.dev1, at: 5, reply: 'Nf3', answer: 'Nf6', title: '3. Sf3: deine Antwort 3…Sf6', best: ['Nf6', 'dxc4'], source: TARRASCH_DEV_SRC,
    text: 'Weiß lässt 3. Sc3 aus. Dein Dokument nennt für 3. Sf3 keine Antwort; die Engine zählt 3…Sf6 und 3…dxc4 zu den besten Zügen. Dein Vorschlag: 3…Sf6.' },
  { v: TARRASCH_IDS.R, line: L.dev2, at: 5, reply: 'e3', answer: 'Nf6', title: '3. e3: deine Antwort 3…Sf6', best: ['Nf6'], source: TARRASCH_DEV_SRC,
    text: 'Weiß stützt d4 mit dem Bauern e3 und blockiert den Läufer c1. Dein Dokument nennt für 3. e3 keine Antwort; die Engine zählt 3…Sf6 zu den besten Zügen. Dein Vorschlag: 3…Sf6.' },
]

export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('tarrasch', DEVIATION_SPECS, offset)
export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
