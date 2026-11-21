import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeMove } from '../src/teacher/judge.ts'
import { badgeTip, factSentence, units } from '../src/teacher/blocks.ts'
import type { MoveEvals } from '../src/teacher/judge.ts'

const line = (uci: string, pv: string[], cp: number | null, mate: number | null = null) => ({ uci, pv, cp, mate })
/** MoveEvals from the point of view of the side that moves. */
const ev = (best: ReturnType<typeof line>, played: ReturnType<typeof line>): MoveEvals => ({ best, played })

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const QUEEN_EN_PRISE = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3'
const BISHOP_EN_PRISE = '4k3/8/3n4/8/8/8/8/4KB2 w - - 0 1'
const FORK = '4k3/8/8/8/1n6/8/7P/R3K3 w - - 0 1'
const BACK_RANK = '4r1k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
const MATE_IN_ONE = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
const PROMOTE = '6k1/8/8/8/8/5K2/p7/7R w - - 0 1'

test('best move played: rating best, praise text, no loss', () => {
  const l = line('e2e4', ['e2e4', 'e7e5'], 30)
  const j = judgeMove(START, 'e2e4', ev(l, l))
  assert.equal(j.rating, 'best')
  assert.equal(j.lossCp, 0)
  assert.match(j.text, /Bester Zug|beste|Stockfish/)
})

test('small loss (20 cp = 0.018 Expected Points): excellent, does not name the preferred move (only on request)', () => {
  const j = judgeMove(START, 'd2d4', ev(line('e2e4', ['e2e4', 'e7e5'], 30), line('d2d4', ['d2d4', 'd7d5'], 10)))
  assert.equal(j.rating, 'excellent')
  assert.doesNotMatch(j.text, /e4|bevorzugt|genauer/)
  assert.match(j.reveal, /e4/)
})

test('ungenau without provable fact: the sentence does not name the better move', () => {
  const j = judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4'], 30), line('a2a3', ['a2a3', 'e7e5'], -30)))
  assert.equal(j.rating, 'ungenau')
  assert.doesNotMatch(j.text, /e4|besser/i)
  assert.match(j.reveal, /e4/)
})

/** the played cp (mover view) that loses exactly `loss` Expected Points against a best line of `bestCp` */
const playedCpFor = (bestCp: number, loss: number): number => {
  const p = 1 / (1 + Math.exp(-0.00368208 * bestCp)) - loss
  return Math.round(Math.log(p / (1 - p)) / 0.00368208)
}

test('rating by lost Expected Points (as in the analysis): excellent <= 0.02, good <= 0.05, inaccuracy <= 0.10, mistake <= 0.20, blunder above', () => {
  const rate = (loss: number) => judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4'], 30), line('a2a3', ['a2a3', 'e7e5'], playedCpFor(30, loss)))).rating
  assert.deepEqual([0.005, 0.015, 0.03, 0.045, 0.07, 0.095, 0.12, 0.19, 0.25, 0.6].map(rate), ['excellent', 'excellent', 'gut', 'gut', 'ungenau', 'ungenau', 'fehler', 'fehler', 'patzer', 'patzer'])
})

test('the same loss in centipawns weighs more in an equal position than in a won one (Expected Points, not fixed centipawns)', () => {
  const rate = (best: number, loss: number) => judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4'], best), line('a2a3', ['a2a3', 'e7e5'], best - loss))).rating
  assert.equal(rate(0, 100), 'ungenau')
  assert.equal(rate(900, 100), 'excellent')
})

test('fallback: no provable fact -> Stockfish sentence with both evaluations', () => {
  const j = judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4'], 30), line('a2a3', ['a2a3', 'e7e5'], -150)))
  assert.equal(j.rating, 'fehler')
  assert.deepEqual(j.facts, [])
  assert.equal(j.reveal, 'Besser war e4: Stockfish bewertet es um 1,8 Bauerneinheiten besser (+0,30). Hauptlinie: 1. e4.')
  assert.match(j.text, /^Stockfish sieht nach a3 −1,50\./) // the evaluation sentence is said once (text), the reveal only adds the move
  assert.doesNotMatch(j.text, /e4/, 'the better move is revealed only on request')
})

