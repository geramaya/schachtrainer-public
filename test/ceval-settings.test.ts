import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, parseSettings, loadSettings, saveSettings, engineAccess } from '../src/coach/cevalSettings.ts'

function memStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, m }
}

test('parseSettings: defaults are enabled, 3 lines, depth 22', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { enabled: true, multipv: 3, depth: 22 })
  assert.deepEqual(parseSettings(undefined), DEFAULT_SETTINGS)
})

test('parseSettings clamps lines to 1-5 and depth to 10-30, drops wrong types', () => {
  assert.deepEqual(parseSettings({ enabled: false, multipv: 9, depth: 99 }), { enabled: false, multipv: 5, depth: 30 })
  assert.deepEqual(parseSettings({ multipv: 0, depth: 2 }), { enabled: true, multipv: 1, depth: 10 })
  assert.deepEqual(parseSettings({ enabled: 'yes', multipv: 'x', depth: null }), DEFAULT_SETTINGS)
  assert.deepEqual(parseSettings({ multipv: 2.7 }), { ...DEFAULT_SETTINGS, multipv: 3 })
})

test('save then load round-trips through storage', () => {
  const s = memStorage()
  saveSettings({ enabled: false, multipv: 2, depth: 18 }, s)
  assert.deepEqual(loadSettings(s), { enabled: false, multipv: 2, depth: 18 })
})

test('loadSettings survives missing storage, broken JSON and throwing storage', () => {
  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS)
  assert.deepEqual(loadSettings(memStorage({ 'schachtrainer.engine': '{nope' })), DEFAULT_SETTINGS)
  const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS)
  assert.doesNotThrow(() => saveSettings(DEFAULT_SETTINGS, throwing))
})

test('engineAccess: a lock beats the switch; off beats on; busy waits', () => {
  assert.equal(engineAccess(true, null), 'on')
  assert.equal(engineAccess(false, null), 'off')
  assert.equal(engineAccess(true, 'task'), 'locked')
  assert.equal(engineAccess(false, 'task'), 'locked')
  assert.equal(engineAccess(true, 'busy'), 'busy')
  assert.equal(engineAccess(false, 'busy'), 'off')
})
