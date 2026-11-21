import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { bilanzText, docExcerpt, introFacts } from '../tools/lib/intro-facts.ts'
import type { Variation } from '../src/content/types.ts'
import type { DocLine, FactSources } from '../tools/lib/intro-facts.ts'

const OPENING = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'docs/repertoire-v1.8.md Abschnitt 5' }
const variation = (line: string[], extra: Partial<Variation> = {}): Variation => ({ id: 'v1', name: 'V', nameEn: 'V', line, keyPositions: [], fromDocument: false, ...extra })

/** analysis cache entries (side-to-move perspective, like Stockfish) for the positions after each ply of `line` */
function analysisFor(line: string[], cps: (number | null)[], mates: Record<number, number> = {}) {
  const g = new Chess()
  const out: FactSources['analysis'] = {}
  line.forEach((san, i) => {
    g.move(san)
    const cp = cps[i]
    if (cp === null || cp === undefined) return
    out[`${g.fen()}|18|1`] = { lines: [{ cp, mate: mates[i] ?? null }] }
  })
  return out
}
const LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']

test('facts: line in German SAN, branch after the shared entry, and the stage relation', () => {
  const f = introFacts(OPENING, variation(LINE, { partOf: 'v2' }), { analysis: {}, explorer: {} })
  assert.equal(f.zugfolge.text, '1. e4 e5 2. Sf3 Sc6 3. d4 exd4')
  assert.deepEqual(f.zugfolge.de, ['e4', 'e5', 'Sf3', 'Sc6', 'd4', 'exd4'])
  assert.deepEqual(f.abzweigung, { ply: 2, zug: '2. Sf3', san: 'Sf3', seite: 'white', vonEigenerSeite: true })
  assert.equal(f.etappe.partOf, 'v2')
})

test('facts: evaluations are white perspective whatever side moves; critical move is the largest jump', () => {
  // side-to-move cps after plies 0..5: black to move +20 => white -20 ; white to move +30 => white +30 ...
  const analysis = analysisFor(LINE, [20, 30, 25, 150, -130, 35])
  const f = introFacts(OPENING, variation(LINE), { analysis, explorer: {} })
  assert.deepEqual(f.bewertung.entlangLinie.map((e) => e.cpWeiss), [-20, 30, -25, 150, 130, 35])
  assert.equal(f.bewertung.kritischerZug?.zug, '2… Sc6')
  assert.equal(f.bewertung.kritischerZug?.sprungCp, 175)
  assert.equal(f.bewertung.kritischerZug?.vonCp, -25)
  assert.equal(f.bewertung.kritischerZug?.nachCp, 150)
  assert.deepEqual(f.bewertung.endbewertung, { ply: 5, zug: '3… exd4', cpWeiss: 35, cpEigen: 35, matt: null, amLinienende: true })
})

test('facts: turning points are the plies where the verdict changes between white better, equal and black better', () => {
  const analysis = analysisFor(LINE, [20, 30, 25, 150, -130, 35]) // white pov: -20 30 -25 150 130 35
  const f = introFacts(OPENING, variation(LINE), { analysis, explorer: {} })
  assert.deepEqual(f.bewertung.wendepunkte.map((w) => [w.zug, w.von, w.nach]), [['2… Sc6', 'ausgeglichen', 'weiss'], ['3… exd4', 'weiss', 'ausgeglichen']])
})

test('facts: a missing analysis gives null, not a crash, and a mate score is kept apart from centipawns', () => {
  const analysis = analysisFor(LINE, [20, null, 25, 30, 10, 5], { 4: 3 })
  const f = introFacts(OPENING, variation(LINE), { analysis, explorer: {} })
  assert.equal(f.bewertung.entlangLinie[1]!.cpWeiss, null)
  assert.equal(f.bewertung.entlangLinie[4]!.matt, -3, 'black is to move after ply 4 and mates: negative from white')
})

