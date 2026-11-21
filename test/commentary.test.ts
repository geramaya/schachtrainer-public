import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quipCategoryOf, gefuehlForCategory, phaseOf, balance, judgedCard, parseTalk, DEFAULT_TALK, severityOfCategory, balanceMoves, boardMoveCategories, bestMoveText } from '../src/teacher/commentary.ts'
import type { BalanceMove } from '../src/teacher/commentary.ts'

test('quipCategoryOf: analysis categories map to the teacher events', () => {
  assert.equal(quipCategoryOf('brilliant'), 'bester_zug')
  assert.equal(quipCategoryOf('great'), 'bester_zug')
  assert.equal(quipCategoryOf('best'), 'bester_zug')
  assert.equal(quipCategoryOf('excellent'), 'gut')
  assert.equal(quipCategoryOf('good'), 'gut')
  assert.equal(quipCategoryOf('book'), 'gut')
  assert.equal(quipCategoryOf('inaccuracy'), 'ungenau')
  assert.equal(quipCategoryOf('mistake'), 'fehler')
  assert.equal(quipCategoryOf('miss'), 'fehler')
  assert.equal(quipCategoryOf('blunder'), 'patzer')
})

test('gefuehlForCategory: the feeling comes from mood.ts, per teacher', () => {
  assert.equal(gefuehlForCategory('mann', 'brilliant'), 'begeistert')
  assert.equal(gefuehlForCategory('mann', 'excellent'), 'freude')
  assert.equal(gefuehlForCategory('mann', 'inaccuracy'), 'nachdenklich')
  assert.equal(gefuehlForCategory('mann', 'mistake'), 'besorgt')
  assert.equal(gefuehlForCategory('mann', 'blunder'), 'entsetzt')
  assert.equal(gefuehlForCategory('fuchs', 'blunder'), 'lachen')
  assert.equal(gefuehlForCategory('mann', null), 'neutral')
})

test('phaseOf: opening up to move 10, middlegame up to move 25, then endgame', () => {
  assert.equal(phaseOf(0), 'Eröffnung')
  assert.equal(phaseOf(19), 'Eröffnung')
  assert.equal(phaseOf(20), 'Mittelspiel')
  assert.equal(phaseOf(49), 'Mittelspiel')
  assert.equal(phaseOf(50), 'Endspiel')
})

const mv = (ply: number, cat: BalanceMove['cat'], lossCp = 0, san = 'e4'): BalanceMove => ({ ply, cat, lossCp, san })

test('balance: only counted numbers, per phase, accuracy and the move where most was lost', () => {
  const moves = [mv(0, 'best'), mv(10, 'inaccuracy', 40), mv(22, 'mistake', 180, 'Nf3'), mv(40, 'blunder', 310, 'Qd5'), mv(60, 'blunder', 120, 'Ra1'), mv(62, 'good')]
  const s = balance({ moves, accuracy: 71.4, subject: 'du' })
  const text = s.join(' ')
  assert.match(text, /71 %/)
  assert.match(text, /2 Patzer/)
  assert.match(text, /1 Fehler/)
  assert.match(text, /Mittelspiel: 1 Patzer, 1 Fehler/)
  assert.match(text, /Endspiel: 1 Patzer/)
  assert.doesNotMatch(text, /Eröffnung:/)
  assert.match(text, /Zug 21 \(Qd5, Patzer\).*3,1/) // ply 40 = move 21; 310 cp = 3,1 pawns
})

test('balance: a clean game says so and names no error phase or turning point', () => {
  const s = balance({ moves: [mv(0, 'best'), mv(2, 'good'), mv(4, 'inaccuracy', 30)], accuracy: 96, subject: 'du' })
  const text = s.join(' ')
  assert.match(text, /96 %/)
  assert.match(text, /keinen Patzer und keinen Fehler/)
  assert.doesNotMatch(text, /Zug \d+ \(/)
})

test('balance: a miss counts as a mistake; missing accuracy and no moves give no invented numbers', () => {
  assert.match(balance({ moves: [mv(30, 'miss', 150)], accuracy: null, subject: 'Weiß' }).join(' '), /1 Fehler/)
  assert.doesNotMatch(balance({ moves: [mv(30, 'miss', 150)], accuracy: null, subject: 'Weiß' }).join(' '), /%/)
  assert.deepEqual(balance({ moves: [], accuracy: null, subject: 'du' }), [])
})

test('judgedCard: headline and severity from the rating, text from the judgement', () => {
  const c = judgedCard({ rating: 'patzer', text: 'Hm.' } as never)
  assert.equal(c.severity, 'patzer')
  assert.match(c.headline, /Patzer/)
  assert.equal(c.text, 'Hm.')
  assert.deepEqual(judgedCard(null), { headline: '', severity: '', text: '' })
})

test('parseTalk: analysis board teacher is off by default, game view teacher on; junk falls back', () => {
  assert.deepEqual(DEFAULT_TALK, { game: true, board: false })
  assert.deepEqual(parseTalk({ game: false, board: true }), { game: false, board: true })
  assert.deepEqual(parseTalk({ game: 'x', board: 1 }), DEFAULT_TALK)
  assert.deepEqual(parseTalk(null), DEFAULT_TALK)
})

test('severityOfCategory: card colour class of an analysis category', () => {
  assert.equal(severityOfCategory('brilliant'), 'best')
  assert.equal(severityOfCategory('excellent'), 'excellent')
  assert.equal(severityOfCategory('book'), 'gut')
  assert.equal(severityOfCategory('inaccuracy'), 'ungenau')
  assert.equal(severityOfCategory('miss'), 'fehler')
  assert.equal(severityOfCategory('blunder'), 'patzer')
})

test('balanceMoves: picks the moves of one side with their SAN and loss', () => {
  const analysed = [{ cat: 'best', lossCp: 0 }, { cat: 'blunder', lossCp: 400 }, { cat: 'good', lossCp: 20 }, { cat: null, lossCp: 0 }] as const
  const sans = ['e4', 'f6', 'Nf3', 'g5']
  const white = balanceMoves(analysed, sans, (i) => (i % 2 === 0 ? 'white' : 'black'), 'white')
  assert.deepEqual(white.map((m) => [m.ply, m.cat, m.san]), [[0, 'best', 'e4'], [2, 'good', 'Nf3']])
  const black = balanceMoves(analysed, sans, (i) => (i % 2 === 0 ? 'white' : 'black'), 'black')
  assert.deepEqual(black.map((m) => [m.ply, m.cat, m.lossCp]), [[1, 'blunder', 400], [3, null, 0]])
})

const FOOLS = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2'
test('boardMoveCategories: the analysis board judges any mover like the sparring game judges the player', () => {
  assert.deepEqual(boardMoveCategories(FOOLS, 'd8h4', 'best'), ['matt_gesetzt'])
  assert.deepEqual(boardMoveCategories('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'f2f3', 'patzer'), ['patzer'])
  assert.deepEqual(boardMoveCategories('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', 'f1b5', 'best'), ['schach_gegeben', 'bester_zug'])
})

test('bestMoveText: names the move in German notation, with the reason if there is one', () => {
  const line = { uci: 'g1f3', cp: 30, mate: null, pv: ['g1f3'] }
  assert.match(bestMoveText('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', line), /^Bester Zug: Sf3/)
})
