import { test } from 'node:test'
import assert from 'node:assert/strict'
import { soundForSan, soundForTransition, parseSoundSettings, DEFAULT_SOUND } from '../src/ui/sound.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('soundForSan: priority end > check > capture > promote > castle > move', () => {
  assert.equal(soundForSan('e4'), 'move')
  assert.equal(soundForSan('Nxf3'), 'capture')
  assert.equal(soundForSan('Qxf7+'), 'check')
  assert.equal(soundForSan('Qxf7#'), 'end')
  assert.equal(soundForSan('O-O'), 'castle')
  assert.equal(soundForSan('O-O-O+'), 'check')
  assert.equal(soundForSan('e8=Q'), 'promote')
  assert.equal(soundForSan('exd8=Q'), 'capture')
})

test('soundForTransition: one legal move from the previous position gives its sound', () => {
  assert.equal(soundForTransition(START, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'), 'move')
  assert.equal(soundForTransition('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2', 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'), 'capture')
  assert.equal(soundForTransition('rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4'), 'castle')
})

test('soundForTransition: the fools mate ends the game', () => {
  assert.equal(soundForTransition('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'), 'end')
})

test('soundForTransition: jumps, steps back and identical positions are silent', () => {
  const after = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
  assert.equal(soundForTransition(after, START), null)
  assert.equal(soundForTransition(START, START), null)
  assert.equal(soundForTransition(START, '8/8/8/8/8/8/8/K6k w - - 0 1'), null)
  assert.equal(soundForTransition('not a fen', START), null)
})

test('parseSoundSettings: defaults on, bad stored data falls back, volume is clamped', () => {
  assert.deepEqual(parseSoundSettings(undefined), DEFAULT_SOUND)
  assert.equal(DEFAULT_SOUND.on, true)
  assert.deepEqual(parseSoundSettings({ on: false, volume: 0.25 }), { on: false, volume: 0.25 })
  assert.equal(parseSoundSettings({ volume: 7 }).volume, 1)
  assert.equal(parseSoundSettings({ volume: -1 }).volume, 0)
  assert.deepEqual(parseSoundSettings({ on: 'yes', volume: 'loud' }), DEFAULT_SOUND)
})
