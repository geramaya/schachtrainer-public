import { toGermanSan } from '../chess/notation.ts'
import { isTodo } from './types.ts'

export interface MissInput {
  modus: 'gefuehrt' | 'kopf' | 'falle'
  expected: { san: string; uci: string; satz: string }
  played: { san: string; uci: string }
  /** Wrong tries on this position, this one included. */
  attempts: number
  solutionShown: boolean
}
export interface Miss {
  meldung: string
  /** Nachspielen only: points to the hint. */
  tipp: string | null
  /** Start and target square of the wrong move (red frames). */
  felder: string[]
  richtig: string | null
  satz: string | null
  /** UCI of the green arrow; set only once the answer is revealed. */
  pfeil: string | null
}

/** Wrong moves in "Aus dem Kopf" and in the traps reveal the answer from the 2nd miss or on request; Nachspielen points to the hint instead. */
export const REVEAL_AFTER = 2

export function missFeedback(i: MissInput): Miss {
  const reveal = i.modus !== 'gefuehrt' && (i.solutionShown || i.attempts >= REVEAL_AFTER)
  return {
    meldung: `${toGermanSan(i.played.san)} ist hier nicht dein Zug.`,
    tipp: i.modus === 'gefuehrt' ? 'Tipp: H für einen Hinweis' : null,
    felder: [i.played.uci.slice(0, 2), i.played.uci.slice(2, 4)],
    richtig: reveal ? `Richtig war ${toGermanSan(i.expected.san)}` : null,
    satz: reveal && !isTodo(i.expected.satz) ? i.expected.satz : null,
    pfeil: reveal ? i.expected.uci : null,
  }
}