test('hanging piece: the queen on e5 has no defender and is taken by the knight', () => {
  const best = line('f1c4', ['f1c4', 'g8f6', 'h5f3'], 30)
  const played = line('h5e5', ['h5e5', 'c6e5'], -800)
  const j = judgeMove(QUEEN_EN_PRISE, 'h5e5', ev(best, played))
  assert.equal(j.rating, 'patzer')
  assert.deepEqual(j.facts[0], { kind: 'hanging', piece: 'q', square: 'e5', san: 'Nxe5', undefended: true })
  assert.match(j.text, /Dame auf e5/)
  assert.match(j.text, /Sxe5/)
})

test('hanging piece: defended queen, but the attacker is a cheaper knight', () => {
  const best = line('f1c4', ['f1c4', 'g8f6', 'h5f3'], 30)
  const played = line('h5e5', ['h5e5', 'c6e5', 'd4e5'], -500)
  const j = judgeMove('r1bqkbnr/pppp1ppp/2n5/4p2Q/3PP3/8/PPP2PPP/RNB1KBNR w KQkq - 0 3', 'h5e5', ev(best, played))
  assert.deepEqual(j.facts[0], { kind: 'hanging', piece: 'q', square: 'e5', san: 'Nxe5', undefended: false })
  assert.match(j.text, /Dame auf e5/)
})

test('hanging piece: undefended bishop on b5 is named as ungedeckt', () => {
  const j = judgeMove(BISHOP_EN_PRISE, 'f1b5', ev(line('e1e2', ['e1e2'], 0), line('f1b5', ['f1b5', 'd6b5'], -300)))
  assert.deepEqual(j.facts[0], { kind: 'hanging', piece: 'b', square: 'b5', san: 'Nxb5', undefended: true })
  assert.match(j.text, /ungedeckt/)
})

test('fork: the reply Nc2+ forks king and rook, shown with the squares', () => {
  const best = line('a1a4', ['a1a4', 'b4d5'], 400)
  const played = line('h2h3', ['h2h3', 'b4c2', 'e1d1', 'c2a1'], -500)
  const j = judgeMove(FORK, 'h2h3', ev(best, played))
  const f = j.facts[0]!
  assert.equal(f.kind, 'motif')
  assert.match(j.text, /Gabel/)
  assert.match(j.text, /c2/)
  assert.match(j.text, /e1/)
  assert.match(j.text, /a1/)
})

test('mate allowed: back-rank mate in 1 after the rook leaves the first rank', () => {
  const best = line('h2h3', ['h2h3', 'h7h6'], 0)
  const played = line('d1d2', ['d1d2', 'e8e1'], null, -1)
  const j = judgeMove(BACK_RANK, 'd1d2', ev(best, played))
  assert.equal(j.rating, 'patzer')
  assert.deepEqual(j.facts[0], { kind: 'mate-allowed', n: 1, san: 'Re1#', backRank: true })
  assert.match(j.text, /Matt in 1/)
  assert.match(j.text, /Grundreihe/)
})

test('mate missed: mate in 1 was available (best line is a mate)', () => {
  const best = line('a1a8', ['a1a8'], null, 1)
  const played = line('h2h3', ['h2h3', 'h7h6'], 20)
  const j = judgeMove(MATE_IN_ONE, 'h2h3', ev(best, played))
  assert.equal(j.rating, 'patzer')
  assert.deepEqual(j.facts[0], { kind: 'mate-missed', n: 1, san: 'Ra8#' })
  assert.match(j.text, /stärkere Fortsetzung verpasst/)
  assert.doesNotMatch(j.text, /Matt|Ta8/, 'no mate announcement and no move unasked')
  assert.match(j.reveal, /Ta8/)
})

test('promotion allowed: the opponent pawn queens on a1', () => {
  const best = line('h1a1', ['h1a1', 'g8g7'], 0)
  const played = line('h1h2', ['h1h2', 'a2a1q'], -800)
  const j = judgeMove(PROMOTE, 'h1h2', ev(best, played))
  assert.deepEqual(j.facts[0], { kind: 'promotion', square: 'a1', san: 'a1=Q' })
  assert.match(j.text, /Umwandlung/)
  assert.match(j.text, /a1/)
})

test('promotion that the best line allows as well is not blamed on the played move', () => {
  const both = line('h1h2', ['h1h2', 'a2a1q'], -800)
  const j = judgeMove(PROMOTE, 'h1a1', ev(both, line('h1a1', ['h1a1', 'a2a1q'], -850)))
  assert.ok(!j.facts.some((f) => f.kind === 'promotion'))
})

