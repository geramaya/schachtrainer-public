import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNoteSaver } from '../src/games/note-saver.ts'
import type { NoteStatus } from '../src/games/note-saver.ts'

/** Manual clock: timers run when the test says so. */
function harness(save: (id: string, ply: number, text: string) => Promise<{ ok: true } | { ok: false; message: string }>) {
  let next = 1
  const timers = new Map<number, { fn: () => void; ms: number }>()
  const status: NoteStatus[] = []
  const saver = createNoteSaver({
    delayMs: 800, save, onStatus: (s) => status.push(s),
    schedule: (fn, ms) => { const h = next++; timers.set(h, { fn, ms }); return h },
    cancel: (h) => { timers.delete(h as number) },
  })
  const fire = () => { for (const [h, t] of [...timers]) { timers.delete(h); t.fn() } }
  return { saver, timers, fire, status }
}
test('typing is debounced: many changes, one save of the last text after the delay', async () => {
  const calls: [string, number, string][] = []
  const h = harness(async (id, ply, text) => { calls.push([id, ply, text]); return { ok: true } })
  h.saver.change({ id: 'g1', ply: 2 }, 'a')
  h.saver.change({ id: 'g1', ply: 2 }, 'ab')
  h.saver.change({ id: 'g1', ply: 2 }, 'abc')
  assert.equal(h.timers.size, 1, 'one timer, restarted on each keystroke')
  assert.equal([...h.timers.values()][0]!.ms, 800)
  assert.deepEqual(calls, [])
  h.fire()
  await h.saver.idle()
  assert.deepEqual(calls, [['g1', 2, 'abc']])
})

test('changing the move saves the old text for the OLD move immediately', async () => {
  const calls: [string, number, string][] = []
  const h = harness(async (id, ply, text) => { calls.push([id, ply, text]); return { ok: true } })
  h.saver.change({ id: 'g1', ply: 2 }, 'zu Zug 2')
  h.saver.change({ id: 'g1', ply: 5 }, 'zu Zug 5')
  await h.saver.idle()
  assert.deepEqual(calls, [['g1', 2, 'zu Zug 2']], 'the first note was saved at once, the second waits for its timer')
  h.fire()
  await h.saver.idle()
  assert.deepEqual(calls, [['g1', 2, 'zu Zug 2'], ['g1', 5, 'zu Zug 5']])
})

test('flush (leaving the page, hiding the tab) saves what is pending without waiting', async () => {
  const calls: string[] = []
  const h = harness(async (_i, _p, text) => { calls.push(text); return { ok: true } })
  h.saver.change({ id: 'g1', ply: 0 }, 'noch nicht gespeichert')
  await h.saver.flush()
  assert.deepEqual(calls, ['noch nicht gespeichert'])
  assert.equal(h.timers.size, 0, 'the timer is gone')
  await h.saver.flush()
  assert.equal(calls.length, 1, 'nothing pending: no second save')
})

test('another game: its text is saved under ITS id', async () => {
  const calls: [string, number][] = []
  const h = harness(async (id, ply) => { calls.push([id, ply]); return { ok: true } })
  h.saver.change({ id: 'g1', ply: 1 }, 'x')
  h.saver.change({ id: 'g2', ply: 1 }, 'y')
  await h.saver.flush()
  assert.deepEqual(calls, [['g1', 1], ['g2', 1]])
})

test('status: saving, then saved; an error keeps the message and the next try can succeed', async () => {
  let fail = true
  const h = harness(async () => (fail ? { ok: false, message: 'Speicher voll' } : { ok: true }))
  h.saver.change({ id: 'g', ply: 0 }, 'a')
  await h.saver.flush()
  assert.deepEqual(h.status, [{ kind: 'saving' }, { kind: 'error', message: 'Speicher voll' }])
  fail = false
  h.saver.change({ id: 'g', ply: 0 }, 'ab')
  await h.saver.flush()
  assert.deepEqual(h.status.slice(2), [{ kind: 'saving' }, { kind: 'saved' }])
})

test('saves never overlap: a slow save is finished before the next one starts', async () => {
  const log: string[] = []
  let release!: () => void
  const h = harness(async (_i, _p, text) => {
    log.push(`start ${text}`)
    if (text === 'a') await new Promise<void>((r) => { release = r })
    log.push(`end ${text}`)
    return { ok: true }
  })
  h.saver.change({ id: 'g', ply: 0 }, 'a')
  const first = h.saver.flush()
  await Promise.resolve()
  h.saver.change({ id: 'g', ply: 0 }, 'b')
  const second = h.saver.flush()
  await Promise.resolve()
  assert.deepEqual(log, ['start a'])
  release()
  await Promise.all([first, second])
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b'])
})

test('an unchanged note after a successful save is not saved again', async () => {
  let n = 0
  const h = harness(async () => { n++; return { ok: true } })
  h.saver.change({ id: 'g', ply: 0 }, 'x')
  await h.saver.flush()
  h.saver.change({ id: 'g', ply: 0 }, 'x')
  await h.saver.flush()
  assert.equal(n, 1)
})
