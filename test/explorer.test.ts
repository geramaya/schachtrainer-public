import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lichessExplorer } from '../tools/lib/explorer.ts'

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const body = { moves: [{ uci: 'e7e5', white: 10, draws: 5, black: 10 }, { uci: 'c7c5', white: 5, draws: 0, black: 5 }] }
const ok = (b: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => b }) as unknown as Response

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'exp-'))
  const tokenFile = join(dir, 'token')
  writeFileSync(tokenFile, 'SECRET-TOKEN\n')
  return { dir, tokenFile, cacheFile: join(dir, 'cache.json'), done: () => rmSync(dir, { recursive: true, force: true }) }
}

test('explorer sends the bearer token, filters by rating band in the url, returns games per move and caches by position', async () => {
  const s = setup()
  try {
    const calls: { url: string; auth: string | null }[] = []
    const ex = lichessExplorer({
      tokenFile: s.tokenFile, cacheFile: s.cacheFile, sleep: async () => {},
      fetchFn: async (url, init) => { calls.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') }); return ok(body) },
    })
    const m = await ex.moves(FEN)
    await ex.moves(FEN)
    assert.deepEqual(m, [{ uci: 'e7e5', games: 25 }, { uci: 'c7c5', games: 10 }])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.auth, 'Bearer SECRET-TOKEN')
    assert.match(calls[0]!.url, /ratings=1400,1600,1800/)
    assert.match(calls[0]!.url, /speeds=blitz,rapid,classical/)
  } finally { s.done() }
})

test('explorer waits for Retry-After on 429 and then succeeds; throttles to one request per second', async () => {
  const s = setup()
  try {
    const waits: number[] = []
    let n = 0
    const ex = lichessExplorer({
      tokenFile: s.tokenFile, cacheFile: s.cacheFile, sleep: async (ms) => { waits.push(ms) },
      fetchFn: async () => (n++ === 0 ? ({ ok: false, status: 429, headers: new Headers({ 'retry-after': '7' }) }) as unknown as Response : ok(body)),
    })
    assert.equal((await ex.moves(FEN))!.length, 2)
    assert.ok(waits.includes(7000), `waited ${waits}`)
  } finally { s.done() }
})

test('explorer falls back to null when unreachable, reports it and never leaks the token', async () => {
  const s = setup()
  try {
    const ex = lichessExplorer({
      tokenFile: s.tokenFile, cacheFile: s.cacheFile, sleep: async () => {},
      fetchFn: async () => { throw new Error('connect ECONNREFUSED') },
    })
    assert.equal(await ex.moves(FEN), null)
    assert.equal(ex.status().failed, 1)
    assert.doesNotMatch(JSON.stringify(ex.status()), /SECRET/)
  } finally { s.done() }
})

test('explorer without token file is off: no request, null', async () => {
  let called = false
  const ex = lichessExplorer({ cacheFile: '/nonexistent/x.json', fetchFn: async () => { called = true; return ok(body) } })
  assert.equal(await ex.moves(FEN), null)
  assert.equal(called, false)
  assert.equal(ex.status().enabled, false)
})

test('the explorer keeps working when the global fetch is removed after loading (the wasm engine does that)', async () => {
  const real = globalThis.fetch
  const fake = (async () => new Response(JSON.stringify({ moves: [{ uci: 'e2e4', white: 1, draws: 1, black: 1 }] }))) as typeof fetch
  globalThis.fetch = fake
  const { lichessExplorer: fresh } = await import(`../tools/lib/explorer.ts?fresh=${Date.now()}`)
  globalThis.fetch = undefined as never
  try {
    const dir = mkdtempSync(join(tmpdir(), 'explorer-'))
    writeFileSync(join(dir, 'token'), 'tkn')
    const ex = fresh({ tokenFile: join(dir, 'token'), cacheFile: join(dir, 'cache.json'), sleep: async () => {} })
    assert.deepEqual(await ex.moves('fen-a'), [{ uci: 'e2e4', games: 3 }])
    rmSync(dir, { recursive: true })
  } finally {
    globalThis.fetch = real
  }
})

test('normalizeCastling turns the explorer king-takes-rook notation into the king move, for both sides and wings', async () => {
  const { normalizeCastling } = await import('../tools/lib/explorer.ts')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1h1'), 'e1g1')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1a1'), 'e1c1')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8h8'), 'e8g8')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8a8'), 'e8c8')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1f1'), 'e1f1', 'an ordinary king move stays')
  assert.equal(normalizeCastling('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'a1h1'), 'a1h1', 'a rook move stays')
  assert.equal(normalizeCastling('4k3/8/8/8/8/8/8/R3K2N w KQ - 0 1', 'e1h1'), 'e1h1', 'a knight on h1 is no castling')
})

test('the explorer returns castling as king moves, also from an older cache entry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'explorer-'))
  writeFileSync(join(dir, 'token'), 'tkn')
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'
  writeFileSync(join(dir, 'cache.json'), JSON.stringify({ [fen]: [{ uci: 'e8h8', games: 50 }] }))
  const ex = lichessExplorer({ tokenFile: join(dir, 'token'), cacheFile: join(dir, 'cache.json'), sleep: async () => {} })
  assert.deepEqual(await ex.moves(fen), [{ uci: 'e8g8', games: 50 }])
  rmSync(dir, { recursive: true })
})

test('explorer with its own base url (Lehrgang band 1200-1600) leaves the default band of the content pipeline untouched', async () => {
  const s = setup()
  try {
    const urls: string[] = []
    const mk = (base?: string) => lichessExplorer({ tokenFile: s.tokenFile, cacheFile: s.cacheFile + (base ? '.l' : ''), sleep: async () => {}, base, fetchFn: async (u) => { urls.push(String(u)); return ok(body) } })
    await mk('https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical&ratings=1200,1400,1600').moves(FEN)
    await mk().moves(FEN)
    assert.match(urls[0]!, /ratings=1200,1400,1600/)
    assert.match(urls[1]!, /ratings=1400,1600,1800/)
  } finally { s.done() }
})
