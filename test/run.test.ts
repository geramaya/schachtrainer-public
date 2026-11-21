import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newRun, answerCard, runResult, answerHelped, noteHint, noteSolution, canSkip, skipCard, nextSkipped } from '../src/train/run.ts'

test('a new run is empty with no streak', () => {
  assert.deepEqual(newRun(), { cells: [], streak: 0, best: 0, hints: 0, solutions: 0, skipped: [], queue: [] })
})

test('a first-try answer adds a green cell and raises the streak', () => {
  const r = answerCard(answerCard(newRun(), true), true)
  assert.deepEqual(r.cells, ['ok', 'ok'])
  assert.equal(r.streak, 2)
  assert.equal(r.best, 2)
})

test('a miss adds a red cell, resets the streak but keeps the best', () => {
  const r = answerCard(answerCard(answerCard(newRun(), true), true), false)
  assert.deepEqual(r.cells, ['ok', 'ok', 'miss'])
  assert.equal(r.streak, 0)
  assert.equal(r.best, 2)
})

test('runResult counts first-try answers and passes at 80 percent', () => {
  let r = newRun()
  for (const ok of [true, true, true, true, false]) r = answerCard(r, ok)
  assert.deepEqual(runResult(r), { total: 5, firstTry: 4, retry: 1, passed: true, hints: 0, solutions: 0, skipped: 0 })
  r = answerCard(r, false)
  assert.deepEqual(runResult(r), { total: 6, firstTry: 4, retry: 2, passed: false, hints: 0, solutions: 0, skipped: 0 })
  assert.deepEqual(runResult(newRun()), { total: 0, firstTry: 0, retry: 0, passed: false, hints: 0, solutions: 0, skipped: 0 })
})

test('an answer with a hint adds a help cell, is not first try and ends the streak', () => {
  const r = answerHelped(answerCard(newRun(), true))
  assert.deepEqual(r.cells, ['ok', 'help'])
  assert.equal(r.streak, 0)
  assert.equal(runResult(r).firstTry, 1)
  assert.equal(runResult(r).retry, 1)
})

test('hints, solutions and skips are counted for the run summary', () => {
  let r = noteHint(noteHint(newRun()))
  r = noteSolution(r)
  r = skipCard(r, 'k1')
  assert.deepEqual(runResult(r), { total: 0, firstTry: 0, retry: 0, passed: false, hints: 2, solutions: 1, skipped: 1 })
})

test('a card can be skipped once per run; skipped cards come back in order at the end', () => {
  let r = newRun()
  assert.equal(canSkip(r, 'a'), true)
  r = skipCard(skipCard(r, 'a'), 'b')
  assert.equal(canSkip(r, 'a'), false)
  assert.equal(canSkip(r, 'c'), true)
  let n = nextSkipped(r)
  assert.equal(n.key, 'a')
  n = nextSkipped(n.run)
  assert.equal(n.key, 'b')
  n = nextSkipped(n.run)
  assert.equal(n.key, null)
  assert.equal(canSkip(n.run, 'a'), false) // answered in the catch-up round, never skipped again
})
