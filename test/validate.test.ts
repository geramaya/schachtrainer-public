import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { contentVersion, validateBundle } from '../tools/lib/validate.ts'
import type { ContentBundle, Explanation } from '../src/content/types.ts'

const base: ContentBundle = JSON.parse(readFileSync(new URL('./fixtures/mini-bundle.json', import.meta.url), 'utf8'))
const first = Object.keys(base.trees.scotch)[0]!
const [, second, third] = Object.keys(base.trees.scotch) as [string, string, string]
const legal = (k: string): string => {
  const m = new Chess(base.trees.scotch[k]!.fen).moves({ verbose: true })[0]!
  return m.from + m.to
}
const lesson = (over: Partial<Explanation> = {}): Explanation => ({
  id: 'scotch/v1/1', key: first, title: 't', text: 'Plan ohne Zugbehauptung', arrows: [], claims: [],
  status: 'entwurf', source: { kind: 'autor', ref: 'test' }, ...over,
})
const make = (patch: (b: ContentBundle) => void): ContentBundle => {
  const b: ContentBundle = structuredClone(base)
  b.openings = [{
    id: 'scotch', name: 'Schottisch', side: 'white', entry: [], role: 'Main', docRef: 'x',
    variations: [{ id: 'v1', name: 'V', nameEn: 'V', line: ['e4'], keyPositions: [first], fromDocument: false }],
  }]
  b.explanations = [lesson()]
  patch(b)
  return b
}

test('a consistent bundle is valid', () => {
  assert.deepEqual(validateBundle(make(() => {})), [])
})

test('reports an illegal move', () => {
  const errs = validateBundle(make((b) => { b.trees.scotch[first]!.candidates[0]!.uci = 'e2e5' }))
  assert.equal(errs.length, 1)
  assert.match(errs[0]!, /illegal/)
})

test('reports a missing key in explanations, questions and variations', () => {
  const errs = validateBundle(make((b) => {
    b.explanations.push(lesson({ id: 'scotch/v1/2', key: 'nope' }))
    b.questions = [{ id: 'q1', key: 'nope2', variationId: 'v1', prompt: 'p', kind: 'move', answerUci: 'e2e4', explanationId: 'scotch/v1/1' }]
    b.openings[0]!.variations[0]!.keyPositions.push('nope3')
  }))
  assert.equal(errs.filter((e) => /missing key/.test(e)).length, 3)
})

test('reports a claim in an unchecked explanation, and a claim without evidence', () => {
  const errs = validateBundle(make((b) => {
    b.explanations.push(lesson({ id: 'scotch/v1/2', key: second, claims: [{ kind: 'best', uci: legal(second) }] }))
    b.explanations.push(lesson({ id: 'l3', key: third, status: 'engine-geprüft', claims: [{ kind: 'best', uci: legal(third) }] }))
  }))
  assert.equal(errs.length, 2)
  assert.match(errs[0]!, /v1\/2.*ungeprüft/)
  assert.match(errs[1]!, /l3.*verified/)
})

test('reports a variation without lesson unless requireLessons is off', () => {
  const b = make((x) => { x.explanations = [] })
  assert.equal(validateBundle(b).length, 1)
  assert.match(validateBundle(b)[0]!, /Lektion/)
  assert.deepEqual(validateBundle(b, { requireLessons: false }), [])
})

test('reports a question pointing to a missing explanation and an illegal puzzle move', () => {
  const errs = validateBundle(make((b) => {
    b.questions = [{ id: 'q1', key: first, variationId: 'v1', prompt: 'p', kind: 'move', answerUci: 'e2e4', explanationId: 'zz' }]
    b.puzzles = { v1: [{ id: 'p1', fen: base.trees.scotch[first]!.fen, moves: ['e2e5'], rating: 1500, themes: [], openingTags: [], url: 'u' }] }
  }))
  assert.equal(errs.length, 2)
})

test('contentVersion is the date plus a short hash of the content, stable for equal content', () => {
  const day = new Date('2026-11-20T12:00:00Z')
  const v = contentVersion(base, day)
  assert.match(v, /^20261120-[0-9a-f]{8}$/)
  assert.equal(contentVersion(structuredClone(base), day), v)
  const changed = structuredClone(base)
  changed.trees.scotch![first]!.active = 1
  assert.notEqual(contentVersion(changed, day), v)
  // the version field itself does not feed the hash
  assert.equal(contentVersion({ ...base, contentVersion: 'other' }, day), v)
})

