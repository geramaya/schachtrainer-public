import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playStep } from '../src/train/playback.ts'

test('playback advances one ply and keeps going on plain positions', () => {
  assert.deepEqual(playStep(2, [5, 9], 12), { ply: 3, playing: true })
})

test('playback stops on a key position', () => {
  assert.deepEqual(playStep(4, [5, 9], 12), { ply: 5, playing: false })
})

test('playback stops at the end of the line', () => {
  assert.deepEqual(playStep(11, [], 12), { ply: 12, playing: false })
  assert.deepEqual(playStep(12, [], 12), { ply: 12, playing: false })
})
