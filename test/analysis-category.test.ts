import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, CLASSIC_SIGN, SYMBOL, ZONE, classifyMove, ep, lossCategory } from '../src/analysis/category.ts'
import type { Category, ClassifyInput } from '../src/analysis/category.ts'

const ev = (cp: number) => ({ cp, mate: null })
/** centipawns (white view, mover white) that give exactly this Expected Points value */
const whiteCp = (p: number) => Math.round(Math.log(p / (1 - p)) / 0.00368208)

/** White moves; defaults: best move, no second line, no sacrifice, not a recapture, not book. */
const input = (o: Partial<Omit<ClassifyInput, 'before' | 'after'>> & { before: number; after: number }): ClassifyInput => ({
  mover: 'white', playedUci: 'e2e4', bestUci: 'e2e4', second: null, sacrifice: false, recapture: false, book: false, prevCategory: null, ...o, before: ev(o.before), after: ev(o.after),
})
const cat = (o: Partial<Omit<ClassifyInput, 'before' | 'after'>> & { before: number; after: number }): Category | null => classifyMove(input(o))
const second = (cp: number) => ({ uci: 'd2d4', ev: ev(cp) })

test('Expected Points: win chance / 100, mate limited like the curve', () => {
  assert.equal(ep(ev(0), 'white'), 0.5)
  assert.ok(Math.abs(ep(ev(100), 'white') - 0.591) < 0.001)
  assert.ok(Math.abs(ep(ev(100), 'black') - 0.409) < 0.001)
  assert.equal(ep({ cp: 10000, mate: 2 }, 'white'), ep(ev(1000), 'white'))
})

test('loss categories by Expected Points: best, excellent <= 0.02, good <= 0.05, inaccuracy <= 0.10, mistake <= 0.20, blunder above', () => {
  const rows: [number, boolean, Category][] = [
    [0, true, 'best'], [0.3, true, 'best'], [0, false, 'best'],
    [0.0001, false, 'excellent'], [0.02, false, 'excellent'], [0.0201, false, 'good'],
    [0.05, false, 'good'], [0.0501, false, 'inaccuracy'], [0.10, false, 'inaccuracy'], [0.1001, false, 'mistake'],
    [0.20, false, 'mistake'], [0.2001, false, 'blunder'], [0.9, false, 'blunder'],
  ]
  for (const [loss, best, want] of rows) assert.equal(lossCategory(loss, best), want, `${loss} ${best}`)
})

