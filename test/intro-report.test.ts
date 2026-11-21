import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { introReport } from '../tools/lib/intro-report.ts'
import { introFacts } from '../tools/lib/intro-facts.ts'
import type { FactsFile } from '../tools/lib/intro-facts.ts'
import type { Variation } from '../src/content/types.ts'

const OPENING = { id: 'scotch' as const, side: 'white' as const, entry: ['e4', 'e5'], docRef: 'doc' }
const v = (id: string, line: string[]): Variation => ({ id, name: id, nameEn: id, line, keyPositions: [], fromDocument: false })
const [A, B, C] = [v('a', ['e4', 'e5', 'Nf3']), v('b', ['e4', 'e5', 'Nc3']), v('c', ['e4', 'e5', 'Bc4'])]
const facts: FactsFile = { schema: 1, openingId: 'scotch', dokument: [], varianten: Object.fromEntries([A, B, C].map((x) => [x.id, introFacts(OPENING, x, { analysis: {}, explorer: {} })])) }
const spoken = new Map([['c', 'Weiß spielt Bauer e4. Schwarz antwortet mit Bauer e5.']])

test('todo lists the variations without a spoken text, check lists OK or the reason per authored text', () => {
  const r = introReport(OPENING, [A, B, C], { spoken, facts, authored: { a: { text: 'Nach 1. e4 e5 spielst du 2. Sf3.', belege: [] }, b: { text: 'Nach 1. e4 e5 spielst du 2. Lc4.', belege: [] }, zzz: { text: 'x', belege: [] } } })
  assert.deepEqual(r.todo, ['a', 'b'])
  assert.deepEqual(r.checks.map((c) => [c.id, c.ok]), [['a', true], ['b', false], ['zzz', false]])
  assert.match(r.checks[1]!.why, /Zugfolge/)
  assert.match(r.checks[2]!.why, /keine Variante/)
})

test('todo marks variations that already have an accepted authored text as done', () => {
  const r = introReport(OPENING, [A, B], { spoken: new Map(), facts, authored: { a: { text: 'Nach 1. e4 e5 spielst du 2. Sf3.', belege: [] } } })
  assert.deepEqual(r.todo, ['a', 'b'], 'todo = needs a text (no spoken text), independent of what is already written')
  assert.deepEqual(r.done, ['a'])
})

const bundlePath = fileURLToPath(new URL('../public/content/bundle.json', import.meta.url))
const sha = () => createHash('sha256').update(readFileSync(bundlePath)).digest('hex')

test('add-intros --todo and --check print and write nothing', () => {
  const before = sha()
  const todo = execFileSync('node', ['tools/add-intros.ts', '--todo', 'vienna'], { encoding: 'utf8' })
  assert.match(todo, /vienna-game-giraffe-attack/)
  assert.doesNotMatch(todo, /vienna-game-anderssen-defense/, 'has a spoken text')
  const check = execFileSync('node', ['tools/add-intros.ts', '--check', 'vienna'], { encoding: 'utf8' })
  assert.match(check, /^vienna: (keine geschriebenen Texte|\d+ Texte, \d+ OK)/, 'whatever has been written so far')
  assert.equal(sha(), before)
})
