import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { buildLehrgaenge, TODO } from '../tools/lib/lehrgang-build.ts'
import { baueAufgabe, evalKey } from '../tools/lib/lehrgang-aufgaben.ts'
import type { AnalysisStore } from '../tools/lib/lehrgang-aufgaben.ts'
import { musterSchluessel, parsePgnZuege, musterStellungen } from '../tools/lib/lehrgang-muster.ts'
import { pruefeMuster, pruefeZiel } from '../tools/lib/lehrgang-check.ts'
import { stellungsSchluessel } from '../tools/lib/lehrgang-stellungen.ts'

const PLAN = ['Idee', 'Deine Züge', 'Pläne', 'Fallen', 'Wenn Unbekanntes kommt'].map((h) => `## ${h}\n\n${TODO}\n`).join('\n')
const meta = { id: 'test', name: 'Testgang', side: 'white', entry: ['e4', 'e5'], band: '1200–1600' }
const LINE = ['e4', 'e5', 'Nf3', 'Nc6']

function setup(over: { varianten?: unknown; muster?: unknown } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'lgx-'))
  const dir = join(root, 'test')
  mkdirSync(dir)
  writeFileSync(join(dir, 'lehrgang.json'), JSON.stringify(meta))
  writeFileSync(join(dir, 'spielplan.md'), PLAN)
  writeFileSync(join(dir, 'varianten.json'), JSON.stringify(over.varianten ?? [{ id: 'v1', name: 'x', stufe: 'kern', anteil: 0.4, zuege: LINE.map((san) => ({ san, satz: 'ok' })) }]))
  writeFileSync(join(dir, 'fallen.json'), '[]')
  if (over.muster) writeFileSync(join(dir, 'musterpartien.json'), JSON.stringify(over.muster))
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}
const muster = (over: Record<string, unknown> = {}) => ({ id: 'm1', titel: 'Testpartie', weiss: 'A', schwarz: 'B', jahr: 1900, event: 'Turnier', quelle: 'https://example.org/p', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *', kommentare: [{ ply: 3, satz: 'Der Springer greift e5 an.', status: 'entwurf', pfeile: ['Gf3e5'] }], ...over })

test('build: herkunft and neu of a move reach the app data, a move without them stays plain', () => {
  const s = setup({ varianten: [{ id: 'v1', name: 'x', stufe: 'kern', anteil: 0.4, zuege: [{ san: 'e4', satz: 'a' }, { san: 'e5', satz: 'b', herkunft: 'daten' }, { san: 'Nf3', satz: 'c', herkunft: 'repertoire', neu: true }] }] })
  try {
    const z = buildLehrgaenge(s.root).lehrgaenge[0]!.varianten[0]!.zuege
    assert.deepEqual(z.map((x) => x.herkunft ?? null), [null, 'daten', 'repertoire'])
    assert.deepEqual(z.map((x) => x.neu ?? false), [false, false, true])
  } finally { s.done() }
})

test('build: ziel sentences (2 to 3) become the goal list of the variety and placeholders count as open', () => {
  const s = setup({ varianten: [{ id: 'v1', name: 'x', stufe: 'kern', anteil: 0.4, zuege: LINE.map((san) => ({ san, satz: 'ok' })), ziel: [{ satz: 'Du willst d4 durchsetzen.', status: 'entwurf', quelle: 'Wikipedia https://de.wikipedia.org/wiki/Schach' }, { satz: TODO }] }] })
  try {
    const r = buildLehrgaenge(s.root)
    assert.deepEqual(r.fehler, [])
    const v = r.lehrgaenge[0]!.varianten[0]!
    assert.deepEqual(v.ziel.map((x) => x.satz), ['Du willst d4 durchsetzen.', TODO])
    assert.deepEqual(v.ziel[0]!.quelle, ['Wikipedia https://de.wikipedia.org/wiki/Schach'])
    assert.equal(r.lehrgaenge[0]!.offen, 5 + 1)
  } finally { s.done() }
})

test('build: a goal list with one or four sentences is reported with the place', () => {
  for (const n of [1, 4]) {
    const s = setup({ varianten: [{ id: 'v1', name: 'x', stufe: 'kern', anteil: 0.4, zuege: LINE.map((san) => ({ san, satz: 'ok' })), ziel: Array.from({ length: n }, () => ({ satz: TODO })) }] })
    try { assert.match(buildLehrgaenge(s.root).fehler.join('\n'), /test\/v1.*ziel.*2.*3/i) } finally { s.done() }
  }
})

test('pgn: move numbers, comments, variations, NAGs and the result are skipped', () => {
  assert.deepEqual(parsePgnZuege('1. e4 {Mitte} e5 2. Nf3 (2. f4 exf4) Nc6 $1 3. Bc4 1/2-1/2'), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  assert.deepEqual(parsePgnZuege('1.e4 e5 2.Nf3 *'), ['e4', 'e5', 'Nf3'])
})

test('build: a model game becomes moves with uci and comments with marks; its placeholders count as open', () => {
  const s = setup({ muster: [muster({ kommentare: [{ ply: 3, satz: 'Der Springer greift e5 an.', status: 'entwurf', pfeile: ['Gf3e5'], felder: 'Re5', quelle: 'x https://lichess.org/abc' }, { ply: 5, satz: TODO }] })] })
  try {
    const r = buildLehrgaenge(s.root)
    assert.deepEqual(r.fehler, [])
    const m = r.lehrgaenge[0]!.musterpartien[0]!
    assert.deepEqual([m.titel, m.weiss, m.schwarz, m.jahr, m.event, m.quelle], ['Testpartie', 'A', 'B', 1900, 'Turnier', 'https://example.org/p'])
    assert.deepEqual(m.zuege.map((z) => z.uci), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'])
    assert.deepEqual(m.kommentare[0], { ply: 3, satz: 'Der Springer greift e5 an.', status: 'entwurf', pfeile: ['Gf3e5'], felder: ['Re5'], quelle: ['x https://lichess.org/abc'] })
    assert.equal(r.lehrgaenge[0]!.offen, 5 + 1)
  } finally { s.done() }
})

test('build: an illegal game move, a comment beyond the game and an arrow from an empty square are reported', () => {
  const bad = (m: Record<string, unknown>) => { const s = setup({ muster: [muster(m)] }); try { return buildLehrgaenge(s.root).fehler.join('\n') } finally { s.done() } }
  assert.match(bad({ pgn: '1. e4 e5 2. Qh5 Nc6 3. Qh5' }), /test\/musterpartien.*m1.*Zug 5.*Qh5/)
  assert.match(bad({ kommentare: [{ ply: 9, satz: 'x', status: 'entwurf' }] }), /m1.*Halbzug 9/)
  assert.match(bad({ kommentare: [{ ply: 3, satz: 'x', status: 'entwurf', pfeile: ['Gd4c6'] }] }), /m1.*Startfeld d4/)
})

test('build: a placeholder game (platzhalter) may carry TODO in title, players and source; a real one may not', () => {
  const ph = setup({ muster: [muster({ platzhalter: true, titel: TODO, weiss: TODO, schwarz: TODO, jahr: TODO, event: TODO, quelle: TODO })] })
  try { assert.deepEqual(buildLehrgaenge(ph.root).fehler, []) } finally { ph.done() }
  const real = setup({ muster: [muster({ quelle: '' })] })
  try { assert.match(buildLehrgaenge(real.root).fehler.join('\n'), /m1.*Quelle/) } finally { real.done() }
})

const fenOf = (sans: string[]) => { const c = new Chess(); sans.forEach((s) => c.move(s)); return c.fen() }
const analysis: AnalysisStore = Object.fromEntries([[[], 30], [['e4'], -25], [['e4', 'e5'], 35], [['e4', 'e5', 'Nf3'], -30]].map(([sans, cp]) => [evalKey(fenOf(sans as string[])), { bestUci: 'e2e4', depth: 18, lines: [{ uci: 'e2e4', cp: cp as number, mate: null, pv: [] }] }]))
const opening = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'docs/repertoire-v1.8.md' }

test('musterStellungen: one position per commented ply of each game, keyed like a sentence; musterSchluessel gives the same key', () => {
  const st = musterStellungen([{ id: 'm1', pgn: '1. e4 e5 2. Nf3 Nc6', kommentare: [{ ply: 3 }, { ply: 4 }] }], 'white')
  assert.deepEqual(st.map((s) => [s.san, s.ply, s.eigen, s.line]), [['Nf3', 2, true, ['e4', 'e5', 'Nf3']], ['Nc6', 3, false, ['e4', 'e5', 'Nf3', 'Nc6']]])
  assert.equal(st[0]!.schluessel, stellungsSchluessel(fenOf(['e4', 'e5']), 'Nf3'))
  assert.equal(musterSchluessel('1. e4 e5 2. Nf3', 3), st[0]!.schluessel)
})

test('check: goal and game comments are tested against the fact sheet of their position like sentences', () => {
  const [st] = musterStellungen([{ id: 'm1', pgn: '1. e4 e5 2. Nf3', kommentare: [{ ply: 3 }] }], 'white')
  const a = baueAufgabe(st!, { opening, analysis, explorer: {}, dokument: [], luecken: new Set() })
  const m = (satz: string) => [{ id: 'm1', pgn: '1. e4 e5 2. Nf3', kommentare: [{ ply: 3, satz, status: 'entwurf' as const }] }]
  assert.deepEqual(pruefeMuster(m('Der Springer greift den Bauern auf e5 an.'), [a], 'x'), [])
  assert.match(pruefeMuster(m('Du schlägst die Dame.'), [a], 'x').join('\n'), /x.*m1.*Halbzug 3.*Schlagzug/)
  assert.match(pruefeMuster(m('Idee: Zentrum.'), [a], 'x').join('\n'), /Beleg/)
  assert.deepEqual(pruefeMuster(m(TODO), [a], 'x'), [])
  assert.match(pruefeMuster(m('Egal.'), [], 'x').join('\n'), /nicht in aufgaben/)
  assert.deepEqual(pruefeZiel([{ satz: 'Der Springer greift den Bauern auf e5 an.', status: 'entwurf' }, { satz: TODO }], a, 'x/v1'), [])
  assert.match(pruefeZiel([{ satz: 'Du spielst 1. d4 und stehst klar besser.', status: 'entwurf' }], a, 'x/v1').join('\n'), /x\/v1 ziel 1.*d4/)
  assert.deepEqual(pruefeZiel([{ satz: 'Ziel ist es, die Dame zu schlagen.', status: 'entwurf', belege: [] }], a, 'x/v1').filter((p) => /Schlagzug/.test(p)), [])
  assert.match(pruefeZiel([{ satz: 'Egal.' }], undefined, 'x/v1').join('\n'), /Faktenblatt/)
})

import { eindeutigeStellungen } from '../tools/lib/lehrgang-stellungen.ts'

test('stellungen: a position is neu when any variety got its move from the depth extension; shared old positions stay plain', () => {
  const vs = [
    { id: 'a', anteil: 0.3, zuege: [{ san: 'e4' }, { san: 'e5' }, { san: 'Nf3', neu: true as const }] },
    { id: 'b', anteil: 0.2, zuege: [{ san: 'e4' }, { san: 'c5' }] },
  ]
  const r = Object.fromEntries(eindeutigeStellungen(vs, 'white').map((s) => [s.san, s.neu === true]))
  assert.deepEqual(r, { e4: false, e5: false, Nf3: true, c5: false })
})

test('baueAufgabe carries the neu flag into the fact sheet', () => {
  const [st] = musterStellungen([{ id: 'm1', pgn: '1. e4', kommentare: [{ ply: 1 }] }], 'white')
  const ctx = { opening, analysis, explorer: {}, dokument: [], luecken: new Set<string>() }
  assert.equal(baueAufgabe({ ...st!, neu: true }, ctx).neu, true)
  assert.equal(baueAufgabe(st!, ctx).neu, false)
})
