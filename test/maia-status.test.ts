import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engineStatus } from '../src/ui/history.ts'
import { loadingText, maiaStatusMode, READY_SHOWN_MS } from '../src/maia/status-text.ts'

const base = { phase: 'play' as const, thinking: false, judging: false, pending: false, myTurn: false }

test('engineStatus names the opponent: Maia while it loads, thinks, waits or is ready', () => {
  assert.deepEqual(engineStatus({ ...base, opponent: 'maia', maiaLoading: true, thinking: true }), { kind: 'thinking', text: 'Maia lädt …' })
  assert.deepEqual(engineStatus({ ...base, opponent: 'maia', thinking: true }), { kind: 'thinking', text: 'Maia denkt …' })
  assert.deepEqual(engineStatus({ ...base, opponent: 'maia', pending: true }), { kind: 'waiting', text: 'Maia wartet auf deine Antwort' })
  assert.deepEqual(engineStatus({ ...base, opponent: 'maia' }), { kind: 'ready', text: 'Maia ist bereit' })
  assert.deepEqual(engineStatus({ ...base, thinking: true }), { kind: 'thinking', text: 'Stockfish denkt …' })
})

test('loadingText: MB with percent while downloading, then the check, ready, and the error with the fallback hint', () => {
  assert.equal(loadingText({ state: 'loading', phase: 'download', loaded: 34_000_000, total: 93_246_338 }), 'Maia wird geladen … 34 von 93 MB (36 %)')
  assert.equal(loadingText({ state: 'loading', phase: 'verify', loaded: 93_246_338, total: 93_246_338 }), 'Modell wird geprüft …')
  assert.equal(loadingText({ state: 'ready' }), 'Maia bereit')
  assert.equal(loadingText({ state: 'idle' }), 'Maia lädt beim Start (93 MB, einmalig).')
  assert.equal(loadingText({ state: 'error', message: 'x' }), 'Maia konnte nicht geladen werden. Stockfish spielt stattdessen.')
})

test('maiaStatusMode: full block only while loading, checking or failed; ready is one short line, then gone', () => {
  const loading = { state: 'loading', phase: 'download', loaded: 1, total: 2 } as const
  assert.equal(maiaStatusMode(loading, { setup: false, readyShownMs: 0 }), 'full')
  assert.equal(maiaStatusMode({ state: 'error', message: 'x' }, { setup: false, readyShownMs: 99_999 }), 'full')
  assert.equal(maiaStatusMode({ state: 'ready' }, { setup: false, readyShownMs: 0 }), 'line')
  assert.equal(maiaStatusMode({ state: 'ready' }, { setup: false, readyShownMs: READY_SHOWN_MS - 1 }), 'line')
  assert.equal(maiaStatusMode({ state: 'ready' }, { setup: false, readyShownMs: READY_SHOWN_MS }), 'none')
  assert.equal(maiaStatusMode({ state: 'ready' }, { setup: true, readyShownMs: READY_SHOWN_MS }), 'none')
})

test('maiaStatusMode: the "preload" offer (idle) exists only in the setup, never during or after a game', () => {
  assert.equal(maiaStatusMode({ state: 'idle' }, { setup: true, readyShownMs: 0 }), 'full')
  assert.equal(maiaStatusMode({ state: 'idle' }, { setup: false, readyShownMs: 0 }), 'none')
})
