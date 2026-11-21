// Generates mini-bundle.json with chess.js (no hand-typed FENs/UCI).
// Run: node test/fixtures/make-mini-bundle.ts
import { Chess } from 'chess.js'
import { writeFileSync } from 'node:fs'
import { positionKey } from '../../src/chess/position.ts'
import type { ContentBundle, Candidate, TreeNode, Source } from '../../src/content/types.ts'

const source: Source = { kind: 'autor', ref: 'fixture' }
const game = new Chess()
const nodes: Record<string, TreeNode> = {}
const line = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']
const mover = (san: string): Candidate => {
  const c = new Chess(game.fen())
  const m = c.move(san)
  return { uci: m.from + m.to + (m.promotion ?? ''), san: m.san, evalCp: null, source }
}
// white's turn on plies 0,2,4,6; black's on odd plies
for (let i = 0; i <= line.length; i++) {
  const key = positionKey(game.fen())
  const whiteToMove = i % 2 === 0
  if (i === line.length) {
    nodes[key] = { key, fen: game.fen(), ownMove: true,
      candidates: [mover('Nxd4'), mover('Bc4')], active: 0, replies: [] }
  } else if (whiteToMove) {
    nodes[key] = { key, fen: game.fen(), ownMove: true, candidates: [mover(line[i]!)], active: 0, replies: [] }
  } else {
    nodes[key] = { key, fen: game.fen(), ownMove: false, candidates: [], active: 0, replies: [mover(line[i]!)] }
  }
  if (i < line.length) game.move(line[i]!)
}
const bundle: ContentBundle = {
  contentVersion: 'fixture-1',
  schemaVersion: 3, openings: [], trees: { scotch: nodes }, explanations: [], questions: [], deviations: [], puzzles: {},
}
writeFileSync(new URL('./mini-bundle.json', import.meta.url), JSON.stringify(bundle, null, 2) + '\n')
