import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { ALAPIN_ID } from '../explanations/alapin.ts'

/** Opponent deviations from 2…d5 / 2…Sf6; the explanation sits on the position after the deviation. */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: ALAPIN_ID, line: 'e4 c5 c3 d6', at: 4, reply: 'd6', answer: 'd4', title: '2…d6: deine Antwort 3. d4', best: ['d4'],
    text: 'Schwarz weicht von 2…d5 und 2…Sf6 ab. 3. d4 setzt den Plan fort: Weiß baut das Zentrum mit Bauern auf d4 und e4.' },
  { v: ALAPIN_ID, line: 'e4 c5 c3 e6', at: 4, reply: 'e6', answer: 'd4', title: '2…e6: deine Antwort 3. d4', best: ['d4'],
    text: 'Mit 2…e6 bereitet Schwarz …d5 vor. 3. d4 baut sofort das Zentrum mit Bauern auf d4 und e4 auf.' },
  { v: ALAPIN_ID, line: 'e4 c5 c3 Nc6', at: 4, reply: 'Nc6', answer: 'd4', title: '2…Sc6: deine Antwort 3. d4', best: ['d4'],
    text: 'Der Springer c6 und der Bauer c5 greifen das Feld d4 an; nach 3. d4 ist der Bauer durch c3 und die Dame d1 gedeckt (zwei Angreifer, zwei Verteidiger).' },
  { v: ALAPIN_ID, line: 'e4 c5 c3 g6', at: 4, reply: 'g6', answer: 'd4', title: '2…g6: deine Antwort 3. d4', best: ['d4'],
    text: '2…g6 bereitet das Läuferfianchetto vor. 3. d4 baut das Zentrum auf und greift c5 an.' },
]

export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('alapin', DEVIATION_SPECS, offset)
export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
