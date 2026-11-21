import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newClock, parseTimeControl, pause, press, remaining, resume, rewind } from '../src/train/clock.ts'
import type { Clock } from '../src/train/clock.ts'
import type { Side } from '../src/content/types.ts'

const tc = parseTimeControl('3+2')!
const S = 1000

/** One played-through game start for a player on `me`: Stockfish moves first when the player has Black. */
function sequence(me: Side) {
  let c: Clock = newClock(tc)
  c = press(c, 'white', 0)
  c = press(c, 'black', 1 * S) // both first moves done: the clock of White runs from t = 1 s
  const turn = c.turn // white
  return { c, turn, me }
}

test('both sides as the player: start after both first moves, increment, pause and taking a move back', () => {
  for (const me of ['white', 'black'] as const) {
    const { c: start } = sequence(me)
    assert.equal(start.ticking, true, `${me}: the clock runs`)
    assert.equal(remaining(start, 'white', 11 * S), 170 * S, `${me}: White has used 10 s`)

    // the mover (White) moves after 10 s: increment added, Black runs
    const afterWhite = press(start, 'white', 11 * S)
    assert.equal(afterWhite.ms.white, 172 * S, `${me}: increment`)
    // Black thinks 5 s and moves, then the teacher judges (clocks stand) for 30 s
    let c = press(afterWhite, 'black', 16 * S)
    assert.equal(c.ms.black, 180 * S - 5 * S + 2 * S, `${me}: increment of Black`)
    c = pause(c, 16 * S)
    assert.equal(remaining(c, 'white', 46 * S), 172 * S, `${me}: nothing ran during the judging`)
    c = resume(c, 46 * S)
    assert.equal(remaining(c, 'white', 48 * S), 170 * S, `${me}: runs on after the resume`)

    // the move of `me` is taken back: the clock before that move comes back, the thinking time is refunded
    const before = me === 'white' ? afterWhite : start
    const mine = me === 'white' ? press(afterWhite, 'black', 20 * S) : afterWhite
    assert.notEqual(mine, before)
    const back = rewind(before, 100 * S)
    assert.equal(remaining(back, back.turn, 101 * S), before.ms[back.turn] - 1 * S, `${me}: refund`)
  }
})