test('facts: opponent move frequencies come from the explorer cache, with share of the listed games', () => {
  const g = new Chess(); g.move('e4')
  const explorer = { [g.fen()]: [{ uci: 'e7e5', games: 600 }, { uci: 'c7c5', games: 300 }, { uci: 'e7e6', games: 100 }] }
  const f = introFacts(OPENING, variation(LINE), { analysis: {}, explorer })
  assert.equal(f.gegnerzuege.length, 1)
  const z = f.gegnerzuege[0]!
  assert.equal(z.zug, '1… e5')
  assert.deepEqual(z.gespielt, { de: 'e5', partien: 600, anteilProzent: 60 })
  assert.deepEqual(z.alternativen.map((a) => [a.de, a.anteilProzent]), [['c5', 30], ['e6', 10]])
  assert.equal(z.summePartien, 1000)
})

test('facts: end position material, structure and files are observed on the last position', () => {
  const f = introFacts(OPENING, variation(['e4', 'd5', 'exd5']), { analysis: {}, explorer: {} })
  assert.equal(f.endstellung.material.differenzEigen, 1)
  assert.equal(f.endstellung.rochade.eigen, false)
  const open = introFacts({ ...OPENING, entry: ['d4', 'e6'] }, variation(['d4', 'e6', 'e4', 'd5', 'exd5', 'exd5']), { analysis: {}, explorer: {} })
  assert.deepEqual(open.endstellung.offeneLinien, ['e'])
})

test('facts: castling is read from the line, per side', () => {
  const line = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']
  const f = introFacts(OPENING, variation(line), { analysis: {}, explorer: {} })
  assert.deepEqual(f.endstellung.rochade, { eigen: true, gegner: false })
})

const DOC = ['# T', '', '**Main Backend: Die Schottische Partie (Scotch Game)**', '- Code: 1. e4 e5 2. Sf3 Sc6 3. d4!', '- Die Logik: Wir öffnen das Zentrum.', '', '**Alternative: Italienische Partie**', '- Code: 1. e4']

test('docExcerpt gives the block of the opening with its line numbers, and stops at the next heading', () => {
  assert.deepEqual(docExcerpt(DOC.join('\n'), 'scotch'), [{ z: 3, text: '**Main Backend: Die Schottische Partie (Scotch Game)**' }, { z: 4, text: '- Code: 1. e4 e5 2. Sf3 Sc6 3. d4!' }, { z: 5, text: '- Die Logik: Wir öffnen das Zentrum.' }])
  assert.deepEqual(docExcerpt(DOC.join('\n'), 'budapest'), [])
})

test('facts are plain data: the same input gives byte-identical JSON', () => {
  const analysis = analysisFor(LINE, [20, 30, 25, 150, -130, 35])
  const a = JSON.stringify(introFacts(OPENING, variation(LINE), { analysis, explorer: {} }))
  const b = JSON.stringify(introFacts(OPENING, variation(LINE), { analysis, explorer: {} }))
  assert.equal(a, b)
})

test('facts: when the last position was never analysed the final evaluation is the last evaluated ply and says so', () => {
  const analysis = analysisFor(LINE, [20, 30, 25, 150, -130, null])
  const f = introFacts(OPENING, variation(LINE), { analysis, explorer: {} })
  assert.deepEqual(f.bewertung.endbewertung, { ply: 4, zug: '3. d4', cpWeiss: 130, cpEigen: 130, matt: null, amLinienende: false })
})

const mat = (line: string[], opening: Parameters<typeof introFacts>[0] = OPENING) => introFacts(opening, variation(line), { analysis: {}, explorer: {} }).endstellung.material

test('material: the strict count is right for the position, but a line that ends in the middle of an exchange says so and also gives the settled count', () => {
  // ...exd4 Nxd4 Nxd4: white has lost pawn and knight, black only a pawn - and white to move recaptures Qxd4
  const m = mat(['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nxd4'])
  assert.equal(m.differenzEigen, -3)
  assert.equal(m.schlagfolgeOffen, true)
  assert.deepEqual(m.beruhigt, { weiss: 35, schwarz: 35, differenzEigen: 0 })
  assert.equal(m.bilanz, 'ausgeglichen')
})

test('material: a line that ends quietly has nothing open and the settled count equals the strict one', () => {
  const m = mat(['e4', 'd5', 'exd5', 'Nf6'])
  assert.equal(m.schlagfolgeOffen, false)
  assert.equal(m.beruhigt.differenzEigen, 1)
  assert.equal(m.bilanz, '+1 Bauer')
})

