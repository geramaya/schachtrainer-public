import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TIME_CONTROLS, canMate, clockPaused, engineMoveMs, flagWinner, flagged, formatClock, newClock, parseTimeControl, pause, pgnTimeControl, press, remaining, resume, rewind } from '../src/train/clock.ts'

const tc = parseTimeControl('3+2')!
const S = 1000

test('presets: none is the default, the Lichess groups are there, stored data is validated', () => {
  assert.equal(parseTimeControl(null), null)
  assert.equal(parseTimeControl('none'), null)
  assert.equal(parseTimeControl('7+7'), null)
  assert.deepEqual(TIME_CONTROLS.map((g) => g.items.map((i) => i.id)), [['1+0', '2+1'], ['3+0', '3+2', '5+0', '5+3'], ['10+0', '10+5', '15+10'], ['30+0', '30+20']])
  assert.deepEqual([tc.baseMs, tc.incMs, pgnTimeControl(tc)], [180 * S, 2 * S, '180+2'])
})

test('the clock starts only after both sides made their first move (first moves run no clock and give no increment)', () => {
  let c = newClock(tc)
  c = press(c, 'white', 0)
  assert.equal(c.ticking, false)
  assert.equal(remaining(c, 'white', 50 * S), 180 * S)
  c = press(c, 'black', 10 * S)
  assert.equal(c.ticking, true)
  assert.equal(c.turn, 'white')
  assert.equal(remaining(c, 'white', 14 * S), 176 * S) // 4 s since Black moved
  assert.equal(remaining(c, 'black', 14 * S), 180 * S)
})

test('a move deducts the elapsed time and adds the increment', () => {
  let c = press(press(newClock(tc), 'white', 0), 'black', 0)
  c = press(c, 'white', 10 * S) // white thought 10 s
  assert.equal(c.ms.white, 180 * S - 10 * S + 2 * S)
  assert.equal(c.turn, 'black')
  c = press(c, 'black', 13 * S)
  assert.equal(c.ms.black, 180 * S - 3 * S + 2 * S)
})

test('pause stops the running clock, resume goes on from there; both are idempotent', () => {
  let c = press(press(newClock(tc), 'white', 0), 'black', 0)
  c = pause(c, 5 * S)
  assert.equal(remaining(c, 'white', 100 * S), 175 * S)
  assert.equal(pause(c, 200 * S), c)
  c = resume(c, 100 * S)
  assert.equal(remaining(c, 'white', 103 * S), 172 * S)
  assert.equal(resume(c, 104 * S), c)
  assert.equal(resume(pause(newClock(tc), 1), 2).ticking, false) // nobody has moved: nothing to run
})

test('a move made while the clock stands deducts nothing (reading a hint costs no time)', () => {
  let c = press(press(newClock(tc), 'white', 0), 'black', 0)
  c = pause(c, 4 * S)
  c = press(c, 'white', 500 * S)
  assert.equal(c.ms.white, 176 * S + 2 * S)
})

test('flagged: the ticking side that ran out; never while paused', () => {
  let c = press(press(newClock({ ...tc, baseMs: 5 * S, incMs: 0 }), 'white', 0), 'black', 0)
  assert.equal(flagged(c, 4 * S), null)
  assert.equal(flagged(c, 5 * S), 'white')
  assert.equal(remaining(c, 'white', 99 * S), 0)
  c = pause(c, 3 * S)
  assert.equal(flagged(c, 99 * S), null)
})

test('rewind (a held move is taken back): the thinking time is refunded and no increment is kept', () => {
  const before = press(press(newClock(tc), 'white', 0), 'black', 0)
  const afterMove = press(before, 'white', 30 * S)
  assert.equal(afterMove.ms.white, 152 * S)
  const back = rewind(before, 40 * S)
  assert.equal(back.ms.white, 180 * S)
  assert.equal(remaining(back, 'white', 41 * S), 179 * S)
})

test('clockPaused: the teacher stops the clocks during judging, the question and an open hint, only with the switch on and a teacher', () => {
  const idle = { withTeacher: true, teacherPause: true, judging: false, pending: false, helpOpen: false }
  assert.equal(clockPaused(idle), false)
  for (const k of ['judging', 'pending', 'helpOpen'] as const) {
    assert.equal(clockPaused({ ...idle, [k]: true }), true, k)
    assert.equal(clockPaused({ ...idle, [k]: true, teacherPause: false }), false, `${k} with the switch off`)
    assert.equal(clockPaused({ ...idle, [k]: true, withTeacher: false }), false, `${k} without teacher`)
  }
})

test('formatClock: m:ss, tenths below 20 seconds', () => {
  assert.equal(formatClock(180 * S), '3:00')
  assert.equal(formatClock(125 * S), '2:05')
  assert.equal(formatClock(59_999), '1:00')
  assert.equal(formatClock(20 * S), '0:20')
  assert.equal(formatClock(19_540), '0:19.5')
  assert.equal(formatClock(0), '0:00.0')
  assert.equal(formatClock(-30), '0:00.0')
})

test('canMate / flagWinner: out of time loses, unless the opponent cannot mate', () => {
  assert.equal(canMate('4k3/8/8/8/8/8/8/4K2R w - - 0 1', 'white'), true)
  assert.equal(canMate('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', 'white'), true)
  assert.equal(canMate('4k3/8/8/8/8/8/8/4KB2 w - - 0 1', 'white'), false)
  assert.equal(canMate('4k3/8/8/8/8/8/8/3NKN2 w - - 0 1', 'white'), true)
  assert.equal(canMate('4k3/8/8/8/8/8/8/4KN2 w - - 0 1', 'white'), false)
  assert.equal(flagWinner('4k3/8/8/8/8/8/8/4K2R w - - 0 1', 'black'), 'white')
  assert.equal(flagWinner('4k3/8/8/8/8/8/8/4KB2 w - - 0 1', 'black'), null)
})

test('engineMoveMs: share of the remaining time plus most of the increment, capped by strength, never senseless in time trouble', () => {
  assert.equal(engineMoveMs(180 * S, 0, 1500), 1250) // cap of 1500 Elo: 800 + 180 * 2.5
  assert.equal(engineMoveMs(180 * S, 0, 2400), 3500)
  assert.equal(engineMoveMs(10 * S, 0, 1500), 333)
  assert.equal(engineMoveMs(10 * S, 2 * S, 1500), 1250) // 333 + 1600 capped
  assert.equal(engineMoveMs(100, 0, 1500), 30)
  assert.ok(engineMoveMs(1000, 0, 2400) < 1000)
})
