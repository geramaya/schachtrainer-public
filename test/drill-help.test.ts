import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drillEngineLock, hintKeyApplies } from '../src/train/help.ts'

const ev = (key: string, over: Record<string, unknown> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'DIV', isContentEditable: false }, ...over })

test('H triggers the hint on the board, but not while typing or with modifiers', () => {
  assert.equal(hintKeyApplies(ev('h')), true)
  assert.equal(hintKeyApplies(ev('H')), true)
  assert.equal(hintKeyApplies(ev('x')), false)
  assert.equal(hintKeyApplies(ev('h', { target: { tagName: 'INPUT', isContentEditable: false } })), false)
  assert.equal(hintKeyApplies(ev('h', { target: { tagName: 'TEXTAREA', isContentEditable: false } })), false)
  assert.equal(hintKeyApplies(ev('h', { target: { tagName: 'SELECT', isContentEditable: false } })), false)
  assert.equal(hintKeyApplies(ev('h', { target: { tagName: 'DIV', isContentEditable: true } })), false)
  assert.equal(hintKeyApplies(ev('h', { ctrlKey: true })), false)
  assert.equal(hintKeyApplies(ev('h', { metaKey: true })), false)
  assert.equal(hintKeyApplies(ev('h', { altKey: true })), false)
})

test('engine stays locked during the task, also after a miss or a hint; only the shown solution lifts it', () => {
  assert.equal(drillEngineLock({ myTurn: true, solutionShown: false }), 'task')
  assert.equal(drillEngineLock({ myTurn: true, solutionShown: true }), null)
  assert.equal(drillEngineLock({ myTurn: false, solutionShown: false }), null)
})
