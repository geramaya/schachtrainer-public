import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { bookExit, cardsFromErrors, classify, severityOf, drawAccepted, evaluatePositions, gameFens, reviewErrors, scoreCp, toWhiteCp } from '../src/train/review.ts'
import { positionKey } from '../src/chess/position.ts'
import { lineBundle } from './helpers.ts'
import { fakeEngine } from './fake-engine.ts'

test('classify reports a Patzer at the user move that drops 210 cp', () => {
  assert.deepEqual(classify([20, 30, -180, -170], 'white'), [{ ply: 2, lossCp: 210, severity: 'patzer' }])
})

test('classify thresholds: 49 none, 50 ungenau, 100 fehler, 200 patzer', () => {
  assert.deepEqual(classify([-49], 'white'), [])
  assert.equal(classify([-50], 'white')[0]!.severity, 'ungenau')
  assert.equal(classify([-99], 'white')[0]!.severity, 'ungenau')
  assert.equal(classify([-100], 'white')[0]!.severity, 'fehler')
  assert.equal(classify([-199], 'white')[0]!.severity, 'fehler')
  assert.equal(classify([-200], 'white')[0]!.severity, 'patzer')
})

test('classify judges black by the rise of the white evaluation, only on black plies', () => {
  assert.deepEqual(classify([0, 120, 120, 100], 'black'), [{ ply: 1, lossCp: 120, severity: 'fehler' }])
})

test('classify treats mate scores as plus/minus 10000 and uses startCp as the baseline', () => {
  assert.deepEqual(classify([10000, 10000, -10000], 'white'), [{ ply: 2, lossCp: 20000, severity: 'patzer' }])
  assert.deepEqual(classify([-100], 'white', 100), [{ ply: 0, lossCp: 200, severity: 'patzer' }])
})

test('classify honours the side that moves first (game from a black-to-move position)', () => {
  // ply 0 is black's move: 0 -> 150 is a loss for black; ply 1 is white's
  assert.deepEqual(classify([150, 150], 'black', 0, 'black'), [{ ply: 0, lossCp: 150, severity: 'fehler' }])
})

test('toWhiteCp flips the sign for black to move; scoreCp turns mate into plus/minus 10000', () => {
  assert.equal(toWhiteCp(50, 'white'), 50)
  assert.equal(toWhiteCp(50, 'black'), -50)
  assert.equal(scoreCp({ cp: 35, mate: null }), 35)
  assert.equal(scoreCp({ cp: null, mate: 3 }), 10000)
  assert.equal(scoreCp({ cp: null, mate: -2 }), -10000)
  assert.equal(scoreCp({ cp: null, mate: 0 }), -10000)
})

const book = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], true, { 1: ['c5'] })

test('bookExit returns the 0-based ply of an own deviation in the 5th half move', () => {
  assert.equal(bookExit(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], book, 'scotch', {}), 4)
})

