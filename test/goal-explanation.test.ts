import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { positionKey } from '../src/chess/position.ts'
import { goalExplanations, goalText } from '../tools/lib/goal-explanation.ts'

const play = (sans: string[]) => {
  const g = new Chess()
  for (const s of sans) g.move(s)
  return g.fen()
}

test('goalText states only countable facts: pawns, developed pieces, castling, open files', () => {
  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d4 exd4 6. e5
  const t = goalText(play('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d4 exd4 e5'.split(' ')))
  assert.match(t, /Weiß hat 7 Bauern, Schwarz 8/)
  assert.match(t, /Weiß hat rochiert/)
  assert.match(t, /Schwarz hat noch nicht rochiert/)
  assert.match(t, /Weiß hat 2 Leichtfiguren entwickelt, Schwarz 3/)
})

test('goalText names an open file', () => {
  const t = goalText(play('e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nxd4 Qxd4 d6'.split(' ')))
  assert.match(t, /offen/)
})

test('goalExplanations: one per variation end, skipping positions that already have an explanation', () => {
  const end1 = play(['e4', 'e5'])
  const end2 = play(['d4', 'd5'])
  const vs = [
    { id: 'a', line: ['e4', 'e5'], keyPositions: [positionKey(end1)] },
    { id: 'b', line: ['d4', 'd5'], keyPositions: [positionKey(end2)] },
  ] as never
  const out = goalExplanations('x', vs, new Set([positionKey(end2)]))
  assert.deepEqual(out.map((e) => e.id), ['x/a/goal'])
  assert.equal(out[0]!.key, positionKey(end1))
  assert.deepEqual(out[0]!.claims, [])
  assert.equal(out[0]!.status, 'entwurf')
})
