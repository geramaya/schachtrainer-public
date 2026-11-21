import type { GameStore } from '../src/games/library.ts'
import type { StoredGame } from '../src/games/model.ts'

/** In-memory stand-in for the IndexedDB store; `fail` makes every call throw (quota, blocked ...). */
export class MemoryStore implements GameStore {
  readonly data = new Map<string, StoredGame>()
  /** sizes of the putMany calls (= transactions) */
  readonly batches: number[] = []
  /** number of write calls (put, putMany) */
  writes = 0
  fail: unknown = null
  private check() { if (this.fail) throw this.fail }
  async put(g: StoredGame) { this.check(); this.writes++; this.data.set(g.id, structuredClone(g)) }
  async putMany(gs: StoredGame[]) { this.check(); this.writes++; this.batches.push(gs.length); for (const g of gs) this.data.set(g.id, structuredClone(g)) }
  async get(id: string) { this.check(); const g = this.data.get(id); return g ? structuredClone(g) : undefined }
  async all() { this.check(); return [...this.data.values()].map((g) => structuredClone(g)) }
  async remove(id: string) { this.check(); this.data.delete(id) }
}
