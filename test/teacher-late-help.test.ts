import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lateHelp } from '../src/teacher/late-help.ts'
import type { Judgement } from '../src/teacher/judge.ts'

const j = (rating: Judgement['rating']): Judgement => ({ rating, lossCp: 60, facts: [], text: 't', reveal: 'Besser war e4.', bestWhy: null, betterUci: 'e2e4', betterSan: 'e4' })

test('an inaccurate move, a mistake or a blunder offers the better move on request ("Warum? Besseren Zug zeigen")', () => {
  for (const r of ['ungenau', 'fehler', 'patzer'] as const) assert.deepEqual(lateHelp(null, { kind: 'judged', j: j(r) }), { reveal: 'Besser war e4.', uci: 'e2e4', shown: false }, r)
})

test('good verdicts offer nothing', () => {
  for (const r of ['best', 'excellent', 'gut'] as const) assert.equal(lateHelp(null, { kind: 'judged', j: j(r) }), null)
})

test('the offer stays until the player moves again, whatever the engine or the repertoire says in between', () => {
  const offer = lateHelp(null, { kind: 'judged', j: j('ungenau') })
  assert.deepEqual(lateHelp(offer, { kind: 'show' }), { reveal: 'Besser war e4.', uci: 'e2e4', shown: true })
  assert.equal(lateHelp(lateHelp(offer, { kind: 'show' }), { kind: 'moved' }), null)
})

test('show without an offer stays empty; a new game clears it', () => {
  assert.equal(lateHelp(null, { kind: 'show' }), null)
  assert.equal(lateHelp({ reveal: 'x', uci: 'e2e4', shown: true }, { kind: 'reset' }), null)
})
