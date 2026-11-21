import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchBundle, engineErrorText } from '../src/content/fetch-bundle.ts'
import { EngineError } from '../src/engine/service.ts'
import { BUNDLE_SCHEMA } from '../src/content/types.ts'

const res = (body: string, status = 200) => async () => new Response(body, { status })

test('a server that answers the bundle URL with an HTML page gives a readable message, not a JSON syntax error', async () => {
  await assert.rejects(fetchBundle(res('<!doctype html><html></html>')), (e: Error) => /Inhaltsdatei/.test(e.message) && !/Unexpected|JSON/.test(e.message))
})

test('an unreachable server gives a readable message', async () => {
  await assert.rejects(fetchBundle(async () => { throw new TypeError('Failed to fetch') }), (e: Error) => /nicht erreichbar/.test(e.message) && !/Failed to fetch/.test(e.message))
})

test('an HTTP error keeps its status', async () => {
  await assert.rejects(fetchBundle(res('nope', 404)), /HTTP 404/)
})

test('a JSON file of the right schema but without trees/openings is refused', async () => {
  await assert.rejects(fetchBundle(res(JSON.stringify({ schemaVersion: BUNDLE_SCHEMA }))), /Inhaltsdatei/)
})

test('a well-formed bundle passes', async () => {
  const b = { schemaVersion: BUNDLE_SCHEMA, openings: [], trees: {} }
  assert.deepEqual(await fetchBundle(res(JSON.stringify(b))), b)
})

test('engine errors are described without the raw worker text; other errors keep their message', () => {
  const t = engineErrorText(new EngineError('engine failed: worker failed to load /engine/x.js'))
  assert.match(t, /Stockfish/)
  assert.doesNotMatch(t, /worker failed/)
  assert.equal(engineErrorText(new Error('Die Engine hat keine Bewertung geliefert')), 'Die Engine hat keine Bewertung geliefert')
})
