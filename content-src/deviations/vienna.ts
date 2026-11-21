import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { VIENNA_ID } from '../explanations/vienna.ts'

/** Opponent deviations from 2…Sf6 / 2…Sc6 / 2…Lc5; the explanation sits on the position after the deviation. */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: VIENNA_ID, line: 'e4 e5 Nc3 d5', at: 4, reply: 'd5', answer: 'Nxd5', title: '2…d5: deine Antwort 3. Sxd5', best: ['Nxd5'],
    text: '2…d5 greift e4 an. Nach 3. Sxd5 kann die Dame nicht zurücknehmen, weil der Bauer e4 das Feld d5 deckt; Weiß hat einen Bauern mehr (8 gegen 7).' },
  { v: VIENNA_ID, line: 'e4 e5 Nc3 g6', at: 4, reply: 'g6', answer: 'd4', title: '2…g6: deine Antwort 3. d4', best: ['d4'],
    text: '2…g6 bereitet das Läuferfianchetto vor. 3. d4 greift e5 an und baut das Zentrum auf.' },
  { v: VIENNA_ID, line: 'e4 e5 Nc3 Bb4', at: 4, reply: 'Bb4', answer: 'Nd5', title: '2…Lb4: deine Antwort 3. Sd5', best: ['Nd5', 'd4'],
    text: 'Der Läufer b4 greift den Springer c3 an. Der Springer zieht mit Angriff auf den Läufer b4 nach d5; die Engine zählt auch 3. d4 zu den besten Zügen.' },
]

export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('vienna', DEVIATION_SPECS, offset)
export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
