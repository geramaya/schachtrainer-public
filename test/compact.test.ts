import { test } from 'node:test'
import assert from 'node:assert/strict'
import { briefSigns, parseOpen, resultText } from '../src/ui/compact.ts'

const counts = { brilliant: 0, great: 1, best: 9, excellent: 4, good: 3, book: 2, inaccuracy: 2, mistake: 1, miss: 0, blunder: 1 }

test('briefSigns: only notable categories that occur, worst last-to-first order of the legend', () => {
  assert.deepEqual(briefSigns(counts), [{ cat: 'great', n: 1 }, { cat: 'blunder', n: 1 }, { cat: 'mistake', n: 1 }, { cat: 'inaccuracy', n: 2 }])
  assert.deepEqual(briefSigns({ ...counts, great: 0, blunder: 0, mistake: 0, inaccuracy: 0 }), [])
})

test('parseOpen: stored open states keep only booleans', () => {
  assert.deepEqual(parseOpen({ details: true, analyse: false, x: 'yes' }), { details: true, analyse: false })
  assert.deepEqual(parseOpen(null), {})
  assert.deepEqual(parseOpen([1]), {})
})

test('resultText: the result is shown once; with a viewpoint word the score stays in brackets', () => {
  assert.equal(resultText('0-1', '0-1'), '0-1')
  assert.equal(resultText('1-0', 'Sieg'), 'Sieg (1-0)')
  assert.equal(resultText('1/2-1/2', 'Remis'), 'Remis (1/2-1/2)')
})
