import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createQuipPlayer } from '../src/audio/play-quip.ts'

function fakeAudio(opts: { reject?: boolean } = {}) {
  const made: { src: string; plays: number; pauses: number }[] = []
  const make = () => {
    const a = { src: '', plays: 0, pauses: 0, play() { a.plays++; return opts.reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve() }, pause() { a.pauses++ } }
    made.push(a)
    return a
  }
  return { made, make }
}

test('one audio element is created at unlock and reused for every quip', async () => {
  const f = fakeAudio()
  const p = createQuipPlayer(f.make, () => {})
  await p.unlock()
  await p.play('a.mp3')
  await p.play('b.mp3')
  assert.equal(f.made.length, 1)
  assert.equal(f.made[0]!.src, 'b.mp3')
  assert.equal(f.made[0]!.plays, 3) // silent unlock + two quips
})

test('a rejected play is reported with console.warn style callback, not swallowed', async () => {
  const f = fakeAudio({ reject: true })
  const warns: string[] = []
  const p = createQuipPlayer(f.make, (m) => warns.push(m))
  await p.play('a.mp3')
  assert.equal(warns.length, 1)
  assert.match(warns[0]!, /a\.mp3.*NotAllowedError/)
})

test('unlock superseded by a quip (AbortError) is expected and silent; another failure of the unlock is reported', async () => {
  const abort = Object.assign(new Error('interrupted by pause()'), { name: 'AbortError' })
  const make = (err: Error) => () => ({ src: '', play: () => Promise.reject(err), pause() {} })
  const warns: string[] = []
  await createQuipPlayer(make(abort), (m) => warns.push(m)).unlock()
  assert.equal(warns.length, 0)
  await createQuipPlayer(make(new Error('NotAllowedError')), (m) => warns.push(m)).unlock()
  assert.equal(warns.length, 1)
})
