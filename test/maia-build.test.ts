import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { copyPinned, fetchPinned, sha256Hex } from '../tools/lib/maia-build.ts'

const dir = () => pathToFileURL(mkdtempSync(join(tmpdir(), 'maia-build-')) + '/')
const body = new TextEncoder().encode('model bytes')
const sum = sha256Hex(body)
const ok: typeof fetch = async () => new Response(body)
const URL_OK = 'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/c2afeeaa96c7664dc9bb81954960b75ede7e4c20/public/maia2/maia_rapid.onnx'

test('sha256Hex', () => {
  assert.equal(sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('fetchPinned: a file with the pinned hash is returned and cached, the cache is written only after the check', async () => {
  const cache = new URL('m.onnx', dir())
  assert.deepEqual(await fetchPinned({ url: URL_OK, sha256: sum, cacheFile: cache, fetchFn: ok }), body)
  assert.deepEqual(new Uint8Array(readFileSync(cache)), body)
})

test('fetchPinned: a wrong hash aborts and leaves nothing behind (M5, fail closed)', async () => {
  const cache = new URL('m.onnx', dir())
  await assert.rejects(fetchPinned({ url: URL_OK, sha256: 'a'.repeat(64), cacheFile: cache, fetchFn: ok }), /SHA-256/)
  assert.equal(existsSync(cache), false)
})

test('fetchPinned: only https, and a redirect is an error', async () => {
  const cache = new URL('m.onnx', dir())
  await assert.rejects(fetchPinned({ url: URL_OK.replace('https:', 'http:'), sha256: sum, cacheFile: cache, fetchFn: ok }), /https/)
  let init: RequestInit | undefined
  await fetchPinned({ url: URL_OK, sha256: sum, cacheFile: cache, fetchFn: async (_u, i) => { init = i; return new Response(body) } })
  assert.equal(init?.redirect, 'error')
})

test('fetchPinned: a cached file with the right hash is used without a download; a wrong cache is downloaded again', async () => {
  const cache = new URL('m.onnx', dir())
  writeFileSync(cache, body)
  const never: typeof fetch = async () => { throw new Error('no download expected') }
  assert.deepEqual(await fetchPinned({ url: URL_OK, sha256: sum, cacheFile: cache, fetchFn: never }), body)
  writeFileSync(cache, 'damaged')
  assert.deepEqual(await fetchPinned({ url: URL_OK, sha256: sum, cacheFile: cache, fetchFn: ok }), body)
  assert.deepEqual(new Uint8Array(readFileSync(cache)), body)
})

test('copyPinned: copies only the listed files after checking their hash (M3)', () => {
  const [src, dest] = [dir(), dir()]
  writeFileSync(new URL('a.wasm', src), body)
  writeFileSync(new URL('other.wasm', src), 'x')
  copyPinned(src, dest, [{ name: 'a.wasm', sha256: sum }])
  assert.deepEqual(new Uint8Array(readFileSync(new URL('a.wasm', dest))), body)
  assert.equal(existsSync(new URL('other.wasm', dest)), false)
})

test('copyPinned: a file with another hash aborts before anything is copied', () => {
  const [src, dest] = [dir(), dir()]
  mkdirSync(new URL('sub/', dest))
  writeFileSync(new URL('a.wasm', src), body)
  writeFileSync(new URL('b.mjs', src), 'tampered')
  assert.throws(() => copyPinned(src, dest, [{ name: 'a.wasm', sha256: sum }, { name: 'b.mjs', sha256: sum }]), /b\.mjs/)
  assert.equal(existsSync(new URL('a.wasm', dest)), false)
})
