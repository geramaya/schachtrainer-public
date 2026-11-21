import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { CARO_KANN_IDS, CK_LINES } from '../explanations/caro-kann.ts'

/** Opponent deviations from 2. d4; the explanation sits on the position after the deviation. */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: CARO_KANN_IDS.R, line: CK_LINES.dev1, at: 3, reply: 'Nf3', answer: 'd5', title: '2. Sf3: deine Antwort 2…d5', best: ['d5'],
    text: 'Weiß lässt d4 aus. Der Springer f3 deckt e5 und d4, nicht aber e4. Das Repertoire bleibt bei 2…d5 und greift den Bauern e4 sofort an.' },
  { v: CARO_KANN_IDS.R, line: CK_LINES.dev2, at: 3, reply: 'c4', answer: 'd5', title: '2. c4: deine Antwort 2…d5', best: ['d5'],
    text: 'Weiß spielt den Bauern c4 vor d4 (beschleunigter Panov-Angriff). Das Repertoire antwortet auch hier mit 2…d5.' },
  { v: CARO_KANN_IDS.R, line: CK_LINES.dev3, at: 3, reply: 'd3', answer: 'd5', title: '2. d3: deine Antwort 2…d5', best: ['d5'],
    text: 'Weiß baut ohne d4 auf; der Bauer d3 deckt e4. Das Repertoire bleibt bei 2…d5.' },
]

export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('caro-kann', DEVIATION_SPECS, offset)
export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
