import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic } from '../tools/lib/sources.ts'

test('writeAtomic replaces the target, and a failed write leaves no .tmp behind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-'))
  const file = join(dir, 'a.json')
  writeAtomic(file, 'one')
  writeAtomic(file, 'two')
  assert.equal(readFileSync(file, 'utf8'), 'two')
  assert.equal(existsSync(`${file}.tmp`), false)
  // a non-empty directory in the way makes the final rename fail
  const blocked = join(dir, 'b.json')
  mkdirSync(join(blocked, 'x'), { recursive: true })
  assert.throws(() => writeAtomic(blocked, 'data'))
  assert.equal(existsSync(`${blocked}.tmp`), false)
})
