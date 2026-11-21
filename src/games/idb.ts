import { StorageError, storageErrorOf } from './library.ts'
import type { GameStore } from './library.ts'
import type { StoredGame } from './model.ts'

const DB = 'schachtrainer-games'
const STORE = 'games'

/** The game database on top of an IndexedDB factory (no package). The factory is a parameter so tests can use a fake. */
export function createIdbStore(factory: IDBFactory | undefined): GameStore {
  let opened: Promise<IDBDatabase> | null = null

  /** Opens once. A failed open is retried at the next call; a connection the browser closes or upgrades is dropped and reopened. */
  function open(): Promise<IDBDatabase> {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory) return reject(new StorageError('unavailable'))
      let req: IDBOpenDBRequest
      try { req = factory.open(DB, 1) } catch (e) { return reject(storageErrorOf(e)) }
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }) }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => { db.close(); opened = null }
        db.onclose = () => { opened = null }
        resolve(db)
      }
      req.onerror = () => reject(storageErrorOf(req.error))
      req.onblocked = () => reject(new StorageError('unavailable'))
    })
    opened.catch(() => { opened = null })
    return opened
  }

  /** One transaction; the error is taken from the failed request (the transaction error can still be empty at that moment). */
  async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>[]): Promise<T | undefined> {
    const db = await open()
    return new Promise<T | undefined>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, mode)
        const reqs = work(tx.objectStore(STORE))
        const fail = () => reject(storageErrorOf(reqs.find((r) => r.error)?.error ?? tx.error))
        for (const r of reqs) r.onerror = fail
        tx.onerror = tx.onabort = fail
        tx.oncomplete = () => resolve(reqs.at(-1)?.result)
      } catch (e) { reject(storageErrorOf(e)) }
    })
  }

  return {
    put: async (g: StoredGame) => { await run('readwrite', (s) => [s.put(g)]) },
    putMany: async (gs: StoredGame[]) => { if (gs.length) await run('readwrite', (s) => gs.map((g) => s.put(g))) },
    get: async (id) => (await run<StoredGame | undefined>('readonly', (s) => [s.get(id)])) ?? undefined,
    all: async () => (await run<StoredGame[]>('readonly', (s) => [s.getAll()])) ?? [],
    remove: async (id) => { await run('readwrite', (s) => [s.delete(id)]) },
  }
}

/** The browser's game database. */
export const gameStore: GameStore = createIdbStore(typeof indexedDB === 'undefined' ? undefined : indexedDB)
