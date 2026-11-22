import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildLehrgaenge, mergeVarianten, TODO } from '../tools/lib/lehrgang-build.ts'
import type { VarianteSrc } from '../tools/lib/lehrgang-build.ts'
import { ecoEntriesFromTsv, parseEcoTable } from '../src/openings/eco.ts'

const PLAN = ['Idee', 'Deine Züge', 'Pläne', 'Fallen', 'Wenn Unbekanntes kommt'].map((h) => `## ${h}\n\n${TODO}\n`).join('\n')
const zuege = (...sans: string[]) => sans.map((san) => ({ san, satz: TODO }))
const meta = { id: 'test', name: 'Testgang', side: 'white', entry: ['e4', 'e5'], band: '1200–1600' }

function setup(over: { varianten?: unknown; fallen?: unknown; plan?: string; daten?: unknown; stellungen?: unknown } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'lg-'))
  const dir = join(root, 'test')
  mkdirSync(dir)
  writeFileSync(join(dir, 'lehrgang.json'), JSON.stringify(meta))
  writeFileSync(join(dir, 'spielplan.md'), over.plan ?? PLAN)
  writeFileSync(join(dir, 'varianten.json'), JSON.stringify(over.varianten ?? [{ id: 'v1', name: TODO, stufe: 'kern', anteil: 0.42, zuege: zuege('e4', 'e5', 'Nf3', 'Nc6') }]))
  writeFileSync(join(dir, 'fallen.json'), JSON.stringify(over.fallen ?? [{ id: 'f1', titel: TODO, fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', loesung: 'Nf3', satz: TODO, platzhalter: true }]))
  if (over.daten) writeFileSync(join(dir, 'daten.json'), JSON.stringify(over.daten))
  if (over.stellungen) writeFileSync(join(dir, 'stellungen.json'), JSON.stringify(over.stellungen))
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}

test('build: a valid Lehrgang becomes one entry with uci moves, frequency text, spielplan sections and a TODO count', () => {
  const s = setup()
  try {
    const r = buildLehrgaenge(s.root)
    assert.deepEqual(r.fehler, [])
    const l = r.lehrgaenge[0]!
    assert.deepEqual(l.spielplan.map((x) => x.titel), ['Idee', 'Deine Züge', 'Pläne', 'Fallen', 'Wenn Unbekanntes kommt'])
    assert.deepEqual(l.varianten[0]!.zuege.map((z) => z.uci), ['e2e4', 'e7e5', 'g1f3', 'b8c6'])
    assert.equal(l.varianten[0]!.haeufigkeit, 'etwa 4 von 10')
    assert.equal(l.offen, 5 + 1 + 4 + 1 + 1) // plan sections, variant name, 4 move sentences, trap title and sentence
  } finally { s.done() }
})

test('build: an illegal move, a line that misses the entry, a bad trap solution and a missing section are all reported with where', () => {
  const s = setup({
    varianten: [{ id: 'bad', name: 'x', stufe: 'kern', anteil: null, zuege: zuege('e4', 'e5', 'Qh5', 'Qh5') }, { id: 'off', name: 'x', stufe: 'kern', anteil: null, zuege: zuege('d4', 'd5') }],
    fallen: [{ id: 'f', titel: 'x', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', loesung: 'Ke4', satz: 'x' }],
    plan: '## Idee\n\ntext\n',
  })
  try {
    const f = buildLehrgaenge(s.root).fehler.join('\n')
    assert.match(f, /test\/bad.*Zug 4.*Qh5/)
    assert.match(f, /test\/off.*Einstieg/)
    assert.match(f, /test\/f.*Ke4/)
    assert.match(f, /spielplan.*Deine Züge/)
  } finally { s.done() }
})

test('build: the frequency comes from the data run (abruf date), and a variant without data stays "folgt"', () => {
  const s = setup({ daten: { abruf: '2026-11-23' }, varianten: [{ id: 'v1', name: 'x', stufe: 'kern', anteil: null, zuege: zuege('e4', 'e5') }] })
  try {
    const l = buildLehrgaenge(s.root).lehrgaenge[0]!
    assert.equal(l.abruf, '2026-11-23')
    assert.equal(l.varianten[0]!.haeufigkeit, null)
  } finally { s.done() }
})

test('merge: data run updates tier and share, keeps written sentences, adds new varieties with TODO, drops stale placeholders and flags stale written ones', () => {
  const old: VarianteSrc[] = [
    { id: 'keep', name: 'Mein Name', stufe: 'kern' as const, anteil: 0.1, zuege: [{ san: 'e4', satz: 'Mein Satz' }] },
    { id: 'seed', name: TODO, stufe: 'kern' as const, anteil: null, vorlaeufig: true as const, zuege: zuege('e4') },
    { id: 'gone', name: 'Alt', stufe: 'kern' as const, anteil: 0.3, zuege: [{ san: 'd4', satz: 'Text' }] },
  ]
  const data = [
    { id: 'keep', line: ['e4'], anteil: 0.6, stufe: 'kern' as const },
    { id: 'new', line: ['e4', 'e5'], anteil: 0.1, stufe: 'erweiterung' as const },
  ]
  const m = mergeVarianten(old, data)
  const by = Object.fromEntries(m.map((v) => [v.id, v]))
  assert.equal(by.keep!.zuege[0]!.satz, 'Mein Satz')
  assert.equal(by.keep!.anteil, 0.6)
  assert.deepEqual(by.new!.zuege, zuege('e4', 'e5'))
  assert.equal(by.new!.stufe, 'erweiterung')
  assert.equal(by.seed, undefined)
  assert.equal(by.gone!.veraltet, true)
})

test('the committed Lehrgang content builds without errors (all lines legal)', async () => {
  const r = buildLehrgaenge(new URL('../content-src/lehrgaenge/', import.meta.url).pathname)
  // Open findings in the texts (stellungen.json/fallen.json, not mine to edit): the texter fixes them, then this list shrinks. A listed one that is gone fails the test.
  const OPEN_TEXTER: RegExp[] = []
  assert.deepEqual(r.fehler.filter((f) => !OPEN_TEXTER.some((re) => re.test(f))), [])
  for (const re of OPEN_TEXTER) assert.ok(r.fehler.some((f) => re.test(f)), `${re} is fixed: remove it from OPEN_TEXTER`)
  assert.deepEqual(r.lehrgaenge.map((l) => l.id).sort(), ['caro-kann', 'italian', 'scotch'])
})

import { eindeutigeStellungen, stellungsSchluessel } from '../tools/lib/lehrgang-stellungen.ts'
import { positionKey } from '../src/chess/position.ts'
import { Chess } from 'chess.js'

test('stellungen: one sentence per position+move fills every variety that contains it (own and opponent moves), the written sentence replaces the placeholder', () => {
  const s = setup({
    varianten: [
      { id: 'a', name: 'x', stufe: 'kern', anteil: 0.3, zuege: zuege('e4', 'e5', 'Nf3', 'Nc6') },
      { id: 'b', name: 'x', stufe: 'kern', anteil: 0.2, zuege: zuege('e4', 'e5', 'Nf3', 'Nf6') },
    ],
  })
  try {
    const start = new Chess().fen()
    const afterE4E5Nf3 = (() => { const c = new Chess(); ['e4', 'e5', 'Nf3'].forEach((m) => c.move(m)); return c.fen() })()
    writeFileSync(join(s.root, 'test', 'stellungen.json'), JSON.stringify({
      [stellungsSchluessel(start, 'e4')]: { satz: 'Du besetzt das Zentrum.', status: 'entwurf' },
      [stellungsSchluessel(afterE4E5Nf3, 'Nc6')]: { satz: 'Schwarz deckt e5.', status: 'geprueft' },
    }))
    const l = buildLehrgaenge(s.root).lehrgaenge[0]!
    const [a, b] = [l.varianten.find((v) => v.id === 'a')!, l.varianten.find((v) => v.id === 'b')!]
    assert.equal(a.zuege[0]!.satz, 'Du besetzt das Zentrum.')
    assert.equal(b.zuege[0]!.satz, 'Du besetzt das Zentrum.')
    assert.equal(a.zuege[3]!.satz, 'Schwarz deckt e5.')
    assert.equal(a.zuege[3]!.status, 'geprueft')
    assert.equal(b.zuege[3]!.satz, TODO)
    assert.equal(l.offen, 12) // plan 5, a: e5 Nf3, b: e5 Nf3 Nf6, trap title and sentence
  } finally { s.done() }
})

test('eindeutigeStellungen lists each position+move once with its line, mover, own/opponent, the varieties it appears in and their summed share', () => {
  const vs = [
    { id: 'a', anteil: 0.3, zuege: ['e4', 'e5', 'Nf3'].map((san) => ({ san })) },
    { id: 'b', anteil: 0.2, zuege: ['e4', 'c5'].map((san) => ({ san })) },
  ]
  const r = eindeutigeStellungen(vs, 'white')
  assert.equal(r.length, 4) // e4 (shared), e5, Nf3, c5
  const e4 = r.find((x) => x.san === 'e4')!
  assert.deepEqual([e4.varianten, e4.eigen, e4.zieher, e4.ply, e4.line], [['a', 'b'], true, 'white', 0, ['e4']])
  assert.ok(Math.abs(e4.anteil - 0.5) < 1e-9)
  assert.equal(e4.schluessel, `${positionKey(new Chess().fen())}|e4`)
  const nf3 = r.find((x) => x.san === 'Nf3')!
  assert.deepEqual([nf3.eigen, nf3.line], [true, ['e4', 'e5', 'Nf3']])
  assert.equal(r.find((x) => x.san === 'c5')!.eigen, false)
})

import { lueckenSchluessel } from '../tools/lib/lehrgang-stellungen.ts'

test('lueckenSchluessel: the key of the last move of every line that ends without an own answer (grund luecke), and only those', () => {
  const k = lueckenSchluessel([
    { line: ['e4', 'e5', 'Nf3'], grund: 'luecke' },
    { line: ['e4', 'c5'], grund: 'tiefe' },
  ])
  const c = new Chess(); c.move('e4'); c.move('e5')
  assert.deepEqual([...k], [stellungsSchluessel(c.fen(), 'Nf3')])
})

const K0 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -|e4'
const K1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -|e5'

test('build: pfeile, felder and quelle of a position reach the move as normalized lists (string or list accepted)', () => {
  const s = setup({ stellungen: { [K0]: { satz: 'Zentrum.', status: 'entwurf', pfeile: ['Ge4d5'], felder: 'Rd5, Rf5', quelle: 'https://a.org/x ; https://b.org/y' }, [K1]: { satz: 'Antwort.', status: 'entwurf', felder: ['Ye5'] } } })
  try {
    const r = buildLehrgaenge(s.root)
    assert.deepEqual(r.fehler, [])
    const [z0, z1, z2] = r.lehrgaenge[0]!.varianten[0]!.zuege
    assert.deepEqual([z0!.pfeile, z0!.felder, z0!.quelle], [['Ge4d5'], ['Rd5', 'Rf5'], ['https://a.org/x', 'https://b.org/y']])
    assert.deepEqual([z1!.pfeile, z1!.felder, z1!.quelle], [undefined, ['Ye5'], undefined])
    assert.equal(z2!.pfeile, undefined)
  } finally { s.done() }
})

test('build: a malformed mark, an arrow from an empty square (after the move) and a bad circle are reported with the place', () => {
  const s = setup({ stellungen: { [K0]: { satz: 'x', status: 'entwurf', pfeile: ['Xe4d5', 'Ge2e4'], felder: 'Rz9' }, [K1]: { satz: 'y', status: 'entwurf', pfeile: ['Ge4d5'] } } })
  try {
    const f = buildLehrgaenge(s.root).fehler.join('\n')
    assert.match(f, /test\/stellungen\.json.*\|e4.*Xe4d5/)
    assert.match(f, /\|e4.*Ge2e4.*leer/)
    assert.match(f, /\|e4.*Rz9/)
    assert.doesNotMatch(f, /\|e5/) // e4 is occupied after 1.e4
  } finally { s.done() }
})

test('build: a trap carries its marks, checked on the board before or after the solution (an arrow may be the solution move)', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
  const ok = setup({ fallen: [{ id: 'f1', titel: 'x', fen, loesung: 'Nf3', satz: 'x', pfeile: ['Gf3e5', 'Gg1f3'], felder: 'Re5', quelle: 'https://a.org/x' }] })
  const bad = setup({ fallen: [{ id: 'f1', titel: 'x', fen, loesung: 'Nf3', satz: 'x', pfeile: ['Ga3b3'] }] })
  try {
    const r = buildLehrgaenge(ok.root)
    assert.deepEqual(r.fehler, [])
    const f = r.lehrgaenge[0]!.fallen[0]!
    assert.deepEqual([f.pfeile, f.felder, f.quelle], [['Gf3e5', 'Gg1f3'], ['Re5'], ['https://a.org/x']])
    assert.match(buildLehrgaenge(bad.root).fehler.join('\n'), /test\/f1.*Ga3b3.*leer/)
  } finally { ok.done(); bad.done() }
})

test('build: names derived from the opening table replace TODO names and are not counted as open texts', () => {
  const s = setup()
  try {
    const eco = parseEcoTable({ entries: ecoEntriesFromTsv("eco\tname\tpgn\nC44\tKing's Knight Opening\t1. e4 e5 2. Nf3\n") })!
    const r = buildLehrgaenge(s.root, { eco, namesDe: { "King's Knight Opening": 'Königsspringer' } })
    assert.equal(r.lehrgaenge[0]!.varianten[0]!.name, 'Königsspringer: 2…Sc6')
    assert.equal(r.lehrgaenge[0]!.offen, 5 + 4 + 1 + 1) // variant name no longer open
  } finally { s.done() }
})
