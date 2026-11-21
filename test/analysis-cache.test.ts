import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachedEngine } from '../tools/lib/analysis-cache.ts'
import { fakeEngine } from './fake-engine.ts'

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('cachedEngine asks the engine once per position, depth and multipv, and survives a restart via the file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cache-'))
  const file = join(dir, 'a.json')
  try {
    const inner = fakeEngine()
    const c1 = cachedEngine(inner, file)
    const a = await c1.analyse(FEN, { depth: 18, multipv: 2 })
    await c1.analyse(FEN, { depth: 18, multipv: 2 })
    await c1.analyse(FEN, { depth: 18, multipv: 3 })
    assert.equal(inner.calls.length, 2, 'same key not asked twice, other multipv is another key')
    c1.flush()
    const inner2 = fakeEngine()
    const b = await cachedEngine(inner2, file).analyse(FEN, { depth: 18, multipv: 2 })
    assert.equal(inner2.calls.length, 0)
    assert.deepEqual(b, a)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