test('a played move with a small loss from the evaluations: excellent, good, inaccuracy, mistake, blunder (white)', () => {
  const at = (loss: number) => cat({ before: 0, after: -Math.round(loss), playedUci: 'a2a3', second: null })
  // from an equal position: 20 cp = 0.018 EP, 40 cp = 0.037, 90 cp = 0.082, 150 cp = 0.135, 300 cp = 0.251
  assert.deepEqual([5, 10, 20, 40, 90, 150, 300].map(at), ['excellent', 'excellent', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'])
})

test('black moves are counted from the black view', () => {
  assert.equal(cat({ mover: 'black', before: 0, after: 300, playedUci: 'a7a6' }), 'blunder')
  assert.equal(cat({ mover: 'black', before: 0, after: -300, playedUci: 'a7a6' }), 'best', 'a gain is no loss; the played move is not the top one but loses nothing')
})

test('mate: throwing a mate away is a blunder, a slower own mate and a lost position that stays lost are best', () => {
  assert.equal(cat({ before: 10000, after: 150, playedUci: 'a2a3' }), 'blunder')
  assert.equal(cat({ before: 10000, after: 10000, playedUci: 'a2a3' }), 'best')
  assert.equal(cat({ before: 0, after: -10000, playedUci: 'a2a3' }), 'blunder')
  assert.equal(cat({ before: -10000, after: -10000, playedUci: 'a2a3' }), 'best')
})

test('book moves are book, whatever the evaluation says', () => {
  assert.equal(cat({ before: 0, after: -500, playedUci: 'a2a3', book: true }), 'book')
  assert.equal(cat({ before: 0, after: 0, book: true }), 'book')
})

test('no engine data, no category', () => {
  assert.equal(classifyMove({ ...input({ before: 0, after: 0 }), bestUci: null }), null)
})

test('Great: an only good move (second best worse by more than 0.10 EP)', () => {
  // equal position, the second line loses 0.11 EP
  assert.equal(cat({ before: 0, after: 0, second: second(100) }), 'best', 'a second line that is better is no gap')
  assert.equal(cat({ before: 0, after: 0, second: second(-130) }), 'great')
  assert.equal(cat({ before: 0, after: 0, second: second(-50) }), 'best', 'a second line only 0.06 EP worse: not an only move')
})

test('Great: the move decides the zone (second line on the other side of 0.35 / 0.65, difference at least 0.05)', () => {
  assert.equal(cat({ before: whiteCp(0.67), after: whiteCp(0.67), second: second(whiteCp(0.60)) }), 'great', 'winning vs balanced')
  assert.equal(cat({ before: whiteCp(0.40), after: whiteCp(0.40), second: second(whiteCp(0.32)) }), 'great', 'balanced vs losing')
  assert.equal(cat({ before: whiteCp(0.67), after: whiteCp(0.67), second: second(whiteCp(0.66)) }), 'best', 'same side of the line, no real difference')
  assert.equal(cat({ before: whiteCp(0.66), after: whiteCp(0.66), second: second(whiteCp(0.64)) }), 'best', 'crosses the line but the difference is below 0.05')
})

test('Great: not when the best line is already clearly won (> 0.90), not without a second line, not for a forced recapture', () => {
  assert.equal(cat({ before: whiteCp(0.95), after: whiteCp(0.95), second: second(whiteCp(0.2)) }), 'best')
  assert.equal(cat({ before: 0, after: 0, second: null }), 'best')
  assert.equal(cat({ before: 0, after: 0, second: second(-300), recapture: true }), 'best')
})

test('Great is only for best or excellent moves', () => {
  assert.equal(cat({ before: 0, after: -40, playedUci: 'a2a3', second: second(-300) }), 'good')
})

test('Brilliant: best or excellent move with a proven sacrifice, not already clearly won before, balanced or better after', () => {
  assert.equal(cat({ before: 30, after: 30, sacrifice: true }), 'brilliant')
  assert.equal(cat({ before: 30, after: 10, sacrifice: true, playedUci: 'a2a3' }), 'brilliant', 'excellent (loss <= 0.02) counts as almost best')
  assert.equal(cat({ before: 30, after: 30, sacrifice: false }), 'best')
  assert.equal(cat({ before: whiteCp(0.64), after: whiteCp(0.64), sacrifice: true }), 'brilliant', 'just inside the limit of 0.65')
  assert.equal(cat({ before: whiteCp(0.36), after: whiteCp(0.36), sacrifice: true }), 'brilliant', 'just inside the balanced zone')
})

test('Brilliant limits: not when the position was winning anyway (EP > 0.65 before), not when it ends worse than balanced, not for a recapture', () => {
  assert.equal(cat({ before: whiteCp(0.70), after: whiteCp(0.70), sacrifice: true }), 'best')
  assert.equal(cat({ before: whiteCp(0.34), after: whiteCp(0.34), sacrifice: true }), 'best')
  assert.equal(cat({ before: 0, after: 0, sacrifice: true, recapture: true }), 'best')
  assert.equal(cat({ before: 0, after: -60, sacrifice: true, playedUci: 'a2a3' }), 'inaccuracy', 'a sacrifice that costs more than an excellent move is no brilliancy')
})

test('Miss: after an opponent mistake or blunder a winning position slips to balanced', () => {
  const miss = (prev: Category | null, loss = 0.15) => cat({ before: whiteCp(0.80), after: whiteCp(0.80 - loss), playedUci: 'a2a3', prevCategory: prev })
  assert.equal(miss('blunder'), 'miss')
  assert.equal(miss('mistake'), 'miss')
  assert.equal(miss(null), 'mistake', 'no opponent error before: plain mistake')
  assert.equal(miss('inaccuracy'), 'mistake', 'an inaccuracy of the opponent does not count')
  assert.equal(miss('blunder', 0.30), 'miss', 'EP 0.50 after the move: balanced')
  assert.equal(miss('blunder', 0.50), 'blunder', 'EP 0.30 after the move: worse than balanced keeps its loss category')
})

test('Miss limits: the position must have been winning (> 0.65), the move must lose at least an inaccuracy, the result must be balanced, not worse', () => {
  const m = (before: number, after: number) => cat({ before: whiteCp(before), after: whiteCp(after), playedUci: 'a2a3', prevCategory: 'blunder' })
  assert.equal(m(0.64, 0.40), 'blunder', 'was not winning: plain loss category')
  assert.equal(m(0.80, 0.78), 'excellent', 'nothing lost')
  assert.equal(m(0.80, 0.36), 'miss', 'balanced result, however large the loss (zone from 0.35)')
  assert.equal(m(0.80, 0.30), 'blunder', 'worse than balanced keeps the loss category')
  assert.equal(m(0.80, 0.68), 'mistake', 'still winning after the move: no miss, a plain loss category')
})

test('Book beats Miss, Brilliant and Great', () => {
  assert.equal(cat({ before: 30, after: 30, sacrifice: true, book: true }), 'book')
})

test('symbols: classical signs where they exist, own plain symbols for the others, all different', () => {
  assert.deepEqual(CLASSIC_SIGN, { brilliant: '!!', great: '!', inaccuracy: '?!', mistake: '?', blunder: '??' })
  assert.equal(new Set(CATEGORIES.map((c) => SYMBOL[c])).size, CATEGORIES.length)
  assert.equal(SYMBOL.best, '★')
  assert.equal(ZONE.low, 0.35)
})
