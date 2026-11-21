import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { MODEL_BYTES, MODEL_SHA256, ModelIntegrityError, loadVerified } from '../src/maia/load.ts'
import type { LoadProgress } from '../src/maia/load.ts'

const subtle = webcrypto.subtle as SubtleCrypto
const data = new Uint8Array(1000).map((_, i) => i % 251)
const sha = createHash('sha256').update(data).digest('hex')

/** A response that delivers the bytes in chunks of 300, like a network stream. */
const serve = (bytes: Uint8Array, headers: Record<string, string> = { 'content-length': String(bytes.length) }, status = 200): typeof fetch => async () =>
  new Response(new ReadableStream<Uint8Array>({
    start(c) { for (let i = 0; i < bytes.length; i += 300) c.enqueue(bytes.slice(i, i + 300)); c.close() },
  }), { status, headers })

test('pins: SHA-256 and size of maia_rapid.onnx from the security gate (M5/M6)', () => {
  assert.equal(MODEL_SHA256, '027ddb8c1a8b7235b6e51827cffe325f9cb95fd4523dce65a131547c034ccfc9')
  assert.equal(MODEL_BYTES, 93_246_338)
})

test('loadVerified: streams with progress (loaded of total), then "verify", and returns exactly the checked bytes', async () => {
  const seen: LoadProgress[] = []
  const out = await loadVerified({ url: '/maia2/m.onnx', onProgress: (p) => seen.push(p), fetchFn: serve(data), subtle, expectedSha256: sha })
  assert.deepEqual(out, data)
  assert.deepEqual(seen, [
    { phase: 'download', loaded: 300, total: 1000 }, { phase: 'download', loaded: 600, total: 1000 }, { phase: 'download', loaded: 900, total: 1000 },
    { phase: 'download', loaded: 1000, total: 1000 }, { phase: 'verify' },
  ])
})

test('loadVerified: without Content-Length the pinned size is the total', async () => {
  const seen: LoadProgress[] = []
  await loadVerified({ url: '/m', onProgress: (p) => seen.push(p), fetchFn: serve(data, {}), subtle, expectedSha256: sha, maxBytes: 5000 }).catch(() => {})
  assert.equal((seen[0] as { total: number }).total, MODEL_BYTES)
})

test('loadVerified: a changed byte is refused (M6), nothing is returned', async () => {
  const bad = data.slice(); bad[500] ^= 1
  await assert.rejects(loadVerified({ url: '/m', fetchFn: serve(bad), subtle, expectedSha256: sha }), ModelIntegrityError)
})

test('loadVerified: without crypto.subtle there is no download and no model (M6)', async () => {
  let calls = 0
  const f: typeof fetch = async (...a) => { calls++; return serve(data)(...a) }
  await assert.rejects(loadVerified({ url: '/m', fetchFn: f, subtle: undefined, expectedSha256: sha }), /crypto\.subtle/)
  assert.equal(calls, 0)
})

test('loadVerified: HTTP error and a body larger than the pinned size are refused', async () => {
  await assert.rejects(loadVerified({ url: '/m', fetchFn: serve(data, {}, 404), subtle, expectedSha256: sha }), /404/)
  await assert.rejects(loadVerified({ url: '/m', fetchFn: serve(data), subtle, expectedSha256: sha, maxBytes: 500 }), /larger/)
})
