import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { moveFacts, quipCategories } from '../src/teacher/quip-events.ts'
import { gameStatus } from '../src/chess/status.ts'

const START = new Chess().fen()
const over = (uci: string[], from = START) => gameStatus(from, uci)
const ctx = { mine: true, check: false, status: { over: false } as ReturnType<typeof gameStatus>, rating: null, note: null }

test('moveFacts: German move, piece and accusative form from the real position', () => {
  assert.deepEqual(moveFacts(START, 'g1f3'), { zug: 'Sf3', figur: 'Springer', figur_akk: 'den Springer' })
  assert.deepEqual(moveFacts(START, 'e2e4'), { zug: 'e4', figur: 'Bauer', figur_akk: 'den Bauern' })
})

test('moveFacts: a discovered check names no piece (the moved piece is not the one giving check)', () => {
  // white bishop e2 moves away, the rook e1 checks the king e8
  const fen = '4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1'
  assert.deepEqual(moveFacts(fen, 'e2d3'), { zug: 'Ld3+' })
  // the moved rook itself gives check: named
  assert.equal(moveFacts('4k3/8/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8').figur, 'Turm')
})

test('moveFacts: illegal move gives no facts', () => {
  assert.deepEqual(moveFacts(START, 'e2e5'), {})
})

test('own mate: matt_gesetzt only', () => {
  const s = over(['f2f3', 'e7e5', 'g2g4', 'd8h4'])
  assert.deepEqual(quipCategories({ ...ctx, mine: false, status: s }), ['matt_bekommen'])
  assert.deepEqual(quipCategories({ ...ctx, mine: true, status: s }), ['matt_gesetzt'])
})

test('a draw is patt_remis for either side', () => {
  const s = { over: true, reason: 'patt', winner: null } as const
  assert.deepEqual(quipCategories({ ...ctx, status: s }), ['patt_remis'])
  assert.deepEqual(quipCategories({ ...ctx, mine: false, status: s }), ['patt_remis'])
})

test('own move: Patzer beats check beats praise; mistakes come first', () => {
  assert.deepEqual(quipCategories({ ...ctx, rating: 'patzer', check: true })[0], 'patzer')
  assert.deepEqual(quipCategories({ ...ctx, rating: 'best', check: true }).slice(0, 2), ['schach_gegeben', 'bester_zug'])
})

test('own move: repertoire note joins the list', () => {
  assert.ok(quipCategories({ ...ctx, rating: 'gut', note: { kind: 'treffer', san: 'e4' } }).includes('repertoire_treffer'))
  assert.ok(quipCategories({ ...ctx, rating: 'gut', note: { kind: 'abweichung', plannedSan: 'e4' } }).includes('repertoire_abweichung'))
})

test('opponent move: leaving the theory, otherwise nothing', () => {
  assert.deepEqual(quipCategories({ ...ctx, mine: false, note: { kind: 'gegner' } }), ['gegner_verlaesst_theorie'])
  assert.deepEqual(quipCategories({ ...ctx, mine: false }), [])
})

test('no rating, no note, no check on own move: nothing', () => {
  assert.deepEqual(quipCategories(ctx), [])
})
