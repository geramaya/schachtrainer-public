import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, makeZip } from '../src/games/zip.ts'

const enc = new TextEncoder()
const when = new Date(2026, 10, 21, 14, 30, 42) // local time: 2026-11-21 14:30:42

test('crc32 matches the well-known check value', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926)
  assert.equal(crc32(new Uint8Array(0)), 0)
})

test('archive structure: local headers, central directory and end record agree', () => {
  const a = enc.encode('1. e4 e5 *\n')
  const b = enc.encode('1. d4 d5 *\n')
  const z = makeZip([{ name: 'a.pgn', data: a, date: when }, { name: 'ü.pgn', data: b, date: when }])
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
  assert.equal(v.getUint32(0, true), 0x04034b50, 'local header signature')
  assert.equal(v.getUint16(6, true) & 0x0800, 0x0800, 'UTF-8 name flag')
  assert.equal(v.getUint16(8, true), 0, 'method STORE')
  assert.equal(v.getUint32(14, true), crc32(a))
  assert.equal(v.getUint32(18, true), a.length)
  assert.equal(v.getUint32(22, true), a.length)
  // DOS time 14:30:42 -> (14<<11)|(30<<5)|21 ; date 2026-11-21 -> ((2026-1980)<<9)|(11<<5)|21
  assert.equal(v.getUint16(10, true), (14 << 11) | (30 << 5) | 21)
  assert.equal(v.getUint16(12, true), ((2026 - 1980) << 9) | (11 << 5) | 21)
  const eocd = z.length - 22
  assert.equal(v.getUint32(eocd, true), 0x06054b50)
  assert.equal(v.getUint16(eocd + 8, true), 2, 'entries on this disk')
  assert.equal(v.getUint16(eocd + 10, true), 2, 'entries total')
  const cdSize = v.getUint32(eocd + 12, true)
  const cdOff = v.getUint32(eocd + 16, true)
  assert.equal(cdOff + cdSize, eocd)
  assert.equal(v.getUint32(cdOff, true), 0x02014b50)
  const second = cdOff + 46 + 'a.pgn'.length
  assert.equal(v.getUint32(second, true), 0x02014b50)
  const localOffset = v.getUint32(second + 42, true)
  assert.equal(v.getUint32(localOffset, true), 0x04034b50, 'central entry points at a local header')
  assert.equal(new TextDecoder().decode(z.subarray(localOffset + 30, localOffset + 30 + v.getUint16(localOffset + 26, true))), 'ü.pgn')
})

test('an empty archive is just the end record', () => {
  assert.equal(makeZip([]).length, 22)
})

test('dates before 1980 are clamped, not wrapped', () => {
  const z = makeZip([{ name: 'x', data: new Uint8Array(0), date: new Date(1970, 0, 1) }])
  assert.equal(new DataView(z.buffer, z.byteOffset).getUint16(12, true), (0 << 9) | (1 << 5) | 1)
})

test('python zipfile and unzip read the archive as valid with the right content', (t) => {
  const py = spawnSync('python3', ['-c', 'import zipfile'])
  const unzip = spawnSync('unzip', ['-v'])
  if (py.status !== 0 && unzip.status !== 0) { t.skip('neither python3 nor unzip available'); return }
  const dir = mkdtempSync(join(tmpdir(), 'zip-test-'))
  try {
    const path = join(dir, 'x.zip')
    writeFileSync(path, makeZip([{ name: '2026-11-21_Weiss-Schwarz_B01.pgn', data: enc.encode('[Event "ä"]\n\n1. e4 *\n'), date: when }, { name: 'zwei.pgn', data: enc.encode('2'), date: when }]))
    if (py.status === 0) {
      const code = 'import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint("|".join(z.namelist()))\nprint(z.read(z.namelist()[0]).decode("utf-8"))'
      const out = execFileSync('python3', ['-I', '-c', code, path]).toString()
      assert.match(out, /^2026-11-21_Weiss-Schwarz_B01\.pgn\|zwei\.pgn\n\[Event "ä"\]/)
    }
    if (unzip.status === 0) assert.equal(spawnSync('unzip', ['-t', path]).status, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
