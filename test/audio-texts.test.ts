import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { audioTexts } from '../content-src/audio/index.ts'

const bundle = JSON.parse(readFileSync(new URL('../public/content/bundle.json', import.meta.url), 'utf8'))
const words = (t: string) => t.trim().split(/\s+/).length
const OPENINGS = ['scotch', 'smith-morra', 'caro-kann', 'budapest', 'kings-indian']

test('ids are unique and kinds are valid', () => {
  const ids = audioTexts.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const t of audioTexts) assert.ok(t.kind === 'eroeffnung' || t.kind === 'variante', t.id)
})

test('every main-stack opening has a 150-250 word background text with a source', () => {
  for (const id of OPENINGS) {
    const t = audioTexts.find((x) => x.kind === 'eroeffnung' && x.refId === id)
    assert.ok(t, `missing opening text ${id}`)
    const n = words(t.text)
    assert.ok(n >= 150 && n <= 250, `${id}: ${n} words`)
    assert.ok(t.sources.length > 0, `${id}: no source`)
  }
})

test('every bundle variation of the scotch opening has a 50-90 word text', () => {
  const vars: { id: string }[] = bundle.openings.find((o: { id: string }) => o.id === 'scotch').variations
  assert.ok(vars.length > 0)
  for (const v of vars) {
    const t = audioTexts.find((x) => x.kind === 'variante' && x.refId === v.id)
    assert.ok(t, `missing variation text ${v.id}`)
    const n = words(t.text)
    assert.ok(n >= 50 && n <= 90, `${v.id}: ${n} words`)
  }
})

test('texts are speakable: no chess notation symbols, no move numbers', () => {
  for (const t of audioTexts) {
    assert.ok(!/[+#!?†]|\bx[a-h]\d|\b[NBRQK][a-h][1-8]\b|(^|\s)\d+\.\s/.test(t.text), `${t.id}: notation in text`)
  }
})

test('every source has kind and an http(s) ref or a document ref', () => {
  for (const t of audioTexts) for (const s of t.sources) {
    assert.ok(s.kind && s.ref, t.id)
    if (s.kind === 'wikipedia') assert.match(s.ref, /^https:\/\/(en|de)\.wikipedia\.org\//)
  }
})
