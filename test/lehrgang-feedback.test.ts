import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missFeedback } from '../src/lehrgang/feedback.ts'
import { TODO } from '../src/lehrgang/types.ts'

const expected = { san: 'Nf3', uci: 'g1f3', satz: 'Der Springer greift e5 an.' }
const played = { san: 'd4', uci: 'd2d4' }

test('Nachspielen: names the wrong move in German notation, marks start and target square, points to the hint key and does not give the answer away', () => {
  const f = missFeedback({ modus: 'gefuehrt', expected, played, attempts: 1, solutionShown: false })
  assert.equal(f.meldung, 'd4 ist hier nicht dein Zug.')
  assert.equal(f.tipp, 'Tipp: H für einen Hinweis')
  assert.deepEqual(f.felder, ['d2', 'd4'])
  assert.equal(f.richtig, null)
  assert.equal(f.pfeil, null)
  const n = missFeedback({ modus: 'gefuehrt', expected, played: { san: 'Nc3', uci: 'b1c3' }, attempts: 3, solutionShown: false })
  assert.equal(n.meldung, 'Sc3 ist hier nicht dein Zug.')
  assert.equal(n.richtig, null)
})

test('Aus dem Kopf: the first miss keeps the answer back; from the 2nd miss or on "Lösung zeigen" the right move, the sentence and a green arrow appear', () => {
  const first = missFeedback({ modus: 'kopf', expected, played, attempts: 1, solutionShown: false })
  assert.equal(first.tipp, null)
  assert.equal(first.richtig, null)
  assert.equal(first.pfeil, null)
  for (const f of [missFeedback({ modus: 'kopf', expected, played, attempts: 2, solutionShown: false }), missFeedback({ modus: 'kopf', expected, played, attempts: 1, solutionShown: true })]) {
    assert.equal(f.richtig, 'Richtig war Sf3')
    assert.equal(f.satz, 'Der Springer greift e5 an.')
    assert.equal(f.pfeil, 'g1f3')
  }
})

test('an unwritten sentence (TODO) is never shown as text', () => {
  const f = missFeedback({ modus: 'kopf', expected: { ...expected, satz: TODO }, played, attempts: 2, solutionShown: false })
  assert.equal(f.richtig, 'Richtig war Sf3')
  assert.equal(f.satz, null)
})

test('Falle: like Aus dem Kopf, the solution follows after the 2nd miss', () => {
  assert.equal(missFeedback({ modus: 'falle', expected, played, attempts: 1, solutionShown: false }).richtig, null)
  assert.equal(missFeedback({ modus: 'falle', expected, played, attempts: 2, solutionShown: false }).richtig, 'Richtig war Sf3')
})
