import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { features, tacticalMotifs } from '../src/coach/features.ts'
import { fenAfter } from './fake-engine.ts'

const sans = (s: string) => s.split(' ')
const side = (fen: string, s: 'white' | 'black') => features(fen).find((f) => f.side === s)!
const valid = (fen: string) => { new Chess(fen); return fen }

test('features: one entry per side', () => {
  assert.deepEqual(features(fenAfter([])).map((f) => f.side), ['white', 'black'])
})

test('isolani: black d-pawn alone after the Tarrasch exchanges', () => {
  const fen = fenAfter(sans('d4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O dxc5 Bxc5'))
  assert.deepEqual(side(fen, 'black').isolated, ['d'])
  assert.deepEqual(side(fen, 'white').isolated, [])
})

test('open file e after both e-pawns are traded', () => {
  const fen = fenAfter(sans('e4 e5 Nf3 Nf6 Nxe5 Nxe4'))
  assert.ok(side(fen, 'white').openFiles.includes('e'))
  assert.ok(side(fen, 'black').openFiles.includes('e'))
  assert.ok(!side(fen, 'white').halfOpenFiles.includes('e'))
})

test('half open file: only the side without its own pawn there', () => {
  const fen = fenAfter(sans('e4 d5 exd5 Qxd5'))
  assert.deepEqual(side(fen, 'white').halfOpenFiles, ['e'])
  assert.deepEqual(side(fen, 'black').halfOpenFiles, ['d'])
})

test('doubled and bishop pair after Bxc6 dxc6', () => {
  const fen = fenAfter(sans('e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6'))
  assert.deepEqual(side(fen, 'black').doubled, ['c'])
  assert.equal(side(fen, 'white').bishopPair, false)
  assert.equal(side(fen, 'black').bishopPair, true)
})

test('passed pawn', () => {
  assert.deepEqual(side(valid('8/8/8/3P4/8/8/8/k1K5 w - - 0 1'), 'white').passed, ['d'])
  assert.deepEqual(side(valid('8/2p5/8/3P4/8/8/8/k1K5 w - - 0 1'), 'white').passed, [])
})

test('development counts minor pieces off their start squares', () => {
  assert.equal(side(fenAfter([]), 'white').development, 0)
  const fen = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6'))
  assert.equal(side(fen, 'white').development, 2)
  assert.equal(side(fen, 'black').development, 2)
})

test('castled follows the king square', () => {
  const fen = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O'))
  assert.equal(side(fen, 'white').castled, true)
  assert.equal(side(fen, 'black').castled, false)
})

test('king shelter counts pawns in front of the king', () => {
  assert.equal(side(fenAfter([]), 'white').kingShelter, 3)
  assert.equal(side(valid('6k1/8/8/8/8/8/5PP1/6K1 w - - 0 1'), 'white').kingShelter, 2)
})

test('king shelter: a pawn two steps ahead (1. e4) still shelters', () => {
  assert.equal(side(fenAfter(['e4']), 'white').kingShelter, 3)
})

test('outpost: supported knight that no enemy pawn can attack', () => {
  assert.deepEqual(side(valid('4k3/8/8/3N4/4P3/8/8/4K3 w - - 0 1'), 'white').outposts, ['d5'])
  assert.deepEqual(side(valid('4k3/2p5/8/3N4/4P3/8/8/4K3 w - - 0 1'), 'white').outposts, [])
})

test('centre control after 1. e4', () => {
  const fen = fenAfter(['e4'])
  assert.equal(side(fen, 'white').centerControl, 2)
  assert.equal(side(fen, 'black').centerControl, 0)
})

test('motif: Fried Liver, f7 is a king target of white', () => {
  const m = tacticalMotifs(fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5')))
  const t = m.find((x) => x.kind === 'koenigsziel' && x.side === 'white')
  assert.ok(t, 'no koenigsziel found')
  assert.deepEqual(t.squares, ['f7'])
  assert.match(t.text, /f7/)
})

test('motif: knight fork of king and rook', () => {
  const m = tacticalMotifs(valid('r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1'))
  const f = m.find((x) => x.kind === 'gabel')
  assert.ok(f, 'no gabel found')
  assert.equal(f.side, 'white')
  assert.deepEqual(f.squares, ['c7', 'a8', 'e8'])
})

test('motif: pin of the knight to the queen', () => {
  const m = tacticalMotifs(fenAfter(sans('d4 d5 c4 e6 Nc3 Nf6 Bg5')))
  const p = m.find((x) => x.kind === 'fesselung' && x.side === 'white')
  assert.ok(p, 'no fesselung found')
  assert.deepEqual(p.squares, ['g5', 'f6', 'd8'])
})

test('motif: skewer of queen and rook', () => {
  const s = tacticalMotifs(valid('4k3/8/6r1/8/4q3/8/8/1B4K1 w - - 0 1')).find((x) => x.kind === 'spiess')
  assert.ok(s, 'no spiess found')
  assert.deepEqual(s.squares, ['b1', 'e4', 'g6'])
})

test('motif: discovered check available', () => {
  const a = tacticalMotifs(valid('4k3/8/8/8/8/4N3/8/4R1K1 w - - 0 1')).find((x) => x.kind === 'abzug')
  assert.ok(a, 'no abzug found')
  assert.deepEqual(a.squares, ['e1', 'e3', 'e8'])
})

test('motif: hanging piece', () => {
  const h = tacticalMotifs(valid('4k3/8/8/3n4/8/1B6/8/4K3 w - - 0 1')).find((x) => x.kind === 'haengend')
  assert.ok(h, 'no haengend found')
  assert.equal(h.side, 'white')
  assert.deepEqual(h.squares, ['d5'])
  assert.match(h.text, /Springer auf d5 \(Schwarz\)/)
})

test('no motifs in the start position', () => {
  assert.deepEqual(tacticalMotifs(fenAfter([])), [])
})

// ---- false positives the motif detection must not report ----
const motifs = (fen: string, kind: string) => tacticalMotifs(valid(fen)).filter((m) => m.kind === kind)

test('no skewer when the front queen can take the attacking queen', () => {
  assert.deepEqual(motifs('4r1k1/4q3/8/8/8/8/4Q3/6K1 w - - 0 1', 'spiess'), [])
})

test('no discovered attack onto a piece that is not worth more than the attacker', () => {
  assert.deepEqual(motifs('3kq3/8/8/8/8/4N3/8/4Q1K1 w - - 0 1', 'abzug'), [])
})

test('no pin when the pinned bishop can simply take the pinning bishop', () => {
  assert.deepEqual(motifs('3q2k1/8/5b2/6B1/8/8/8/6K1 w - - 0 1', 'fesselung'), [])
})

test('no fork by a knight that is itself pinned to its king', () => {
  assert.deepEqual(motifs('3qr2k/6r1/4N3/8/2B5/8/8/4K3 w - - 0 1', 'gabel'), [])
})
