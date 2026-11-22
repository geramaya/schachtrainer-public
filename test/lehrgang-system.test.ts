import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baueSystem, raetselPruefung, SYSTEM_IDEE_IDS, systemFens, systemStellungen } from '../tools/lib/lehrgang-system.ts'
import type { SystemSrc } from '../tools/lib/lehrgang-system.ts'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLehrgaenge } from '../tools/lib/lehrgang-build.ts'
import { Chess } from 'chess.js'
import { baueAufgabe, evalKey } from '../tools/lib/lehrgang-aufgaben.ts'
import type { AnalysisStore } from '../tools/lib/lehrgang-aufgaben.ts'
import { pruefeSystem } from '../tools/lib/lehrgang-check.ts'

const TODO = 'TODO texter'
const LINE = ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5']
const MAIN = [...LINE, 'Nf3', 'e6', 'Be2', 'c5']
const mz = (san: string, extra: object = {}) => ({ san, satz: TODO, ...extra })
const muster = (id: string) => ({ id, titel: TODO, weiss: TODO, schwarz: TODO, jahr: TODO, event: TODO, quelle: TODO, platzhalter: true as const, pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6', kommentare: [{ ply: 6, satz: TODO }] })
const fixture = (): SystemSrc => ({
  id: 'vorstoss', titel: TODO, zuege: LINE,
  idee: SYSTEM_IDEE_IDS.map((id) => ({ id, titel: id, satz: TODO })),
  hauptlinie: { zuege: MAIN.map((s) => mz(s)), aeste: [{ id: 'a1', ab: 6, satz: TODO, anteil: 0.1, zuege: [mz('f4'), mz('e6')] }] },
  motive: [{ id: 'm1', titel: TODO, satz: TODO, fen: 'rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq - 2 4', raetsel: [{ id: 'r1', fen: 'rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq - 2 4', loesung: ['e6'], hinweis: TODO, satz: TODO }] }],
  musterpartien: [muster('p1'), muster('p2')],
})
const build = (s: SystemSrc) => { const fehler: string[] = []; const r = baueSystem(s, 'caro-kann', fehler); return { r, fehler } }

test('system build: a valid system is built with positions, uci moves and the position defaults', () => {
  const { r, fehler } = build(fixture())
  assert.deepEqual(fehler, [])
  assert.equal(r!.hauptlinie.zuege.length, 10)
  assert.equal(r!.hauptlinie.zuege[0]!.uci, 'e2e4')
  assert.equal(r!.idee[0]!.zuege.join(' '), LINE.join(' '))
  assert.equal(r!.hauptlinie.aeste[0]!.zuege[0]!.uci, 'f2f4')
  assert.deepEqual(r!.motive[0]!.raetsel[0]!.loesungUci, ['e7e6'])
  assert.equal(r!.motive[0]!.fen.split(' ')[1], 'b')
})

test('system build: an illegal main-line move, a main line that leaves the system line and a plan reference to nowhere are reported with the place', () => {
  const s = fixture(); s.hauptlinie.zuege[7] = mz('Qh5')
  assert.match(build(s).fehler.join('\n'), /hauptlinie Zug 8 "Qh5" ist nicht legal/)
  const t = fixture(); t.hauptlinie.zuege[4] = mz('Nf3')
  assert.match(build(t).fehler.join('\n'), /beginnt nicht mit der Systemlinie/)
  const u = fixture(); u.hauptlinie.zuege[6] = mz('Nf3', { plan: 'nirgends' })
  assert.match(build(u).fehler.join('\n'), /plan "nirgends"/)
})

test('system build: the five idea sections are required in order; marks are checked on the board of the section', () => {
  const s = fixture(); s.idee.pop()
  assert.match(build(s).fehler.join('\n'), /idee: Abschnitte/)
  const t = fixture(); t.idee[0]!.pfeile = ['Gf5c2']; t.idee[1]!.pfeile = ['Gh3h5']
  const f = build(t).fehler.join('\n')
  assert.doesNotMatch(f, /Gf5c2/)
  assert.match(f, /Gh3h5.*leer/)
})

test('system build: a branch must start at a position of the main line, deviate from the main move and be legal; exactly 3 branches are required for a finished system only through the scaffold, so any count builds', () => {
  const s = fixture(); s.hauptlinie.aeste[0]!.zuege[0] = mz('Nf3')
  assert.match(build(s).fehler.join('\n'), /weicht nicht von der Hauptlinie ab/)
  const t = fixture(); t.hauptlinie.aeste[0]!.ab = 99
  assert.match(build(t).fehler.join('\n'), /ab 99/)
  const u = fixture(); u.hauptlinie.aeste[0]!.zuege[1] = mz('Qh5')
  assert.match(build(u).fehler.join('\n'), /Ast a1 Zug 2 "Qh5" ist nicht legal/)
})

test('system build: puzzle solutions may be SAN or UCI, several moves with replies; an illegal one, an invalid fen and 0 or 3 puzzles per motif are reported', () => {
  const s = fixture(); s.motive[0]!.raetsel[0]!.loesung = ['e7e6', 'Bb5', 'Nd7']
  const ok = build(s)
  assert.deepEqual(ok.fehler, [])
  assert.deepEqual(ok.r!.motive[0]!.raetsel[0]!.loesungUci, ['e7e6', 'f1b5', 'b8d7'])
  assert.deepEqual(ok.r!.motive[0]!.raetsel[0]!.loesung, ['e6', 'Bb5', 'Nd7'])
  const t = fixture(); t.motive[0]!.raetsel[0]!.loesung = ['Qh4']
  assert.match(build(t).fehler.join('\n'), /Rätsel r1: Lösungszug 1 "Qh4"/)
  const u = fixture(); u.motive[0]!.raetsel[0]!.fen = 'kaputt'
  assert.match(build(u).fehler.join('\n'), /Stellung \(FEN\) ist ungültig/)
  const v = fixture(); v.motive[0]!.raetsel = []
  assert.match(build(v).fehler.join('\n'), /1 bis 2 Rätsel/)
})

test('system build: 2 to 3 model games, each with legal moves; the model game of a system is built like a normal one', () => {
  const s = fixture(); s.musterpartien = [muster('p1')]
  assert.match(build(s).fehler.join('\n'), /2 bis 3 Musterpartien/)
  const t = fixture(); t.musterpartien[0]!.pgn = '1. e4 c6 2. Qh6'
  assert.match(build(t).fehler.join('\n'), /musterpartien.*p1.*nicht legal/)
  assert.equal(build(fixture()).r!.musterpartien.length, 2)
})


function lehrgangMitSystem(system: unknown) {
  const root = mkdtempSync(join(tmpdir(), 'lgs-'))
  const dir = join(root, 'caro-kann')
  mkdirSync(join(dir, 'systeme', 'vorstoss'), { recursive: true })
  writeFileSync(join(dir, 'lehrgang.json'), JSON.stringify({ id: 'caro-kann', name: 'CK', side: 'black', entry: ['e4', 'c6', 'd4', 'd5'], band: '1200–1600' }))
  writeFileSync(join(dir, 'spielplan.md'), ['Idee', 'Deine Züge', 'Pläne', 'Fallen', 'Wenn Unbekanntes kommt'].map((h) => `## ${h}\n\nfertig\n`).join('\n'))
  writeFileSync(join(dir, 'varianten.json'), '[]')
  writeFileSync(join(dir, 'fallen.json'), '[]')
  writeFileSync(join(dir, 'systeme', 'vorstoss', 'system.json'), JSON.stringify(system))
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}

test('build: systeme/<id>/system.json becomes lehrgang.systeme and every TODO text of it counts as open; a broken system is reported with its place', () => {
  const ok = lehrgangMitSystem(fixture())
  try {
    const r = buildLehrgaenge(ok.root)
    assert.deepEqual(r.fehler, [])
    assert.equal(r.lehrgaenge[0]!.systeme!.length, 1)
    assert.equal(r.lehrgaenge[0]!.offen, 25) // titel 1, idee 5, hauptlinie 10, ast 1+2, motiv 2, raetsel 2, muster comments 2
  } finally { ok.done() }
  const kaputt = fixture(); kaputt.hauptlinie.zuege[7] = mz('Qh5')
  const bad = lehrgangMitSystem(kaputt)
  try { assert.match(buildLehrgaenge(bad.root).fehler.join('\n'), /caro-kann\/systeme\/vorstoss: hauptlinie Zug 8/) } finally { bad.done() }
})


const gebaut = (s: SystemSrc = fixture()) => { const f: string[] = []; const r = baueSystem(s, 'caro-kann', f)!; assert.deepEqual(f, []); return r }
const ana = (entries: [string, string, number][]): AnalysisStore => Object.fromEntries(entries.map(([fen, best, cp]) => [evalKey(fen), { bestUci: best, depth: 18, lines: [{ uci: best, cp, mate: null, pv: [] }] }]))
const fenNach = (sans: string[]) => { const c = new Chess(); sans.forEach((x) => c.move(x)); return c.fen() }

test('system sheets: one position+move per main-line move, branch move, idea/motif board with moves and commented model-game ply; FEN-only boards get none', () => {
  const sys = gebaut()
  const keys = systemStellungen(sys, 'black')
  const lines = keys.map((k) => k.line.join(' '))
  assert.ok(lines.includes('e4 c6 d4 d5 e5 Bf5 Nf3'), 'main line move 7')
  assert.ok(lines.includes('e4 c6 d4 d5 e5 Bf5 f4 e6'), 'branch move 2')
  assert.ok(lines.includes('e4 c6 d4 d5 e5 Bf5'), 'idea board by moves')
  assert.equal(new Set(keys.map((k) => k.schluessel)).size, keys.length, 'each key once')
  assert.equal(keys.filter((k) => k.zieher === 'black' && k.eigen).length > 0, true)
  assert.deepEqual(systemFens(sys), ['rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq - 2 4'], 'FEN-only boards (motif + puzzle, same fen once)')
})

test('system puzzles: the engine record holds best move and the solver view of the solution; a solution that is not the best move is judged by its loss', () => {
  const sys = gebaut()
  const fen = sys.motive[0]!.raetsel[0]!.fen
  const after = fenNach([...LINE, 'Nf3', 'e6'])
  // solver (Black) sees +30 at the puzzle, White (to move after e6) sees -30: the solution keeps +30
  const p = raetselPruefung(sys, ana([[fen, 'e7e6', 30], [after, 'f1e2', -30]]))[0]!
  assert.deepEqual([p.loesungUci, p.bestUci, p.cpBest, p.cpLoesung], ['e7e6', 'e7e6', 30, 30])
  assert.deepEqual(pruefeSystem(sys, { stellungen: [], fenBewertung: {}, raetsel: [p] }, 'x'), [], 'best move: no problem about the puzzle')
  const schlecht = { ...p, bestUci: 'g8f6', cpBest: 80 }
  assert.match(pruefeSystem(sys, { stellungen: [], fenBewertung: {}, raetsel: [schlecht] }, 'x').join('\n'), /Rätsel m1\/r1.*nicht der Bestzug g8f6.*50/)
  const knapp = { ...p, bestUci: 'g8f6', cpBest: 45 }
  assert.deepEqual(pruefeSystem(sys, { stellungen: [], fenBewertung: {}, raetsel: [knapp] }, 'x'), [], 'within 30 cp of the best move counts as equal')
  assert.match(pruefeSystem(sys, { stellungen: [], fenBewertung: {}, raetsel: [] }, 'x').join('\n'), /Rätsel m1\/r1.*nicht bewertet/)
})

test('system check: a written sentence is checked against the fact sheet of its position (wrong move, evaluation word); placeholders and unknown positions are handled', () => {
  const s = fixture()
  s.hauptlinie.zuege[6]!.satz = 'Weiß entwickelt den Springer nach f3.'
  const sys = gebaut(s)
  const stellungen = systemStellungen(sys, 'black')
  const analysis = ana([[new Chess().fen(), 'e2e4', 20]])
  const opening = { id: 'caro-kann' as never, side: 'black' as const, entry: ['e4', 'c6', 'd4', 'd5'], docRef: 'docs/repertoire-v1.8.md' }
  const sheets = stellungen.map((st) => baueAufgabe(st, { opening, analysis, explorer: {}, dokument: [], luecken: new Set() }))
  const unprueft = { stellungen: sheets, fenBewertung: {}, raetsel: [] }
  const ohneRaetsel = pruefeSystem(sys, unprueft, 'x').filter((p) => !/Rätsel/.test(p))
  assert.deepEqual(ohneRaetsel, [])
  const falsch = gebaut({ ...s, hauptlinie: { ...s.hauptlinie, zuege: s.hauptlinie.zuege.map((z, i) => (i === 6 ? { ...z, satz: 'Weiß spielt 7. Lb5 und steht klar besser.' } : z)) } })
  assert.match(pruefeSystem(falsch, unprueft, 'x').filter((p) => !/Rätsel/.test(p)).join('\n'), /Lb5|Bewertung|passt nicht/)
  assert.match(pruefeSystem(sys, { ...unprueft, stellungen: [] }, 'x').filter((p) => !/Rätsel/.test(p)).join('\n'), /nicht in aufgaben/)
})

import { raetselFens } from '../tools/lib/lehrgang-system.ts'

test('system puzzles: a solution that mates ends the game, so that position is not sent to the engine and counts as a forced win', () => {
  const s = fixture()
  s.motive[0]!.raetsel[0] = { id: 'r1', fen: fenNach(['f3', 'e5', 'g4']), loesung: ['Qh4'], hinweis: TODO, satz: TODO }
  const sys = gebaut(s)
  assert.deepEqual(raetselFens(sys), [fenNach(['f3', 'e5', 'g4'])])
  const p = raetselPruefung(sys, ana([[fenNach(['f3', 'e5', 'g4']), 'd8h4', 9999]]))[0]!
  assert.deepEqual([p.bestUci, p.loesungUci, p.mattLoesung], ['d8h4', 'd8h4', true])
  assert.deepEqual(pruefeSystem(sys, { stellungen: [], fenBewertung: {}, raetsel: [p] }, 'x').filter((x) => /Rätsel/.test(x)), [])
})