test('best move explained: mate in 1', () => {
  const j = judgeMove(MATE_IN_ONE, 'h2h3', ev(line('a1a8', ['a1a8'], null, 1), line('h2h3', ['h2h3', 'h7h6'], 20)))
  assert.match(j.bestWhy!, /matt/)
})

test('best move explained: wins an undefended knight (material in the continuation)', () => {
  const fen = '4k3/8/8/8/8/n7/8/R3K3 w - - 0 1'
  const j = judgeMove(fen, 'e1d1', ev(line('a1a3', ['a1a3', 'e8d7'], 300), line('e1d1', ['e1d1', 'a3b5'], 0)))
  assert.match(j.bestWhy!, /gewinnt.*3 Bauerneinheiten/)
  assert.match(j.reveal, /Txa3/)
})

test('best move explained: saves the attacked bishop', () => {
  const fen = '4k3/8/3n4/1B6/8/8/8/4K3 w - - 0 1'
  const j = judgeMove(fen, 'e1e2', ev(line('b5e2', ['b5e2', 'e8d7'], 0), line('e1e2', ['e1e2', 'd6b5'], -300)))
  assert.match(j.bestWhy!, /rettet.*b5/)
})

test('best move explained: gives check, develops a knight, nothing specific for e4', () => {
  const chk = judgeMove('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'e1d1', ev(line('a1a8', ['a1a8', 'e8d7'], 500), line('e1d1', ['e1d1', 'e8d7'], 0)))
  assert.match(chk.bestWhy!, /Schach/)
  const dev = judgeMove(START, 'a2a3', ev(line('g1f3', ['g1f3', 'g8f6'], 30), line('a2a3', ['a2a3'], -100)))
  assert.match(dev.bestWhy!, /entwickelt.*Springer/)
  assert.equal(judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4', 'e7e5'], 30), line('a2a3', ['a2a3'], -100))).bestWhy, null)
})

test('choice of wording is deterministic for the same position and move', () => {
  const l = line('e2e4', ['e2e4'], 30)
  assert.equal(judgeMove(START, 'e2e4', ev(l, l)).text, judgeMove(START, 'e2e4', ev(l, l)).text)
})

test('judgement carries the better move (uci and English SAN) for the review cards', () => {
  const j = judgeMove(START, 'a2a3', ev(line('e2e4', ['e2e4'], 30), line('a2a3', ['a2a3'], -150)))
  assert.equal(j.betterUci, 'e2e4')
  assert.equal(j.betterSan, 'e4')
})

// ---- Revision r2 (review findings 1, 3, 4, 6, 7, 8, 9) ----

test('missed gain: not taking a free knight says material was left on the table, never "kostet dich"', () => {
  const fen = '4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1'
  const j = judgeMove(fen, 'e1f1', ev(line('d2d5', ['d2d5', 'e8f7'], 300), line('e1f1', ['e1f1', 'e8d7', 'f1e1'], 0)))
  assert.equal(j.rating, 'patzer')
  assert.equal(j.facts[0]!.kind, 'material')
  assert.match(j.text, /lässt (du )?Material liegen/)
  assert.match(j.text, /3 Bauerneinheiten/)
  assert.doesNotMatch(j.text, /kostet|schlechter/)
  assert.doesNotMatch(j.text, /Txd5|Td5/, 'the better move stays hidden for a Patzer')
})

test('missed gain from the black side is worded the same way', () => {
  const fen = '4k3/3r4/8/8/3N4/8/8/4K3 b - - 0 1'
  const j = judgeMove(fen, 'e8f8', ev(line('d7d4', ['d7d4', 'e1f1'], 300), line('e8f8', ['e8f8', 'e1f1', 'f8e8'], 0)))
  assert.match(j.text, /lässt (du )?Material liegen/)
  assert.match(j.text, /3 Bauerneinheiten/)
})

test('real loss in the line keeps the absolute wording with the unit Bauerneinheiten', () => {
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 6 5'
  const played = line('f3g5', ['f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7', 'e8f7'], -250)
  const j = judgeMove(fen, 'f3g5', ev(line('d2d3', ['d2d3', 'd7d6'], 20), played))
  assert.equal(j.facts[0]!.kind, 'material')
  assert.match(j.text, /2 Bauerneinheiten/)
  assert.match(j.text, /schlechter|kostet/)
})

test('best-move reason uses the unit too ("Bauerneinheiten")', () => {
  const fen = '4k3/8/8/8/8/n7/8/R3K3 w - - 0 1'
  const j = judgeMove(fen, 'e1d1', ev(line('a1a3', ['a1a3', 'e8d7'], 300), line('e1d1', ['e1d1', 'a3b5'], 0)))
  assert.match(j.bestWhy!, /3 Bauerneinheiten/)
})

test('truncated PV: a last capture the opponent may answer is no basis for a material claim', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/3PP3/8/PPP2PPP/RNB1KBNR w KQkq - 0 3'
  const j = judgeMove(fen, 'h5e5', ev(line('f1c4', ['f1c4', 'g8f6', 'h5f3'], 30), line('h5e5', ['h5e5', 'c6e5'], -500)))
  assert.deepEqual(j.facts, [])
  assert.match(j.text, /^Stockfish sieht nach/)
})

test('truncated best PV ending on an own capture that can be retaken does not promise a gain', () => {
  const fen = '4k3/8/8/2b5/8/n7/8/R3K3 w - - 0 1' // the bishop on c5 defends the knight on a3
  assert.equal(judgeMove(fen, 'e1d1', ev(line('a1a3', ['a1a3'], 300), line('e1d1', ['e1d1'], 0))).bestWhy, null)
})

test('en passant: the hanging pawn is named on its real square (d4), not on the landing square', () => {
  const fen = '4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1'
  const j = judgeMove(fen, 'd2d4', ev(line('e1e2', ['e1e2', 'e8e7'], 0), line('d2d4', ['d2d4', 'e4d3'], -150)))
  assert.deepEqual(j.facts[0], { kind: 'hanging', piece: 'p', square: 'd4', san: 'exd3', undefended: true })
  assert.match(j.text, /Bauer auf d4/)
  assert.doesNotMatch(j.text, /Bauer auf d3/)
})

test('en passant: defence is checked on the captured pawn, not on the landing square', () => {
  // white pawn d4 is defended by the knight on c2 (c2 attacks d4), d3 is not: the pawn is NOT undefended
  const fen = '4k3/8/8/8/4p3/8/2NP4/4K3 w - - 0 1'
  const j = judgeMove(fen, 'd2d4', ev(line('e1e2', ['e1e2', 'e8e7'], 0), line('d2d4', ['d2d4', 'e4d3'], -150)))
  const f = j.facts[0]
  assert.ok(!f || f.kind !== 'hanging' || f.undefended === false)
})

test('castling reason: short and long castling are told apart', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'
  const short = judgeMove(fen, 'a1a2', ev(line('e1g1', ['e1g1', 'e8g8'], 20), line('a1a2', ['a1a2'], -100))).bestWhy!
  const long = judgeMove(fen, 'a1a2', ev(line('e1c1', ['e1c1', 'e8c8'], 20), line('a1a2', ['a1a2'], -100))).bestWhy!
  assert.match(short, /kurz/)
  assert.match(short, /g1/)
  assert.match(long, /lang/)
  assert.match(long, /c1/)
  assert.doesNotMatch(long, /Ecke/)
})

