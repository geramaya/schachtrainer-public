import { test } from 'node:test'
import assert from 'node:assert/strict'
import { engineStatus, historyNotice, historyTarget } from '../src/ui/history.ts'

test('historyTarget: arrows step through the game, End or reaching the last ply returns to the live position (null)', () => {
  assert.equal(historyTarget('ArrowLeft', null, 6), 5)
  assert.equal(historyTarget('ArrowLeft', 0, 6), 0)
  assert.equal(historyTarget('ArrowRight', 5, 6), null)
  assert.equal(historyTarget('End', 2, 6), null)
  assert.equal(historyTarget('Home', null, 6), 0)
  assert.equal(historyTarget('ArrowRight', null, 6), null)
})

test('historyTarget: other keys, and the space bar (= keep playing), are not navigation', () => {
  assert.equal(historyTarget('a', 2, 6), undefined)
  assert.equal(historyTarget(' ', 2, 6), undefined)
})

test('historyNotice: nothing while live; the shown move and the way back; "Neuer Zug" when the game moved on', () => {
  assert.equal(historyNotice({ view: null, startPly: 0, fresh: true }), '')
  assert.equal(historyNotice({ view: 5, startPly: 0, fresh: false }), 'Ansicht Zug 3 – zurück zur Partie: Ende')
  assert.equal(historyNotice({ view: 4, startPly: 0, fresh: false }), 'Ansicht Zug 2… – zurück zur Partie: Ende')
  assert.equal(historyNotice({ view: 0, startPly: 0, fresh: false }), 'Ansicht Ausgangsstellung – zurück zur Partie: Ende')
  assert.equal(historyNotice({ view: 3, startPly: 0, fresh: true }), 'Ansicht Zug 2 – zurück zur Partie: Ende · Neuer Zug')
})

test('engineStatus: one word per state, held game wins', () => {
  const base = { phase: 'play' as const, thinking: false, judging: false, pending: false, myTurn: true }
  assert.deepEqual(engineStatus({ ...base, thinking: true, myTurn: false }), { kind: 'thinking', text: 'Stockfish denkt …' })
  assert.deepEqual(engineStatus({ ...base, judging: true }), { kind: 'thinking', text: 'Lehrer prüft deinen Zug …' })
  assert.deepEqual(engineStatus({ ...base, pending: true }), { kind: 'waiting', text: 'Stockfish wartet auf deine Antwort' })
  assert.deepEqual(engineStatus(base), { kind: 'ready', text: 'Du bist am Zug' })
  assert.deepEqual(engineStatus({ ...base, myTurn: false }), { kind: 'ready', text: 'Stockfish ist bereit' })
  assert.deepEqual(engineStatus({ ...base, phase: 'setup' }), { kind: 'off', text: 'Stockfish aus' })
  assert.deepEqual(engineStatus({ ...base, phase: 'over' }), { kind: 'off', text: 'Stockfish aus' })
})
