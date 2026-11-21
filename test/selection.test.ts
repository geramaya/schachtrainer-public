import { test } from 'node:test'
import assert from 'node:assert/strict'
import { headState, keepVisible, rangeSelect, setAll, toggle } from '../src/games/selection.ts'

const ids = ['a', 'b', 'c', 'd', 'e']

test('toggle adds and removes one id without touching the others', () => {
  assert.deepEqual([...toggle(new Set(['a']), 'b')].sort(), ['a', 'b'])
  assert.deepEqual([...toggle(new Set(['a', 'b']), 'a')], ['b'])
})

test('range selects every row between anchor and target in list order, in both directions, and keeps the rest', () => {
  assert.deepEqual([...rangeSelect(new Set(['e']), ids, 'b', 'd')].sort(), ['b', 'c', 'd', 'e'])
  assert.deepEqual([...rangeSelect(new Set(), ids, 'd', 'b')].sort(), ['b', 'c', 'd'])
})

test('range without a valid anchor selects just the target', () => {
  assert.deepEqual([...rangeSelect(new Set(), ids, null, 'c')], ['c'])
  assert.deepEqual([...rangeSelect(new Set(), ids, 'zzz', 'c')], ['c'])
})

test('head box: none, some (indeterminate), all of the visible rows; hidden selected rows do not count', () => {
  assert.equal(headState(ids, new Set()), 'none')
  assert.equal(headState(ids, new Set(['a'])), 'some')
  assert.equal(headState(ids, new Set(ids)), 'all')
  assert.equal(headState(['a', 'b'], new Set(['x', 'y'])), 'none')
  assert.equal(headState([], new Set()), 'none')
})

test('select-all affects only visible rows: it adds them, and clears only them when told to', () => {
  assert.deepEqual([...setAll(new Set(['x']), ['a', 'b'], true)].sort(), ['a', 'b', 'x'])
  assert.deepEqual([...setAll(new Set(['x', 'a', 'b']), ['a', 'b'], false)], ['x'])
})

test('a filter change keeps the selection only for rows that are still visible', () => {
  assert.deepEqual([...keepVisible(new Set(['a', 'x', 'c']), ['a', 'b', 'c'])].sort(), ['a', 'c'])
})
