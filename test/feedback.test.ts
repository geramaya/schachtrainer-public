import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rate, parseFeedback } from '../src/train/feedback.ts'

test('rate overwrites an earlier verdict and keeps the given content version', () => {
  let fb = rate({}, 'e1', 'passt', undefined, 'v1')
  fb = rate(fb, 'e1', 'stimmt-nicht', 'falsche Linie', 'v2')
  assert.deepEqual(fb, { e1: { verdict: 'stimmt-nicht', note: 'falsche Linie', contentVersion: 'v2' } })
})

test('rate allows stimmt-nicht without a note and does not mutate the input', () => {
  const before = {}
  const fb = rate(before, 'e1', 'stimmt-nicht', undefined, 'v1')
  assert.equal(fb.e1!.note, undefined)
  assert.deepEqual(before, {})
})

test('rate truncates the note to 500 characters', () => {
  const fb = rate({}, 'e1', 'passt', 'x'.repeat(900), 'v1')
  assert.equal(fb.e1!.note!.length, 500)
})

test('parseFeedback gives an empty state for null, garbage and wrong shapes', () => {
  assert.deepEqual(parseFeedback(null), {})
  assert.deepEqual(parseFeedback('{kaputt'), {})
  assert.deepEqual(parseFeedback('[1,2]'), {})
  assert.deepEqual(parseFeedback('{"e1":{"verdict":"egal","contentVersion":"v"}}'), {})
})

test('parseFeedback keeps valid entries', () => {
  const raw = JSON.stringify({ e1: { verdict: 'passt', contentVersion: 'v1' } })
  assert.deepEqual(parseFeedback(raw), { e1: { verdict: 'passt', contentVersion: 'v1' } })
})
