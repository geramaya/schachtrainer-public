import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createIdbStore } from '../src/games/idb.ts'
import { StorageError } from '../src/games/library.ts'
import type { StoredGame } from '../src/games/model.ts'

/** Small hand-made IndexedDB: enough to drive open, transactions, request and transaction errors. */
class Req<T> { result?: T; error: unknown = null; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void; onblocked?: () => void }
class Fake {
  opens = 0
  failOpen: { name: string } | null = null
  /** the next request fails with this error; the transaction error stays empty (as in browsers at the moment of the request error) */
  failRequest: { name: string } | null = null
  /** the transaction aborts without any error object */
  abortSilently = false
  db: FakeDb | null = null
  readonly rows = new Map<string, StoredGame>()
  open() {
    this.opens++
    const r = new Req<FakeDb>()
    queueMicrotask(() => {
      if (this.failOpen) { r.error = this.failOpen; r.onerror?.(); return }
      this.db = new FakeDb(this)
      r.result = this.db
      r.onupgradeneeded?.()
      r.onsuccess?.()
    })
    return r
  }
}
class FakeDb {
  onclose?: () => void
  onversionchange?: () => void
  closed = false
  private f: Fake
  constructor(f: Fake) { this.f = f }
  createObjectStore() {}
  close() { this.closed = true }
  transaction() { return new FakeTx(this.f) }
}
class FakeTx {
  error: unknown = null
  oncomplete?: () => void
  onerror?: () => void
  onabort?: () => void
  private f: Fake
  constructor(f: Fake) { this.f = f }
  objectStore() {
    const finish = <T>(r: Req<T>, value: T, apply?: () => void) => {
      queueMicrotask(() => {
        if (this.f.failRequest) { r.error = this.f.failRequest; this.f.failRequest = null; r.onerror?.(); this.onabort?.(); return }
        if (this.f.abortSilently) { this.onabort?.(); return }
        apply?.()
        r.result = value
        r.onsuccess?.()
        this.oncomplete?.()
      })
      return r
    }
    return {
      put: (g: StoredGame) => finish(new Req<string>(), g.id, () => this.f.rows.set(g.id, g)),
      get: (id: string) => finish(new Req<StoredGame | undefined>(), this.f.rows.get(id)),
      getAll: () => finish(new Req<StoredGame[]>(), [...this.f.rows.values()]),
      delete: (id: string) => finish(new Req<undefined>(), undefined, () => this.f.rows.delete(id)),
    }
  }
}
const asFactory = (f: Fake) => f as unknown as IDBFactory
const game = (id: string) => ({ id } as StoredGame)

test('put, putMany, get, all, remove work against the factory', async () => {
  const f = new Fake()
  const s = createIdbStore(asFactory(f))
  await s.put(game('a'))
  await s.putMany([game('b'), game('c')])
  assert.deepEqual((await s.all()).map((g) => g.id).sort(), ['a', 'b', 'c'])
  assert.equal((await s.get('b'))?.id, 'b')
  await s.remove('b')
  assert.equal(await s.get('b'), undefined)
  assert.equal(f.opens, 1)
})

test('a full disk is reported as quota, taken from the request although the transaction error is empty', async () => {
  const f = new Fake()
  const s = createIdbStore(asFactory(f))
  f.failRequest = { name: 'QuotaExceededError' }
  await assert.rejects(() => s.put(game('a')), (e: StorageError) => e.kind === 'quota' && /voll/.test(e.message))
})

test('an abort without any error object gives a readable message, not "null"', async () => {
  const f = new Fake()
  const s = createIdbStore(asFactory(f))
  f.abortSilently = true
  await assert.rejects(() => s.put(game('a')), (e: StorageError) => e.kind === 'failed' && !/null/.test(e.message) && /unbekannt/.test(e.message))
})

test('no IndexedDB (private mode) and a blocked open are "unavailable"; the open is retried later', async () => {
  await assert.rejects(() => createIdbStore(undefined).all(), (e: StorageError) => e.kind === 'unavailable')
  const f = new Fake()
  f.failOpen = { name: 'SecurityError' }
  const s = createIdbStore(asFactory(f))
  await assert.rejects(() => s.all(), (e: StorageError) => e.kind === 'unavailable')
  f.failOpen = null
  assert.deepEqual(await s.all(), [])
  assert.equal(f.opens, 2)
})

test('a connection the browser closed or upgraded is opened again at the next call', async () => {
  const f = new Fake()
  const s = createIdbStore(asFactory(f))
  await s.put(game('a'))
  f.db!.onclose!()
  await s.put(game('b'))
  assert.equal(f.opens, 2)
  f.db!.onversionchange!()
  assert.equal(f.db!.closed, true)
  await s.put(game('c'))
  assert.equal(f.opens, 3)
})
