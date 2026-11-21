import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backupInfo, needsMigration, restoreBackup, saveBackup, BACKUP_KEY } from '../src/store/backup.ts'
import { emptyProgress, KEY } from '../src/store/progress.ts'
import type { Card } from '../src/train/srs.ts'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size } }
}
const card = (over: Partial<Card> = {}): Card => ({ key: 'k w', expectedUci: 'e2e4', variationId: 'v', due: 1, intervalDays: 1, ease: 2.5, reps: 1, lapses: 0, contentVersion: 'c', origin: 'baum', ...over }) as Card
const legacyState = () => ({ ...emptyProgress(), cards: { 'k w': card() } })
const currentState = () => ({ ...emptyProgress(), cards: { 'o:k w': card({ openingId: 'o' }) } })

test('a state with cards without openingId or with legacy overlay groups needs migration; a current one does not', () => {
  assert.equal(needsMigration(legacyState()), true)
  assert.equal(needsMigration({ ...emptyProgress(), overlays: { white: { 'k w': 'e2e4' } } }), true)
  assert.equal(needsMigration(currentState()), false)
  assert.equal(needsMigration(emptyProgress()), false)
})

test('a saved backup holds the old state and its date, and restores it into the live key', () => {
  const s = memoryStorage()
  const old = legacyState()
  assert.equal(saveBackup(s, old, 1_700_000_000_000), true)
  assert.deepEqual(backupInfo(s), { savedAt: 1_700_000_000_000, cards: 1 })
  const r = restoreBackup(s)
  assert.equal(r.ok, true)
  assert.deepEqual(JSON.parse(s.getItem(KEY)!).cards, old.cards)
})

test('restoring without a backup or from a damaged one reports an error and leaves the live state alone', () => {
  const s = memoryStorage()
  s.setItem(KEY, 'live')
  assert.equal(restoreBackup(s).ok, false)
  s.setItem(BACKUP_KEY, '{kaputt')
  assert.equal(backupInfo(s), null)
  assert.equal(restoreBackup(s).ok, false)
  assert.equal(s.getItem(KEY), 'live')
})

test('saveBackup reports false when the browser refuses to store', () => {
  const s = memoryStorage()
  s.setItem = () => { throw new Error('quota') }
  assert.equal(saveBackup(s, legacyState(), 1), false)
})
