import { test } from 'node:test'
import assert from 'node:assert/strict'
import { syncConfig } from '../src/ui/boardSync.ts'

const cfg = { fen: 'A', orientation: 'white', drawable: { autoShapes: [] } }

test('a re-sync of the same position must not hand the fen to the board (that would wipe the own arrows and circles)', () => {
  const next = syncConfig(cfg, 'A')
  assert.equal('fen' in next, false)
  assert.equal(next.orientation, 'white')
  assert.deepEqual(next.drawable, cfg.drawable)
})

test('a new position or the first sync keeps the fen', () => {
  assert.equal(syncConfig(cfg, 'B').fen, 'A')
  assert.equal(syncConfig(cfg, null).fen, 'A')
})
