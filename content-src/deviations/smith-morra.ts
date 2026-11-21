import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { SMITH_MORRA_IDS } from '../explanations/smith-morra.ts'

/** Opponent deviation from 2…cxd4; the explanation sits on the position after the deviation. */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: SMITH_MORRA_IDS.G, line: 'e4 c5 d4 d5', at: 4, reply: 'd5', answer: 'exd5', title: '2…d5: deine Antwort 3. exd5', best: ['exd5'],
    text: 'Schwarz greift mit dem Bauern d5 den Bauern e4 an, statt auf d4 zu schlagen. 3. exd5 gewinnt einen Bauern; das Repertoire nimmt ihn und bleibt im Zentrum.' },
]

export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('smith-morra', DEVIATION_SPECS, offset)
export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
