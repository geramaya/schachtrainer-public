import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeLayers, isLocked, parseLayerSettings } from '../src/ui/layerSettings.ts'

const all = parseLayerSettings(JSON.stringify({ hanging: true, counts: true, control: true, threats: true, reach: true }))

test('layer lock "all" (Wertungspartie): every layer is off, whatever is switched on', () => {
  assert.deepEqual([...activeLayers(all, 'all')], [])
  assert.equal(isLocked('reach', 'all'), true)
  assert.equal(isLocked('threats', 'all'), true)
})

test('layer lock true (open exercise) keeps its old meaning; false locks nothing', () => {
  assert.deepEqual([...activeLayers(all, true)].sort(), ['reach', 'threats'])
  assert.equal(activeLayers(all, false).size, 5)
})
