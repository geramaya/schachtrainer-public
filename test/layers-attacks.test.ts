import { test } from 'node:test'
import assert from 'node:assert/strict'
import { controlMap, pieceStats, reachSquares } from '../src/chess/layers.ts'

const hanging = (fen: string) => pieceStats(fen).filter((p) => p.hanging).map((p) => `${p.color}${p.type}${p.square}`).sort()
const stat = (fen: string, sq: string) => pieceStats(fen).find((p) => p.square === sq)!

test('an attacked piece without defender hangs, an attacker of equal or higher value on a defended piece does not', () => {
  // black knight d4 is attacked by Rd1 and nobody defends it
  assert.deepEqual(hanging('4k3/8/8/8/3n4/8/8/3RK3 w - - 0 1'), ['bnd4'])
  // Rd2 attacks Nd4, Rd8 defends: a rook (5) takes a knight (3) and loses the rook, so the knight does not hang
  assert.deepEqual(hanging('3r3k/8/8/8/3n4/8/3R4/3RK3 w - - 0 1'), [])
})

test('a piece attacked by a cheaper piece hangs even when it is defended', () => {
  // white queen d5 (defended by Pe4) is attacked by the black pawn c6; the pawn c6 itself is attacked by the queen and undefended
  const fen = '4k3/8/2p5/3Q4/4P3/8/8/4K3 w - - 0 1'
  assert.deepEqual(hanging(fen), ['bpc6', 'wqd5'])
  assert.deepEqual([stat(fen, 'd5').attackers, stat(fen, 'd5').defenders], [['c6'], ['e4']])
})

test('a pinned defender does not defend (pin on the king along the e-file)', () => {
  // Be6 is pinned by Re1 against Ke8, so it does not defend Nd5, which Rd1 attacks; the pinned bishop itself is attacked and undefended
  const fen = '4k3/8/4b3/3n4/8/8/8/3RRK2 w - - 0 1'
  assert.deepEqual(stat(fen, 'd5').defenders, [])
  assert.deepEqual(hanging(fen), ['bbe6', 'bnd5'])
})

test('a pinned piece does not count as controlling squares off its pin line, and attacks nothing there', () => {
  const fen = '4k3/8/4b3/3n4/8/8/8/3RRK2 w - - 0 1'
  assert.equal(controlMap(fen).f5!.black, 0)
  assert.deepEqual(reachSquares(fen, 'e6'), [])
})

test('en passant: the pawn that just moved two squares is attacked by the pawn that can take it', () => {
  const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2'
  assert.deepEqual(stat(fen, 'd5').attackers, ['e5'])
  assert.deepEqual(hanging(fen), ['bpd5'])
  // without the en passant square the same pawns do not attack each other
  assert.deepEqual(hanging('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 2'), [])
})

test('kings count as attackers and as defenders', () => {
  // black pawn d2 is attacked by Kd1 and defended by Kd3: not hanging
  const defended = '8/8/8/8/8/3k4/3p4/3K4 w - - 0 1'
  assert.deepEqual([stat(defended, 'd2').attackers, stat(defended, 'd2').defenders], [['d1'], ['d3']])
  assert.deepEqual(hanging(defended), [])
  // without the second king next to it the pawn hangs
  assert.deepEqual(hanging('8/8/8/8/8/8/3p4/3K1k2 w - - 0 1'), ['bpd2'])
})

test('the king itself never hangs, even when attacked', () => {
  assert.deepEqual(hanging('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1').includes('wke1'), false)
})

test('x-ray attackers behind a direct attacker are not counted (documented limit)', () => {
  // Rd1 stands behind Rd2 on the d-file: only Rd2 counts as attacker of Nd4
  assert.deepEqual(stat('3r3k/8/8/8/3n4/8/3R4/3RK3 w - - 0 1', 'd4').attackers, ['d2'])
})

test('control: attackers per side and square in the start position', () => {
  const m = controlMap('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  assert.deepEqual(m.f3, { white: 3, black: 0 }) // Ng1, Pe2, Pg2
  assert.deepEqual(m.f6, { white: 0, black: 3 })
  assert.deepEqual(m.e4, { white: 0, black: 0 })
  assert.equal(Object.keys(m).length, 64)
})

test('reach: the squares a piece attacks, including own pieces it defends', () => {
  assert.deepEqual(reachSquares('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', 'e4').sort(), ['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5'])
  assert.deepEqual(reachSquares('4k3/8/8/8/4P3/8/8/4K3 w - - 0 1', 'e4').sort(), ['d5', 'f5'])
  assert.deepEqual(reachSquares('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1').sort(), ['d1', 'd2', 'e2', 'f1', 'f2'])
  assert.deepEqual(reachSquares('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'a5'), [], 'an empty square attacks nothing')
})