test('reports an own-move node without candidate, except when the position is mated', () => {
  const errs = validateBundle(make((b) => { b.trees.scotch[first]!.candidates = [] }))
  assert.equal(errs.length, 1)
  assert.match(errs[0]!, /without candidate/)
  const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
  const ok = validateBundle(make((b) => {
    b.trees.scotch['m'] = { key: 'm', fen, ownMove: true, candidates: [], active: 0, replies: [] }
  }))
  assert.ok(!ok.some((e) => /node m: own move without candidate/.test(e)), ok.join('|'))
})

test('human-ok explanations may carry claims without verified evidence', () => {
  const errs = validateBundle(make((b) => {
    b.explanations.push(lesson({ id: 'h1', key: second, status: 'human-ok', claims: [{ kind: 'best', uci: legal(second) }] }))
  }))
  assert.deepEqual(errs, [])
})

test('reports two explanations on the same position', () => {
  const errs = validateBundle(make((b) => { b.explanations.push(lesson({ id: 'scotch/v1/dup' })) }))
  assert.equal(errs.length, 1)
  assert.match(errs[0]!, /dup.*scotch\/v1\/1/)
})

test('reports a node whose ownMove does not match the side of its opening', () => {
  const errs = validateBundle(make((b) => {
    b.openings.push({ ...b.openings[0]!, id: 'caro-kann', side: 'black', variations: [] })
    b.trees['caro-kann'] = { [first]: structuredClone(b.trees.scotch![first]!) }
  }))
  assert.equal(errs.length, 1)
  assert.match(errs[0]!, /caro-kann.*ownMove/)
})

test('reports a tree without an opening and an opening without a tree', () => {
  const errs = validateBundle(make((b) => { b.trees.ghost = {}; delete b.trees.scotch }))
  assert.ok(errs.some((e) => /ghost/.test(e)), errs.join('|'))
  assert.ok(errs.some((e) => /scotch.*no tree/.test(e)), errs.join('|'))
})

test('an explanation key may live in any tree', () => {
  const errs = validateBundle(make((b) => {
    const n = structuredClone(b.trees.scotch![second]!)
    b.openings.push({ ...b.openings[0]!, id: 'caro-kann', side: 'black', variations: [] })
    b.trees['caro-kann'] = { [second]: { ...n, ownMove: true, candidates: n.replies, replies: [] } }
    delete b.trees.scotch![second]
    b.explanations.push(lesson({ id: 'scotch/v1/2', key: second }))
  }))
  assert.deepEqual(errs, [])
})

test('the same position may carry one explanation per opening, but not two in one opening', () => {
  const two = (secondId: string) =>
    validateBundle(make((b) => {
      const n = structuredClone(b.trees.scotch![first]!)
      b.openings.push({ ...b.openings[0]!, id: 'caro-kann', side: 'black', variations: [] })
      b.trees['caro-kann'] = { [first]: { ...n, ownMove: false, candidates: [], replies: n.candidates } }
      b.explanations = [lesson({ id: 'scotch/v1/1' }), lesson({ id: secondId })]
    }))
  assert.deepEqual(two('caro-kann/x/1'), [])
  const dup = two('scotch/v1/2')
  assert.equal(dup.length, 1)
  assert.match(dup[0]!, /scotch\/v1\/2.*scotch\/v1\/1/)
})

test('a variation needs a lesson of its own opening, not one of another opening on the same key', () => {
  const errs = validateBundle(make((b) => {
    b.explanations = [lesson({ id: 'caro-kann/x/1' })]
  }))
  assert.ok(errs.some((e) => /v1.*keine Lektion/.test(e)), errs.join('|'))
})

test('reports a partOf that points to no variation of the same opening', () => {
  const ok = validateBundle(make((b) => {
    b.openings[0]!.variations.push({ id: 'v2', name: 'V2', nameEn: 'V2', line: ['e4'], keyPositions: [first], fromDocument: false, partOf: 'v1' })
  }))
  assert.deepEqual(ok, [])
  const bad = validateBundle(make((b) => {
    b.openings[0]!.variations[0]!.partOf = 'ghost'
  }))
  assert.ok(bad.some((e) => /v1.*partOf.*ghost/.test(e)), bad.join('|'))
})

test('an intro that names a move not on the line fails the bundle', () => {
  const ok = make((b) => { b.openings[0]!.variations[0]!.intro = { text: 'Weiß beginnt mit 1. e4.', source: { kind: 'autor', ref: 't' }, draft: true } })
  assert.deepEqual(validateBundle(ok).filter((e) => e.includes('intro')), [])
  const bad = make((b) => { b.openings[0]!.variations[0]!.intro = { text: 'Weiß beginnt mit 1. d4.', source: { kind: 'autor', ref: 't' }, draft: true } })
  const errs = validateBundle(bad).filter((e) => e.includes('intro'))
  assert.equal(errs.length, 1)
  assert.match(errs[0]!, /variation v1 intro/)
})
