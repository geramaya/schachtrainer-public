import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { baueAufgabe, benoetigteFens, evalKey, fallenKandidaten, zugFakten } from '../tools/lib/lehrgang-aufgaben.ts'
import type { AnalysisStore } from '../tools/lib/lehrgang-aufgaben.ts'
import { eindeutigeStellungen } from '../tools/lib/lehrgang-stellungen.ts'
import type { DatenKnoten } from '../tools/lib/lehrgang.ts'

const fenOf = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen() }
/** cp from the point of view of the side to move, like the engine reports. */
const store = (entries: [string[], number | null, number?][]): AnalysisStore => Object.fromEntries(entries.map(([sans, cp, mate]) => [evalKey(fenOf(sans)), { bestUci: 'e2e4', depth: 18, lines: [{ uci: 'e2e4', cp, mate: mate ?? null, pv: [] }] }]))
const opening = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'docs/repertoire-v1.8.md' }

test('zugFakten names what the move does: develops, castles, captures, attacks, defends, centre, check, pawn structure', () => {
  const f = zugFakten(fenOf(['e4', 'e5']), 'Nf3')
  assert.deepEqual([f.entwickeltFigur, f.rochiert, f.schlaegt, f.schach], [{ figur: 'Springer', von: 'g1', nach: 'f3' }, false, null, false])
  assert.deepEqual(f.greiftAn, [{ figur: 'Bauer', feld: 'e5' }])
  assert.ok(f.deckt.some((d) => d.feld === 'e1' || d.feld === 'h2' || d.feld === 'g1' || d.feld === 'd2'))
  const castle = zugFakten(fenOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']), 'O-O')
  assert.equal(castle.rochiert, true)
  const cap = zugFakten(fenOf(['e4', 'd5']), 'exd5')
  assert.deepEqual(cap.schlaegt, { figur: 'Bauer', feld: 'd5' })
  assert.equal(cap.zentrumBesetzt, true)
  const e4 = zugFakten(new Chess().fen(), 'e4')
  assert.deepEqual([e4.zentrumBesetzt, e4.zentrumKontrolle], [true, ['d5']])
})

test('baueAufgabe: line, mover, own/opponent, share, evaluation before and after (white view), gap flag and the facts sheet of the line', () => {
  const vs = [{ id: 'a', anteil: 0.4, zuege: ['e4', 'e5', 'Nf3'].map((san) => ({ san })) }]
  const [, e5, nf3] = eindeutigeStellungen(vs, 'white')
  const analysis = store([[[], 30], [['e4'], -25], [['e4', 'e5'], 35], [['e4', 'e5', 'Nf3'], -30]])
  const a = baueAufgabe(nf3!, { opening, analysis, explorer: {}, dokument: [], luecken: new Set([nf3!.schluessel]) })
  assert.deepEqual([a.zieher, a.eigen, a.ply, a.zug, a.zugfolge], ['white', true, 2, 'Sf3', ['e4', 'e5', 'Nf3']])
  assert.deepEqual(a.bewertung, { tiefe: 18, vorCpWeiss: 35, nachCpWeiss: 30 })
  assert.equal(a.haeufigkeit.anteil, 0.4)
  assert.equal(a.haeufigkeit.text, 'etwa 4 von 10')
  assert.equal(a.luecke, true)
  assert.equal(a.fakten.zugfolge.plies, 3)
  const b = baueAufgabe(e5!, { opening, analysis, explorer: {}, dokument: [], luecken: new Set() })
  assert.equal(b.eigen, false)
  assert.equal(b.luecke, false)
  assert.deepEqual(b.bewertung, { tiefe: 18, vorCpWeiss: 25, nachCpWeiss: 35 })
})

test('benoetigteFens: the start position and the position after every move of every line, each once', () => {
  const st = eindeutigeStellungen([{ id: 'a', anteil: 1, zuege: [{ san: 'e4' }, { san: 'e5' }] }, { id: 'b', anteil: 1, zuege: [{ san: 'e4' }, { san: 'c5' }] }], 'white')
  assert.equal(benoetigteFens(st).length, 4)
})

test('fallenKandidaten: a frequent opponent move that costs the engine value of 2 pawns or more, ranked by how often the path occurs; rare or harmless moves are not listed', () => {
  const baum: DatenKnoten[] = [
    { san: 'e5', uci: 'e7e5', eigen: false, spiele: 600, anteil: 0.6, kinder: [{ san: 'Nf3', uci: 'g1f3', eigen: true, kinder: [{ san: 'Qh4', uci: 'd8h4', eigen: false, spiele: 90, anteil: 0.9, kinder: [] }, { san: 'Nc6', uci: 'b8c6', eigen: false, spiele: 10, anteil: 0.1, kinder: [] }] }] },
    { san: 'c5', uci: 'c7c5', eigen: false, spiele: 400, anteil: 0.4, kinder: [] },
  ]
  // after e4: black to move; best for black ~ 0.  e5 fine.  After e4 e5 Nf3: black to move; Qh4 loses: position after Qh4 white to move +300 (white pov)
  const analysis = store([
    [['e4'], -20], [['e4', 'e5'], 30], [['e4', 'e5', 'Nf3'], -25],
    [['e4', 'e5', 'Nf3', 'Qh4'], 290], [['e4', 'e5', 'Nf3', 'Nc6'], 30], [['e4', 'c5'], 25],
  ])
  const r = fallenKandidaten(baum, ['e4'], analysis, { mindestAnteil: 0.03, verlustCp: 200, max: 3 })
  assert.equal(r.length, 1)
  assert.deepEqual(r[0]!.zugfolge, ['e4', 'e5', 'Nf3', 'Qh4'])
  assert.equal(r[0]!.verlustCp, 265)
  assert.ok(Math.abs(r[0]!.pfadAnteil - 0.6 * 0.9) < 1e-9)
})

import { baumFens, mitSeltenenZuegen } from '../tools/lib/lehrgang-aufgaben.ts'

test('mitSeltenenZuegen adds explorer replies the walk pruned (share at the position >= the minimum) as leaves; known replies and own moves stay as they are', () => {
  const baum: DatenKnoten[] = [{ san: 'e5', uci: 'e7e5', eigen: false, spiele: 60, anteil: 0.6, kinder: [{ san: 'Nf3', uci: 'g1f3', eigen: true, kinder: [{ san: 'Nc6', uci: 'b8c6', eigen: false, spiele: 90, anteil: 0.9, kinder: [] }] }] }]
  const explorer = { [fenOf(['e4', 'e5', 'Nf3'])]: [{ uci: 'b8c6', games: 900 }, { uci: 'd8h4', games: 60 }, { uci: 'a7a6', games: 1 }] }
  const r = mitSeltenenZuegen(baum, ['e4'], explorer, 0.03)
  const kinder = r[0]!.kinder[0]!.kinder
  assert.deepEqual(kinder.map((k) => k.san), ['Nc6', 'Qh4'])
  assert.ok(Math.abs(kinder[1]!.anteil! - 60 / 961) < 1e-9)
  assert.equal(baum[0]!.kinder[0]!.kinder.length, 1) // input untouched
  assert.equal(baumFens(r, ['e4']).length, 5) // after the entry, e5, Nf3, Nc6, Qh4
})

import { pfadAnteile } from '../tools/lib/lehrgang-aufgaben.ts'
import { stellungsSchluessel } from '../tools/lib/lehrgang-stellungen.ts'

test('pfadAnteile: the share of games that reach a move: entry moves 1, an opponent move multiplies its share, an own move keeps the share of its position', () => {
  const baum: DatenKnoten[] = [{ san: 'e5', uci: 'e7e5', eigen: false, spiele: 60, anteil: 0.6, kinder: [{ san: 'Nf3', uci: 'g1f3', eigen: true, kinder: [{ san: 'Nc6', uci: 'b8c6', eigen: false, spiele: 90, anteil: 0.9, kinder: [] }] }] }]
  const m = pfadAnteile(baum, ['e4'])
  const k = (sans: string[], san: string) => stellungsSchluessel(fenOf(sans), san)
  assert.equal(m.get(k([], 'e4')), 1)
  assert.equal(m.get(k(['e4'], 'e5')), 0.6)
  assert.equal(m.get(k(['e4', 'e5'], 'Nf3')), 0.6)
  assert.ok(Math.abs(m.get(k(['e4', 'e5', 'Nf3'], 'Nc6'))! - 0.54) < 1e-9)
})