test('bookExit: unknown opponent reply and moves beyond the tree leave the book', () => {
  assert.equal(bookExit(['e2e4', 'd7d5'], book, 'scotch', {}), 1)
  assert.equal(bookExit(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'], book, 'scotch', {}), 5)
})

test('bookExit: null while the game follows the book; known alternative replies stay in; overlays count; illegal move leaves', () => {
  assert.equal(bookExit(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'], book, 'scotch', {}), null)
  assert.equal(bookExit(['e2e4', 'c7c5'], book, 'scotch', {}), null)
  const key = positionKey(new Chess().fen())
  const alt = structuredClone(book)
  alt.trees.scotch[key]!.candidates.push({ ...alt.trees.scotch[key]!.candidates[0]!, uci: 'd2d4', san: 'd4' })
  assert.equal(bookExit(['d2d4'], alt, 'scotch', {}), 0)
  assert.equal(bookExit(['d2d4'], alt, 'scotch', { scotch: { [key]: 'd2d4' } }), null)
  assert.equal(bookExit(['e2e4', 'e7e5', 'e1e5'], book, 'scotch', {}), 2)
})

test('drawAccepted: engine takes a draw within plus/minus 50 cp', () => {
  assert.equal(drawAccepted(50), true)
  assert.equal(drawAccepted(-50), true)
  assert.equal(drawAccepted(51), false)
  assert.equal(drawAccepted(-120), false)
})

const FOOLS = ['f2f3', 'e7e5', 'g2g4', 'd8h4']

test('gameFens lists start + one fen per legal move and stops at an illegal one', () => {
  const start = new Chess().fen()
  assert.equal(gameFens(start, FOOLS).length, 5)
  assert.equal(gameFens(start, ['e2e4', 'e2e4', 'g1f3']).length, 2)
})

test('evaluatePositions: white-side scores, best moves, terminal positions without calling the engine', async () => {
  const fens = gameFens(new Chess().fen(), FOOLS)
  const eng = fakeEngine({ [positionKey(fens[0]!)]: { lines: [{ uci: 'e2e4', cp: 30 }] }, [positionKey(fens[1]!)]: { lines: [{ uci: 'e7e5', cp: -20 }] } })
  const seen: number[] = []
  const r = await evaluatePositions(eng, fens, 12, { onProgress: (d) => seen.push(d) })
  assert.deepEqual(r.whiteCp.slice(0, 2), [30, 20]) // black to move, -20 for black = +20 white
  assert.equal(r.best[0], 'e2e4')
  assert.equal(r.whiteCp[4], -10000) // white is mated: terminal, never analysed
  assert.equal(r.best[4], null)
  assert.equal(eng.calls.length, 4)
  assert.ok(eng.calls.every((c) => c.depth === 12))
  assert.deepEqual(seen, [1, 2, 3, 4, 5])
})

test('evaluatePositions stops when cancelled', async () => {
  const fens = gameFens(new Chess().fen(), FOOLS)
  let stop = false
  const eng = fakeEngine()
  await assert.rejects(evaluatePositions(eng, fens, 12, { onProgress: () => { stop = true }, isCancelled: () => stop }), /cancel/i)
  assert.equal(eng.calls.length, 1)
})

test('reviewErrors lists the user mistakes with the better move and its SAN', () => {
  const start = new Chess().fen()
  // white (user) plays f3?? : eval 30 -> -250 ; black replies; best move at start was e2e4
  const ev = { whiteCp: [30, -250, -250, -600, -10000], best: ['e2e4', 'e7e5', 'g2g4', 'd8h4', null] as (string | null)[] }
  const errs = reviewErrors(start, FOOLS, ev, 'white')
  assert.equal(errs.length, 2)
  assert.deepEqual({ ply: errs[0]!.ply, uci: errs[0]!.uci, betterUci: errs[0]!.betterUci, betterSan: errs[0]!.betterSan, severity: errs[0]!.severity }, { ply: 0, uci: 'f2f3', betterUci: 'e2e4', betterSan: 'e4', severity: 'patzer' })
  assert.equal(errs[0]!.fenBefore, start)
  assert.equal(errs[1]!.ply, 2)
})

test('cardsFromErrors makes partie cards (position + best move), keeps existing cards, skips same-key duplicates', () => {
  const start = new Chess().fen()
  const ev = { whiteCp: [30, -250, -250, -600, -10000], best: ['e2e4', 'e7e5', 'g2g4', 'd8h4', null] as (string | null)[] }
  const errs = reviewErrors(start, FOOLS, ev, 'white')
  const k0 = positionKey(start)
  const made = cardsFromErrors(errs, 'v1', 'scotch', 'c1', {})
  assert.equal(made.length, 2)
  assert.deepEqual({ key: made[0]!.key, expectedUci: made[0]!.expectedUci, origin: made[0]!.origin, variationId: made[0]!.variationId, reps: made[0]!.reps }, { key: k0, expectedUci: 'e2e4', origin: 'partie', variationId: 'v1', reps: 0 })
  const existing = { [`scotch:${k0}`]: { ...made[0]!, origin: 'baum' as const } }
  assert.equal(cardsFromErrors(errs, 'v1', 'scotch', 'c1', existing).length, 1)
})

test('bookExit can start from a given position (sparring from the drill)', () => {
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  assert.equal(bookExit(['e7e5', 'g1f3', 'b8c6', 'f1b5'], book, 'scotch', {}, afterE4), 3)
  assert.equal(bookExit(['e7e5', 'g1f3'], book, 'scotch', {}, afterE4), null)
})

test('severityOf maps a loss to the shared thresholds (50 / 100 / 200 cp)', () => {
  assert.equal(severityOf(49), null)
  assert.equal(severityOf(50), 'ungenau')
  assert.equal(severityOf(100), 'fehler')
  assert.equal(severityOf(200), 'patzer')
})
