import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assetUrl } from '../src/ui/asset-url.ts'
import { fetchBundle } from '../src/content/fetch-bundle.ts'

test('assetUrl: joins the Vite base and a public/ path with exactly one slash', () => {
  assert.equal(assetUrl('audio/a.mp3', '/'), '/audio/a.mp3')
  assert.equal(assetUrl('audio/a.mp3', '/schachtrainer-play/'), '/schachtrainer-play/audio/a.mp3')
  assert.equal(assetUrl('/audio/a.mp3', '/schachtrainer-play/'), '/schachtrainer-play/audio/a.mp3')
  assert.equal(assetUrl('engine/x.js', '/p'), '/p/engine/x.js')
  assert.equal(assetUrl('engine/x.js', './'), './engine/x.js')
})

test('fetchBundle: requests the bundle below the given base, not at the domain root', async () => {
  const seen: string[] = []
  const fake = (async (u: string) => { seen.push(u); return { ok: false, status: 404 } }) as unknown as typeof fetch
  await assert.rejects(fetchBundle(fake, '/schachtrainer-play/'))
  assert.deepEqual(seen, ['/schachtrainer-play/content/bundle.json'])
})
