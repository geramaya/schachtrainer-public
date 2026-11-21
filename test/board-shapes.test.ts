import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boardShapes } from '../src/coach/boardShapes.ts'
import type { CoachShape } from '../src/coach/explain.ts'

const s = (id: string, orig: string, dest: string | undefined, kind: CoachShape['kind'], label: string, dim?: boolean): CoachShape => ({ id, orig, dest, kind, label, dim })

test('arrows with the same start and target square collapse into one with a joined label', () => {
  const out = boardShapes([s('a', 'f3', 'e5', 'own', '1'), s('b', 'f3', 'e5', 'own', '2'), s('c', 'f6', 'e4', 'opp', 'A')])
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { orig: 'f3', dest: 'e5', brush: 'own', label: { text: '1·2' } })
  assert.deepEqual(out[1], { orig: 'f6', dest: 'e4', brush: 'opp', label: { text: 'A' } })
})

test('different arrows to one target share a single label, circles get a diamond mark', () => {
  const out = boardShapes([s('a', 'c3', 'e4', 'own', '1'), s('b', 'f6', 'e4', 'opp', 'A'), s('c', 'f7', undefined, 'weak', '3')])
  assert.equal(out[0]!.label?.text, '1·A')
  assert.equal(out[1]!.label, undefined)
  assert.equal(out[2]!.label?.text, '◆3')
})

test('a dimmed shape uses the dim brush', () => {
  assert.equal(boardShapes([s('a', 'a1', 'a2', 'own', '1', true)])[0]!.brush, 'ownDim')
})
