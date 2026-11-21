import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { repertoireNote, repertoireSentence } from '../src/teacher/repertoire.ts'
import { lineBundle } from './helpers.ts'

const b = lineBundle(['e4', 'e5', 'Nf3', 'Nc6', 'd4'], true, { 1: ['c5'] })
const uci = (fen: string, san: string) => { const m = new Chess(fen).move(san); return m.from + m.to + (m.promotion ?? '') }
const play = (sans: string[]) => { const c = new Chess(); const u: string[] = []; for (const s of sans) { const m = c.move(s); u.push(m.from + m.to) } return { ucis: u, fen: c.fen() } }

test('own move from the tree: Repertoire hit with the move', () => {
  const g = play(['e4', 'e5'])
  const n = repertoireNote(g.ucis, uci(g.fen, 'Nf3'), new Chess().fen(), b, 'scotch', {}, 'white')
  assert.deepEqual(n, { kind: 'treffer', san: 'Nf3' })
})

test('own move off the tree: deviation names the planned move', () => {
  const g = play(['e4', 'e5'])
  const n = repertoireNote(g.ucis, uci(g.fen, 'Bc4'), new Chess().fen(), b, 'scotch', {}, 'white')
  assert.deepEqual(n, { kind: 'abweichung', plannedSan: 'Nf3' })
  assert.match(repertoireSentence(n!, 'x'), /weichst du von deinem Repertoire ab/)
  assert.doesNotMatch(repertoireSentence(n!, 'x'), /Sf3/, 'the planned move only on request')
  assert.match(repertoireSentence(n!, 'x', true), /Sf3/)
})

test('opponent reply that is known: no note; unknown reply: leaves the theory', () => {
  const g = play(['e4'])
  assert.equal(repertoireNote(g.ucis, uci(g.fen, 'c5'), new Chess().fen(), b, 'scotch', {}, 'white'), null)
  assert.deepEqual(repertoireNote(g.ucis, uci(g.fen, 'e6'), new Chess().fen(), b, 'scotch', {}, 'white'), { kind: 'gegner' })
})

test('once out of the book, later moves get no repertoire note', () => {
  const g = play(['e4', 'e6', 'd4'])
  assert.equal(repertoireNote(g.ucis, uci(g.fen, 'd5'), new Chess().fen(), b, 'scotch', {}, 'white'), null)
})

test('a game that starts outside the tree (position without a node): no repertoire note at all', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3'
  const m = new Chess(fen).move('Bc4')
  assert.equal(repertoireNote([], m.from + m.to, fen, b, 'scotch', {}, 'white'), null)
})