test('an exchange (own capture, retaken) is not called hanging', () => {
  const fen = '4k3/2p3p1/3n4/4B3/8/8/8/4K3 w - - 0 1'
  const j = judgeMove(fen, 'e5d6', ev(line('e5g7', ['e5g7', 'e8f7'], 150), line('e5d6', ['e5d6', 'c7d6'], 20)))
  assert.ok(!j.facts.some((f) => f.kind === 'hanging'))
})

test('mate distance counts: mate in 1 against us instead of mate in 5 is not "gut"', () => {
  const fen = '4r1k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
  const j = judgeMove(fen, 'd1d2', ev(line('h2h3', ['h2h3'], null, -5), line('d1d2', ['d1d2', 'e8e1'], null, -1)))
  assert.equal(j.rating, 'patzer')
})

test('mate distance counts: a slower own mate is at most ungenau, an equally fast one is gut', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
  const slow = judgeMove(fen, 'h2h3', ev(line('a1a8', ['a1a8'], null, 1), line('h2h3', ['h2h3', 'h7h6', 'a1a8'], null, 8)))
  assert.equal(slow.rating, 'ungenau')
  const same = judgeMove(fen, 'g2g3', ev(line('a1a8', ['a1a8'], null, 1), line('g2g3', ['g2g3'], null, 1)))
  assert.equal(same.rating, 'gut')
})

