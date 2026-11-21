import type { GameAnalysis } from './build.ts'
import { MEANING, NAME, SYMBOL } from './category.ts'
import type { Category } from './category.ts'
import { positionSign } from './nag.ts'
import type { Sign } from './nag.ts'

export const SIGN_WORDS: Record<Sign, string> = {
  '=': 'ausgeglichen', '⩲': 'Weiß steht etwas besser', '⩱': 'Schwarz steht etwas besser', '±': 'Weiß steht besser', '∓': 'Schwarz steht besser',
  '+−': 'Weiß steht auf Gewinn', '−+': 'Schwarz steht auf Gewinn',
}

/** For the move list: the symbol after each move, its category and a hover text (meaning, position sign after the move). Keys are 1-based like the list. */
export function moveLabels(a: GameAnalysis): { nags: Record<number, string>; cats: Record<number, Category>; titles: Record<number, string> } {
  const nags: Record<number, string> = {}
  const cats: Record<number, Category> = {}
  const titles: Record<number, string> = {}
  a.moves.forEach((m, i) => {
    if (m.cat) { nags[i + 1] = SYMBOL[m.cat]; cats[i + 1] = m.cat }
    const pos = a.positions[i + 1]
    const sign = pos ? positionSign(pos) : null
    const parts = [m.cat ? `${SYMBOL[m.cat]} ${NAME[m.cat]}: ${MEANING[m.cat]}` : '', sign ? `${sign} ${SIGN_WORDS[sign]}` : ''].filter(Boolean)
    if (parts.length) titles[i + 1] = parts.join(' · ')
  })
  return { nags, cats, titles }
}
