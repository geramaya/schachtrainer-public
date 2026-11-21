import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'

/** Opponent deviations from 2…Sc6; 3. d4 stays. The explanation sits on the position after the deviation. */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: 'scotch-game', line: 'e4 e5 Nf3 d6', at: 4, reply: 'd6', answer: 'd4', title: '2…d6 (Philidor): deine Antwort 3. d4', best: ['d4'],
    text: 'Schwarz weicht von 2…Sc6 ab. Auch hier öffnet 3. d4 das Zentrum sofort; die Schottische Idee bleibt dieselbe.' },
  { v: 'scotch-game', line: 'e4 e5 Nf3 Nf6', at: 4, reply: 'Nf6', answer: 'd4', title: '2…Sf6 (Russisch): deine Antwort 3. d4', best: ['d4'],
    text: 'Gegen das Russische Spiel bleibt das Repertoire bei 3. d4: Das Zentrum wird sofort geöffnet. Andere Züge wie 3. Sxe5 sind spielbar, aber hier ist 3. d4 deine Antwort im Repertoire.' },
]

/** Explanations of the deviations (ids continue after the variation explanations of `scotch-game`). */
export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('scotch', DEVIATION_SPECS, offset)

export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
