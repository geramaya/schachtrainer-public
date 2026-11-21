import { Chess } from 'chess.js'
import { positionKey } from '../../src/chess/position.ts'
import type { Explanation, Variation } from '../../src/content/types.ts'

/**
 * Key positions of a variation = positions along its line that carry an explanation (in line order), plus the
 * end position. The lesson of a variation is exactly the explanations at these keys.
 */
export function withLessonKeys(variations: Variation[], explanations: Explanation[]): Variation[] {
  const explained = new Set(explanations.map((e) => e.key))
  return variations.map((v) => {
    const g = new Chess()
    const keys: string[] = []
    for (const san of v.line) {
      g.move(san)
      const k = positionKey(g.fen())
      if (explained.has(k)) keys.push(k)
    }
    const end = positionKey(g.fen())
    return { ...v, keyPositions: keys.includes(end) ? keys : [...keys, end] }
  })
}
