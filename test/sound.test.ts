import { test } from 'node:test'
import assert from 'node:assert/strict'
import { soundForSan, soundForTransition, parseSoundSettings, DEFAULT_SOUND, soundFile, SOUND_SETS, nextTake } from '../src/ui/sound.ts'

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
  assert.deepEqual(parseSoundSettings({ on: false, volume: 0.25 }), { on: false, volume: 0.25, set: 'holz' })
  assert.equal(parseSoundSettings({ volume: 7 }).volume, 1)
  assert.equal(parseSoundSettings({ volume: -1 }).volume, 0)
  assert.deepEqual(parseSoundSettings({ on: 'yes', volume: 'loud' }), DEFAULT_SOUND)
})

test('soundFile: own set uses sounds/<name>.mp3; a lila set uses its folder and falls back to our own files for missing sounds', () => {
  assert.equal(soundFile('holz', 'move'), 'sounds/move.mp3')
  assert.equal(soundFile('holz', 'castle'), 'sounds/castle.mp3')
  for (const set of ['sfx', 'piano', 'nes', 'futuristic'] as const) {
    for (const n of ['move', 'capture', 'check', 'end', 'correct'] as const) assert.equal(soundFile(set, n), `sounds/${set}/${n}.mp3`)
    assert.equal(soundFile(set, 'castle'), `sounds/${set}/move.mp3`) // the sets have no castling sound (like Lichess)
    assert.equal(soundFile(set, 'promote'), `sounds/${set}/move.mp3`)
    assert.equal(soundFile(set, 'wrong'), 'sounds/wrong.mp3') // their Error file is the non-free standard set: own tone
  }
})

test('parseSoundSettings: set must be a known one, else the own set', () => {
  assert.equal(parseSoundSettings({ set: 'nes' }).set, 'nes')
  assert.equal(parseSoundSettings({ set: 'standard' }).set, 'holz')
  assert.equal(parseSoundSettings({ set: 7 }).set, 'holz')
  assert.deepEqual(SOUND_SETS.map((x) => x.id), ['holz', 'brett', 'sfx', 'piano', 'nes', 'futuristic'])
})

test('soundFile: the Brett set has three takes per event, all eight events own', () => {
  for (const n of ['move', 'capture', 'check', 'castle', 'promote', 'wrong', 'end', 'correct'] as const) {
    for (const v of [1, 2, 3]) assert.equal(soundFile('brett', n, v), `sounds/brett/${n}-${v}.mp3`)
  }
  assert.equal(soundFile('holz', 'move', 3), 'sounds/move.mp3') // other sets have one take
  assert.equal(soundFile('sfx', 'move', 2), 'sounds/sfx/move.mp3')
})

test('nextTake: rotates randomly over three takes and never repeats the previous one', () => {
  let prev = 0
  const seen = new Set<number>()
  for (let i = 0; i < 300; i++) { const t = nextTake(prev, Math.random()); assert.ok([1, 2, 3].includes(t)); assert.notEqual(t, prev); seen.add(t); prev = t }
  assert.equal(seen.size, 3)
  assert.equal(nextTake(2, 0), 1)
  assert.equal(nextTake(2, 0.99), 3)
})
