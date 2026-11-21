import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engineStatus } from '../src/ui/history.ts'
import { loadingText } from '../src/maia/status-text.ts'

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
