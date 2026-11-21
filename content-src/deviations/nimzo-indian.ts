import type { Deviation, Explanation } from '../../src/content/types.ts'
import { buildDeviationsFor, deviationExplanationsFor } from '../builders.ts'
import type { DeviationSpec } from '../builders.ts'
import { NIMZO_DEV_SRC, NIMZO_IDS, NIMZO_LINES as L } from '../explanations/nimzo-indian.ts'

/**
 * What White plays instead of 3. Sc3. The document names no reply: the answer is the engine best move (assumption).
 * The explanation sits on the position after the deviation.
 */
export const DEVIATION_SPECS: DeviationSpec[] = [
  { v: NIMZO_IDS.R, line: L.dev1, at: 5, reply: 'Nf3', answer: 'd5', title: '3. Sf3: deine Antwort 3…d5', best: ['d5', 'Be7', 'b6'], source: NIMZO_DEV_SRC,
    text: 'Weiß lässt 3. Sc3 aus. Der Läufer b4 würde hier Schach geben, weil c3 und d2 frei sind. Dein Dokument nennt für 3. Sf3 keine Antwort; die Engine zählt 3…d5, 3…Le7 und 3…b6 zu den besten Zügen. Dein Vorschlag: 3…d5.' },
  { v: NIMZO_IDS.R, line: L.dev2, at: 5, reply: 'g3', answer: 'd5', title: '3. g3: deine Antwort 3…d5', best: ['d5', 'Be7', 'Bb4+'], source: NIMZO_DEV_SRC,
    text: 'Weiß fianchettiert den Läufer, statt den Springer zu entwickeln. Der Läufer b4 würde hier Schach geben. Dein Dokument nennt für 3. g3 keine Antwort; die Engine zählt 3…d5, 3…Le7 und 3…Lb4+ zu den besten Zügen. Dein Vorschlag: 3…d5.' },
]

/** Explanations of the deviations (ids continue after the variation explanations of the root variation). */
export const deviationExplanations = (offset: number): Explanation[] => deviationExplanationsFor('nimzo-indian', DEVIATION_SPECS, offset)

export const buildDeviations = (explanations: Explanation[]): Deviation[] => buildDeviationsFor(explanations, DEVIATION_SPECS)
