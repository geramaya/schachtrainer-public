import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasEngine, systemEngineTask, uebenEngineTask, engineLockFor } from '../src/lehrgang/engine.ts'
import { loadLehrgangSettings, saveLehrgangSettings, LEHRGANG_ENGINE_KEY } from '../src/lehrgang/engine.ts'
import { DEFAULT_SETTINGS, loadSettings } from '../src/coach/cevalSettings.ts'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, m } }

test('engine only appears for the system prototype: system page, its main line and its model games', () => {
  assert.equal(hasEngine('s', 'vorstoss'), true)
  assert.equal(hasEngine('m', 'vorstoss/p1'), true)
  assert.equal(hasEngine('m', 'p1'), false)
  assert.equal(hasEngine('v', 'x'), false)
  assert.equal(hasEngine('f', 'x'), false)
})

test('system page: only an unsolved puzzle locks the engine', () => {
  assert.equal(systemEngineTask('motive', true), true)
  assert.equal(systemEngineTask('motive', false), false)
  for (const s of ['idee', 'hauptlinie', 'muster', 'ueben'] as const) assert.equal(systemEngineTask(s, true), false)
})

test('ueben: Vorfuehren is free, Nachspielen/Kopf locked on own turn until the move, free when solved', () => {
  const base = { myTurn: true, solved: false }
  assert.equal(uebenEngineTask({ ...base, modus: 'vorfuehren' }), false)
  assert.equal(uebenEngineTask({ ...base, modus: 'gefuehrt' }), true)
  assert.equal(uebenEngineTask({ ...base, modus: 'kopf' }), true)
  assert.equal(uebenEngineTask({ ...base, modus: 'kopf', myTurn: false }), false)
  assert.equal(uebenEngineTask({ ...base, modus: 'kopf', solved: true }), false)
})

test('unlocking lifts a task lock, a free state stays free', () => {
  assert.equal(engineLockFor(true, false), 'task')
  assert.equal(engineLockFor(true, true), null)
  assert.equal(engineLockFor(false, false), null)
})

test('Lehrgang settings: own key, default off, independent of the app setting', () => {
  const s = mem()
  assert.equal(loadLehrgangSettings(s).enabled, false)
  saveLehrgangSettings({ ...loadLehrgangSettings(s), enabled: true, multipv: 2 }, s)
  assert.ok(s.m.has(LEHRGANG_ENGINE_KEY))
  assert.notEqual(LEHRGANG_ENGINE_KEY as string, 'schachtrainer.engine')
  assert.equal(loadLehrgangSettings(s).enabled, true)
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS)
})

import { readFileSync } from 'node:fs'
import { flipKey, lehrgangOrientation } from '../src/lehrgang/board.ts'

test('orientation: starts with the side of the Lehrgang, then only the remembered choice of the user counts', () => {
  assert.equal(lehrgangOrientation(null, 'black'), 'black')
  assert.equal(lehrgangOrientation(null, 'white'), 'white')
  assert.equal(lehrgangOrientation('white', 'black'), 'white')
  assert.equal(lehrgangOrientation('black', 'white'), 'black')
  assert.equal(flipKey('caro-kann'), 'lehrgang:caro-kann')
})

test('system views never derive the board side from the position (cause of the jumping board: puzzle FEN, side to move)', () => {
  for (const f of ['LehrgangSystem.vue', 'LehrgangUeben.vue']) {
    const s = readFileSync(new URL(`../src/views/${f}`, import.meta.url), 'utf8')
    if (f === 'LehrgangSystem.vue') assert.doesNotMatch(s, /split\(' '\)\[1\]/)
    assert.match(s, /lehrgangOrientation\(/)
    assert.match(s, /isFlipKey\(/)
  }
})
