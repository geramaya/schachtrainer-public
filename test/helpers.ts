import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import type { ContentBundle, TreeNode, Variation } from '../src/content/types.ts'

const source = { kind: 'autor' as const, ref: 'test' }
const cand = (fen: string, san: string) => {
  const m = new Chess(fen).move(san)
  return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, evalCp: null, source }
}

/** Bundle with one variation; `own` = SAN of the repertoire side per ply (even plies = white), opponent plies list known replies. */
export function lineBundle(line: string[], ownIsWhite = true, extraReplies: Record<number, string[]> = {}, lineLen = line.length, openingId = 'scotch', variationId = 'v1'): ContentBundle {
  const nodes: Record<string, TreeNode> = {}
  const c = new Chess()
  for (let i = 0; i <= line.length; i++) {
    const fen = c.fen()
    const key = positionKey(fen)
    const own = (i % 2 === 0) === ownIsWhite
    if (i < line.length) {
      nodes[key] ??= own
        ? { key, fen, ownMove: true, candidates: [cand(fen, line[i]!)], active: 0, replies: [] }
        : { key, fen, ownMove: false, candidates: [], active: 0, replies: [cand(fen, line[i]!), ...(extraReplies[i] ?? []).map((s) => cand(fen, s))] }
      c.move(line[i]!)
    }
  }
  const variation: Variation = { id: variationId, name: 'V1', nameEn: 'V1', line: line.slice(0, lineLen), keyPositions: [], fromDocument: true }
  return {
    contentVersion: 'c1',
    openings: [{ id: openingId as never, name: 'T', side: ownIsWhite ? 'white' : 'black', entry: [], role: '', docRef: '', variations: [variation] }],
    schemaVersion: 3, trees: { [openingId]: nodes }, explanations: [], questions: [], deviations: [], puzzles: {},
  }
}
export const keyAfter = (line: string[]) => { const c = new Chess(); for (const s of line) c.move(s); return positionKey(c.fen()) }
