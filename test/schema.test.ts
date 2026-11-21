import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkBundle } from '../src/content/schema.ts'
import { lineBundle } from './helpers.ts'

test('checkBundle accepts a bundle of schema version 2', () => {
  const b = lineBundle(['e4'])
  assert.equal(checkBundle(b), b)
})

test('checkBundle rejects an old bundle with a rebuild hint', () => {
  assert.throws(() => checkBundle({ contentVersion: 'x', openings: [], nodes: {} }), /Inhalte neu bauen/)
  assert.throws(() => checkBundle(null), /Inhalte neu bauen/)
})
