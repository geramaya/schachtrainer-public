import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDuration, restSeconds, trainingSummary, trainingBubble } from '../src/train/training-result.ts'
import { TASK_SECONDS } from '../src/train/plan.ts'
import type { PlanTask } from '../src/train/plan.ts'

const tasks: PlanTask[] = [{ kind: 'card', id: 'a', source: 'repertoire' }, { kind: 'card', id: 'b', source: 'repertoire' }, { kind: 'puzzle', id: 'p' }, { kind: 'deviation', id: 'd' }]

test('rest time is the estimate of the tasks that are still to do', () => {
  assert.equal(restSeconds(tasks, 0), 2 * TASK_SECONDS.card + TASK_SECONDS.puzzle + TASK_SECONDS.deviation)
  assert.equal(restSeconds(tasks, 2), 150)
  assert.equal(restSeconds(tasks, 4), 0)
})

test('durations as m:ss', () => {
  assert.equal(formatDuration(580), '9:40')
  assert.equal(formatDuration(5), '0:05')
  assert.equal(formatDuration(600), '10:00')
  assert.equal(formatDuration(-3), '0:00')
})

test('summary names cards and the offered tasks only, with singular and plural; the time is its own value', () => {
  const all = { puzzlesOffered: 1, deviationsOffered: 1 }
  assert.equal(trainingSummary({ cards: 8, puzzlesSolved: 1, deviationsPunished: 1, ...all }), '8 Karten, 1 Rätsel gelöst, 1 Abweichung bestraft')
  assert.equal(trainingSummary({ cards: 1, puzzlesSolved: 0, deviationsPunished: 0, ...all }), '1 Karte, 0 Rätsel gelöst, 0 Abweichungen bestraft')
  assert.equal(trainingSummary({ cards: 3, puzzlesSolved: 0, deviationsPunished: 0, puzzlesOffered: 0, deviationsOffered: 0 }), '3 Karten')
  assert.equal(trainingSummary({ cards: 5, puzzlesSolved: 1, deviationsPunished: 0, puzzlesOffered: 1, deviationsOffered: 0 }), '5 Karten, 1 Rätsel gelöst')
  assert.equal(formatDuration(61), '1:01')
})

test('Ferro cheers when most cards were right at the first try and stays dry otherwise', () => {
  const good = trainingBubble({ cards: 10, firstTry: 9, puzzlesSolved: 1, deviationsPunished: 1 })
  const bad = trainingBubble({ cards: 10, firstTry: 3, puzzlesSolved: 0, deviationsPunished: 0 })
  assert.notEqual(good.text, bad.text)
  assert.equal(good.pose, 'h3')
  assert.equal(bad.pose, 'h1')
  for (const t of [good.text, bad.text]) assert.ok(t.length <= 90, t)
})
