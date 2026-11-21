import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { withIntros } from '../tools/lib/intros.ts'
import { loadAuthoredIntros, loadFacts } from '../tools/lib/intro-source.ts'
import { introFacts } from '../tools/lib/intro-facts.ts'
import type { FactsFile } from '../tools/lib/intro-facts.ts'
import type { Variation } from '../src/content/types.ts'
import { contentVersion } from '../tools/lib/validate.ts'

const OPENING = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'doc' }
const v = (id: string, line: string[]): Variation => ({ id, name: id, nameEn: id, line, keyPositions: [], fromDocument: false })
const A = v('a', ['e4', 'e5', 'Nf3', 'Nc6'])
const B = v('b', ['e4', 'e5', 'Nc3'])
const facts = (): FactsFile => {
  const g = new Chess(); g.move('e4'); g.move('e5'); g.move('Nf3'); g.move('Nc6')
  return { schema: 1, openingId: 'scotch', dokument: [{ z: 7, text: '- Die Logik: Zentrum.' }], varianten: { a: introFacts(OPENING, A, { analysis: {}, explorer: {} }), b: introFacts(OPENING, B, { analysis: {}, explorer: {} }) } }
}
const GOOD = { text: 'Nach 1. e4 e5 wählst du 2. Sf3 und Schwarz antwortet mit 2… Sc6. Der Plan ist das Zentrum.', belege: ['doc:Z7'] }

test('an authored intro that the checker accepts replaces the generated draft and is no draft', () => {
  const rejected: string[] = []
  const [a, b] = withIntros(OPENING, [A, B], { spoken: new Map(), authored: { a: GOOD }, facts: facts(), rejected })
  assert.equal(a!.intro!.text, GOOD.text)
  assert.equal(a!.intro!.draft, false)
  assert.equal(a!.intro!.source.kind, 'autor')
  assert.match(a!.intro!.source.ref, /content-src\/intros\/scotch\.ts.*doc:Z7/)
  assert.equal(b!.intro!.draft, true, 'no authored text: the generated draft stays')
  assert.deepEqual(rejected, [])
})

test('an authored intro the checker rejects leaves the draft in place and is reported with its problems', () => {
  const rejected: string[] = []
  const [a] = withIntros(OPENING, [A], { spoken: new Map(), authored: { a: { text: 'Nach 1. e4 e5 spielt Weiß 2. Lc4.', belege: [] } }, facts: facts(), rejected })
  assert.equal(a!.intro!.draft, true)
  assert.equal(rejected.length, 1)
  assert.match(rejected[0]!, /^a: .*Zugfolge/)
})

test('without a fact sheet no authored text is accepted', () => {
  const rejected: string[] = []
  const [a] = withIntros(OPENING, [A], { spoken: new Map(), authored: { a: GOOD }, facts: null, rejected })
  assert.equal(a!.intro!.draft, true)
  assert.match(rejected[0]!, /^a: kein Faktenblatt/)
})

test('a spoken text (document) keeps its place: authored text for that variation is ignored and reported', () => {
  const rejected: string[] = []
  const spoken = new Map([['a', 'Weiß spielt Bauer e4. Schwarz antwortet mit Bauer e5.']])
  const [a] = withIntros(OPENING, [A], { spoken, authored: { a: GOOD }, facts: facts(), rejected })
  assert.equal(a!.intro!.text, 'Weiß spielt Bauer e4. Schwarz antwortet mit Bauer e5.')
  assert.match(rejected[0]!, /^a: Sprechtext/)
})

test('an authored id that is no variation of the opening is reported', () => {
  const rejected: string[] = []
  withIntros(OPENING, [A], { spoken: new Map(), authored: { zzz: GOOD }, facts: facts(), rejected })
  assert.match(rejected[0]!, /^zzz: keine Variante/)
})

test('two runs give the same result, hence the same content version', () => {
  const run = () => JSON.stringify(withIntros(OPENING, [A, B], { spoken: new Map(), authored: { a: GOOD }, facts: facts() }))
  assert.equal(run(), run())
  const bundle = (vs: unknown) => ({ schemaVersion: 3, contentVersion: '', openings: vs, trees: {}, explanations: [], questions: [], deviations: [], puzzles: {} }) as never
  const day = new Date('2026-11-21')
  assert.equal(contentVersion(bundle(JSON.parse(run())), day), contentVersion(bundle(JSON.parse(run())), day))
})

test('loaders read content-src/intros/<id>.ts and intro-facts/<id>.json from a directory, and return nothing for a missing opening', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'intros-'))
  mkdirSync(join(dir, 'intros')); mkdirSync(join(dir, 'intro-facts'))
  writeFileSync(join(dir, 'intros', 'scotch.ts'), `export const INTROS = { a: { text: 'Hallo', belege: [] } }\n`)
  writeFileSync(join(dir, 'intro-facts', 'scotch.json'), JSON.stringify(facts()))
  assert.deepEqual(await loadAuthoredIntros('scotch', dir), { a: { text: 'Hallo', belege: [] } })
  assert.deepEqual(await loadAuthoredIntros('vienna', dir), {})
  assert.equal(loadFacts('scotch', dir)!.openingId, 'scotch')
  assert.equal(loadFacts('vienna', dir), null)
})