test('units: one pawn unit is singular, everything else plural', () => {
  assert.equal(units(1), '1 Bauerneinheit')
  assert.equal(units(2), '2 Bauerneinheiten')
  assert.equal(units(0), '0 Bauerneinheiten')
})

test('material sentences say "1 Bauerneinheit", not "1 Bauerneinheiten"', () => {
  for (const mode of ['loss', 'missed'] as const) for (const seed of ['a', 'b', 'c', 'd']) {
    const t = factSentence({ kind: 'material', mode, pawns: 1, line: 'x' }, seed)
    assert.match(t, /1 Bauerneinheit\b/)
    assert.doesNotMatch(t, /1 Bauerneinheiten/)
  }
})

test('Ungenau/Fehler/Patzer: the text says how much the best move would have brought, without naming it', () => {
  const j = judgeMove(START, 'd2d4', ev(line('e2e4', ['e2e4', 'e7e5'], 30), line('d2d4', ['d2d4', 'd7d5'], -90)))
  assert.notEqual(j.rating, 'best')
  assert.match(j.text, /Der beste Zug hätte dir etwa 1,2 Bauerneinheiten mehr gebracht\./)
  assert.doesNotMatch(j.text, /e4/)
})

test('no gain sentence for mate scores (cp is meaningless there) and none for good moves', () => {
  const m = judgeMove(MATE_IN_ONE, 'a1a7', ev(line('a1a8', ['a1a8'], null, 1), line('a1a7', ['a1a7', 'g8f8'], 0)))
  assert.doesNotMatch(m.text, /Bauerneinheiten mehr gebracht/)
  const g = judgeMove(START, 'd2d4', ev(line('e2e4', ['e2e4', 'e7e5'], 30), line('d2d4', ['d2d4', 'd7d5'], 25)))
  assert.doesNotMatch(g.text, /mehr gebracht/)
})

const reasonOf = (fen: string, best: ReturnType<typeof line>, playedUci: string, playedCp: number) =>
  judgeMove(fen, playedUci, ev(best, line(playedUci, [playedUci], playedCp))).reveal

test('reveal: the best move captures an undefended piece -> says so, proven by the position', () => {
  const fen = '4k3/8/8/n7/8/8/8/R3K3 w - - 0 1'
  const r = reasonOf(fen, line('a1a5', ['a1a5'], 500), 'e1e2', 0)
  assert.match(r, /^Besser war Txa5: Er schlägt den Springer auf a5: Der Springer steht ungedeckt\./)
})

test('reveal: the best move gives check -> says so', () => {
  const r = reasonOf('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', line('a1a8', ['a1a8', 'e8e7'], 400), 'e1e2', 0)
  assert.match(r, /Besser war Ta8\+: Er gibt Schach\./)
})

test('reveal: the best move saves the attacked piece -> says so', () => {
  const r = reasonOf('4k3/8/8/4p3/3N4/8/8/4K3 w - - 0 1', line('d4b5', ['d4b5', 'e8e7'], 0), 'e1e2', -300)
  assert.match(r, /Besser war Sb5: Er rettet die angegriffene Figur auf d4\./)
})

test('reveal: no provable motive -> the evaluation difference and the main line instead of an invented reason', () => {
  const r = reasonOf(START, line('a2a4', ['a2a4', 'a7a5', 'b2b4', 'b7b5', 'c2c4'], 30), 'h2h3', -30)
  assert.equal(r, 'Besser war a4: Stockfish bewertet es um 0,6 Bauerneinheiten besser (+0,30). Hauptlinie: 1. a4 a5 2. b4 b5.')
})

test('the verdict badge explains its category with the loss of this move', () => {
  assert.equal(badgeTip('fehler', 130), 'Fehler: verliert etwa 1,3 Bauerneinheiten gegenüber dem besten Zug.')
  assert.equal(badgeTip('ungenau', 3), 'Ungenau: kostet kaum etwas gegenüber dem besten Zug.')
  assert.equal(badgeTip('best', 0), 'Der beste Zug der Engine.')
  assert.equal(badgeTip('gut', 12), 'Fast so gut wie der beste Zug.')
})
