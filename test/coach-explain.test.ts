import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeMove, planFromPv, evalStatement } from '../src/coach/explain.ts'
import { fenAfter } from './fake-engine.ts'

const sans = (s: string) => s.split(' ')

test('describeMove: capture with check names piece, victim, square, check, German notation', () => {
  const before = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Bc5'))
  const text = describeMove(before, 'c4f7', { bookStatus: 'abweichung' }).join(' ')
  assert.match(text, /Lxf7\+/)
  assert.match(text, /Läufer schlägt .*Bauern.* f7/)
  assert.match(text, /Schach/)
  assert.match(text, /Abweichung/)
})

test('describeMove: evaluation drop from the mover side is named by size', () => {
  const before = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Bc5'))
  const big = describeMove(before, 'c4f7', { bookStatus: 'ausserhalb', evalBefore: 30, evalAfter: -250 }).join(' ')
  assert.match(big, /Patzer/)
  const fine = describeMove(before, 'c4f7', { bookStatus: 'ausserhalb', evalBefore: 30, evalAfter: 20 }).join(' ')
  assert.doesNotMatch(fine, /Patzer|Fehler|Ungenau/)
})

test('describeMove: castling, promotion and illegal moves', () => {
  const castle = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Bc5'))
  assert.match(describeMove(castle, 'e1g1', { bookStatus: 'theorie' }).join(' '), /rochiert kurz/)
  assert.deepEqual(describeMove(castle, 'a1a8', { bookStatus: 'theorie' }), [])
})

test('planFromPv: numbered line with the opponent replies, in German notation, plus pressure target', () => {
  const fen = fenAfter(sans('e4 e5 Nf3 Nc6'))
  const plan = planFromPv(fen, ['f1c4', 'g8f6', 'f3g5'])
  assert.match(plan, /^Hauptvariante: 3\. Lc4 Sf6 4\. Sg5/)
  assert.match(plan, /Druck auf f7/)
})

test('planFromPv: black to move starts with the ellipsis and keeps the white reply', () => {
  const fen = fenAfter(sans('e4 e5 Nf3'))
  assert.equal(planFromPv(fen, ['b8c6', 'f1c4']), 'Hauptvariante: 2… Sc6 3. Lc4')
})

test('planFromPv: single move, empty and broken pv', () => {
  const fen = fenAfter(sans('e4 e5'))
  assert.equal(planFromPv(fen, ['g1f3']), 'Hauptvariante: 2. Sf3')
  assert.equal(planFromPv(fen, []), '')
  assert.equal(planFromPv(fen, ['a1a8']), '')
})

import { createCoachCache, engineReport, limitShapes, staticReport } from '../src/coach/explain.ts'
import type { Chance, ShapeKind } from '../src/coach/explain.ts'
import { positionKey } from '../src/chess/position.ts'
import { fakeEngine } from './fake-engine.ts'

const FRIED = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5'))