test('material: the balance is read from the repertoire side, with exchange and pieces named', () => {
  const black = { ...OPENING, side: 'black' as const }
  assert.equal(mat(['e4', 'd5', 'exd5', 'Nf6'], black).bilanz, '−1 Bauer')
  const exch = mat(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3', 'Nb4'])
  assert.equal(exch.bilanz, '−1 Springer, +1 Bauer', 'white lost a knight and a pawn, black two pawns')
})

test('bilanzText names exchange, pieces and pawns from the given side, ordered by weight', () => {
  const none = { q: 0, r: 0, b: 0, n: 0, p: 0 }
  assert.equal(bilanzText(none), 'ausgeglichen')
  assert.equal(bilanzText({ ...none, r: 1, n: -1 }), 'Qualität mehr')
  assert.equal(bilanzText({ ...none, r: -1, b: 1 }), 'Qualität weniger')
  assert.equal(bilanzText({ ...none, r: -1, b: 1, p: 2 }), 'Qualität weniger, +2 Bauern')
  assert.equal(bilanzText({ ...none, q: -1 }), '−1 Dame')
  assert.equal(bilanzText({ ...none, r: 2, n: -1, b: -1 }), 'Qualität mehr, +1 Turm, −1 Springer', 'only one exchange is named, the rest as pieces')
})

import { docSequences } from '../tools/lib/intro-facts.ts'

const CARO_DOC: DocLine[] = [
  { z: 96, text: '**Die Festung: Caro-Kann Verteidigung**' },
  { z: 97, text: '- Code: 1. e4 c6 2. d4 d5' },
  { z: 98, text: '- Die Logik: Der "Docker-Container".' },
]
const CARO = { id: 'caro-kann' as const, side: 'black' as const, entry: ['e4', 'c6', 'd4', 'd5'], docRef: 'doc' }
const docOf = (opening: Parameters<typeof introFacts>[0], line: string[], dokument: DocLine[], extra: Partial<Variation> = {}) =>
  introFacts(opening, variation(line, extra), { analysis: {}, explorer: {}, dokument }).doc

test('docSequences reads the move line of "Code:"/"Züge:" lines, German SAN, and stops at the first word that is no move', () => {
  assert.deepEqual(docSequences(CARO_DOC), [{ z: 97, moves: ['e4', 'c6', 'd4', 'd5'] }])
  assert.deepEqual(docSequences([{ z: 3, text: '- Code: 1. e4 c5 2. c3 d5 (oder Sf6)' }, { z: 4, text: '- Code: ...g6, ...Lg7, ...d6' }]), [{ z: 3, moves: ['e4', 'c5', 'c3', 'd5'] }])
})

test('document relation: a Caro-Kann variation below the document line belongs to the document, an identical or shorter one is named as such', () => {
  assert.deepEqual(docOf(CARO, ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4'], CARO_DOC), { quelle: 'doc', eroeffnungImDokument: true, variantImDokument: true, bezug: 'unterhalb', codeZeile: 97 })
  assert.equal(docOf(CARO, ['e4', 'c6', 'd4', 'd5'], CARO_DOC).bezug, 'identisch')
  assert.equal(docOf(CARO, ['e4', 'c6'], CARO_DOC).bezug, 'teil')
})

test('document relation: another line, a block without move line, and fromDocument', () => {
  assert.deepEqual(docOf(CARO, ['e4', 'e5', 'Nf3'], CARO_DOC), { quelle: 'doc', eroeffnungImDokument: true, variantImDokument: false, bezug: 'keiner', codeZeile: null })
  const kid = { id: 'kings-indian' as const, side: 'black' as const, entry: ['d4', 'Nf6', 'Nf3', 'g6'], docRef: 'doc' }
  const kidDoc = [{ z: 120, text: '- Code: ...g6, ...Lg7, ...d6' }]
  assert.equal(docOf(kid, ['d4', 'Nf6', 'Nf3', 'g6', 'g3'], kidDoc).bezug, 'unterhalb', 'no move line: the entry of the opening stands for the block')
  assert.equal(docOf(CARO, ['e4', 'e5'], [], { fromDocument: true }).bezug, 'identisch', 'built from the document')
  assert.equal(docOf(CARO, ['e4', 'c6', 'd4', 'd5', 'Nc3'], []).bezug, 'keiner', 'no document block for the opening')
})