test('staticReport: chances of the Fried Liver position, all from rules', () => {
  const r = staticReport({ fen: FRIED, ownSide: 'white', prevFen: fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6')), lastUci: 'f3g5', bookStatus: 'theorie' })
  const weak = r.chances.find((c) => c.kind === 'weak')
  assert.ok(weak, 'f7 should be a weak square')
  assert.equal(weak.shape.orig, 'f7')
  assert.equal(weak.shape.dest, undefined)
  assert.match(weak.statement.text, /f7/)
  assert.ok(r.chances.every((c) => c.statement.source === 'regel'))
  assert.match(r.happened.map((s) => s.text).join(' '), /Sg5/)
  assert.equal(r.rows.find((x) => x.label === 'Entwicklung')!.edge, null)
})

test('staticReport: quiet start position has no chances and is balanced', () => {
  const r = staticReport({ fen: fenAfter([]), ownSide: 'white' })
  assert.deepEqual(r.chances, [])
  assert.equal(r.summary, 'Ausgeglichen')
  assert.deepEqual(r.happened, [])
})

test('staticReport: labels are digits for own/weak, letters for the opponent', () => {
  const r = staticReport({ fen: FRIED, ownSide: 'black' })
  assert.ok(r.chances.length > 0)
  for (const c of r.chances) assert.match(c.label, c.kind === 'opp' ? /^[A-Z]$/ : /^\d$/)
  assert.ok(r.chances.some((c) => c.kind === 'weak'))
})

test('limitShapes: at most four, own chances first', () => {
  const mk = (kind: ShapeKind, n: number): Chance => ({ id: `${kind}${n}`, kind, label: String(n), statement: { text: '', source: 'regel' }, shape: { id: `${kind}${n}`, kind, label: String(n), orig: 'a1' } })
  const out = limitShapes([mk('weak', 1), mk('opp', 2), mk('opp', 3), mk('own', 4), mk('own', 5), mk('weak', 6)])
  assert.equal(out.length, 4)
  assert.deepEqual(out.map((s) => s.kind), ['own', 'own', 'opp', 'opp'])
})

test('engineReport: threat, plan and evaluation jump carry the Stockfish source; second call is cached', async () => {
  const prev = fenAfter(sans('e4 e5 Nf3 Nc6 Bc4 Nf6'))
  const nullFen = FRIED.replace(' b ', ' w ')
  const eng = fakeEngine({
    [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', cp: -20, pv: ['d7d5', 'e4d5', 'f6d5'] }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 300 }] },
    [positionKey(prev)]: { lines: [{ uci: 'f3g5', cp: 30, pv: ['f3g5'] }] },
  })
  const cache = createCoachCache()
  const inp = { fen: FRIED, ownSide: 'white' as const, prevFen: prev, lastUci: 'f3g5' }
  const r = await engineReport(inp, eng, 14, cache)
  assert.ok(r.chances.some((c) => c.kind === 'own' && /droht Sxf7/.test(c.statement.text) && c.statement.source === 'stockfish Tiefe 14'))
  assert.ok(r.why.length > 0 && r.why.every((s) => s.source === 'stockfish Tiefe 14'))
  assert.ok(r.happened.some((s) => /Die Bewertung/.test(s.text)))
  const calls = eng.calls.length
  await engineReport(inp, eng, 14, cache)
  assert.equal(eng.calls.length, calls)
})

test('engineReport: finished position never reaches the engine', async () => {
  const mate = fenAfter(sans('f3 e5 g4 Qh4#'))
  const eng = fakeEngine()
  const r = await engineReport({ fen: mate, ownSide: 'white' }, eng, 14, createCoachCache())
  assert.deepEqual([r.why, r.chances, r.happened], [[], [], []])
  assert.equal(eng.calls.length, 0)
})

test('engineReport: mate in more than one is not called "setzt matt"', async () => {
  const nullFen = FRIED.replace(' b ', ' w ')
  const eng = fakeEngine({
    [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', mate: 3 }] },
  })
  const r = await engineReport({ fen: FRIED, ownSide: 'white' }, eng, 14, createCoachCache())
  const t = r.chances.find((c) => /droht Sxf7/.test(c.statement.text))!
  assert.match(t.statement.text, /Matt in 3/)
  assert.doesNotMatch(t.statement.text, /setzt matt/)
})

test('engineReport: mate in one says "setzt matt"', async () => {
  const nullFen = FRIED.replace(' b ', ' w ')
  const eng = fakeEngine({
    [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', cp: 0 }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', mate: 1 }] },
  })
  const r = await engineReport({ fen: FRIED, ownSide: 'white' }, eng, 14, createCoachCache())
  assert.match(r.chances.find((c) => /droht Sxf7/.test(c.statement.text))!.statement.text, /setzt matt/)
})

test('engineReport: labels of arrows to the same square are distinct objects with distinct ids', async () => {
  const r = staticReport({ fen: FRIED, ownSide: 'black' })
  assert.equal(new Set(r.chances.map((c) => c.id)).size, r.chances.length)
})

test('engineReport: whiteCp is the evaluation from the side of White; finished positions have none', async () => {
  const nullFen = FRIED.replace(' b ', ' w ')
  const eng = fakeEngine({
    [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', cp: -20, pv: ['d7d5'] }] },
    [positionKey(nullFen)]: { lines: [{ uci: 'g5f7', cp: 300 }] },
  })
  const r = await engineReport({ fen: FRIED, ownSide: 'white' }, eng, 14, createCoachCache())
  assert.equal(r.whiteCp, 20) // black to move with -20 for black
})

const FRIED_MATE = async (mate: number) => {
  const eng = fakeEngine({ [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', mate, pv: ['d7d5'] }] } })
  return engineReport({ fen: FRIED, ownSide: 'white' }, eng, 14, createCoachCache())
}

test('engineReport: black to move and mated (engine mate -2) says White mates in 2, whiteMate +2', async () => {
  const r = await FRIED_MATE(-2)
  const text = r.why.map((s) => s.text).join(' ')
  assert.match(text, /Weiß setzt in 2 Zügen matt/)
  assert.doesNotMatch(text, /Schwarz setzt/)
  assert.equal(r.whiteMate, 2)
})

test('engineReport: black to move and mating (engine mate 3) says Black mates in 3, whiteMate -3', async () => {
  const r = await FRIED_MATE(3)
  const text = r.why.map((s) => s.text).join(' ')
  assert.match(text, /Schwarz setzt in 3 Zügen matt/)
  assert.equal(r.whiteMate, -3)
})

test('engineReport: a normal evaluation has no whiteMate and mate in one uses the singular', async () => {
  const eng = fakeEngine({ [positionKey(FRIED)]: { lines: [{ uci: 'd7d5', cp: -20 }] } })
  assert.equal((await engineReport({ fen: FRIED, ownSide: 'white' }, eng, 14, createCoachCache())).whiteMate, null)
  assert.match((await FRIED_MATE(1)).why[0]!.text, /Schwarz setzt in 1 Zug matt/)
})

test('evalStatement: a mate score is worded as mate for a side, never as a pawn value', () => {
  assert.match(evalStatement('white', 120, 10000).text, /Matt für Weiß/)
  assert.match(evalStatement('white', 120, -10000).text, /Matt für Schwarz/)
  assert.doesNotMatch(evalStatement('white', 120, -10000).text, /100,00|98,8/)
})

test('the shared analysis cache stays bounded', async () => {
  const { cachedEngine, createCoachCache } = await import('../src/coach/explain.ts')
  const { Chess } = await import('chess.js')
  const fens: string[] = []
  for (const a of new Chess().moves()) for (const b of (() => { const c = new Chess(); c.move(a); return c })().moves()) { const c = new Chess(); c.move(a); c.move(b); fens.push(c.fen()) }
  assert.ok(fens.length >= 400)
  const cache = createCoachCache()
  const engine = { analyse: async () => ({ bestUci: 'e2e4', depth: 1, lines: [] }) } as never
  const cached = cachedEngine(engine, cache)
  for (const f of fens) await cached.analyse(f, { depth: 14 })
  assert.ok(cache.analysis.size <= 300, `size ${cache.analysis.size}`)
})
