import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isFlipKey, isHintKey, navTarget, shouldHandleKey } from '../src/ui/keys.ts'

const none = { alt: false, ctrl: false, meta: false, shift: false }

test('arrows work with a focused button, space does not (it activates the button)', () => {
  assert.equal(shouldHandleKey('ArrowLeft', 'BUTTON', false, none), true)
  assert.equal(shouldHandleKey('ArrowRight', 'BUTTON', false, none), true)
  assert.equal(shouldHandleKey(' ', 'BUTTON', false, none), false)
  assert.equal(shouldHandleKey(' ', 'DIV', false, none), true)
})

test('text fields and contenteditable keep all keys', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(shouldHandleKey('ArrowLeft', tag, false, none), false)
  assert.equal(shouldHandleKey('ArrowLeft', 'DIV', true, none), false)
})

test('modifiers and unrelated keys are ignored', () => {
  assert.equal(shouldHandleKey('ArrowLeft', 'DIV', false, { ...none, alt: true }), false)
  assert.equal(shouldHandleKey('a', 'DIV', false, none), false)
})

test('Home and End are board navigation keys, but not inside text fields or with modifiers', () => {
  assert.equal(shouldHandleKey('Home', 'DIV', false, none), true)
  assert.equal(shouldHandleKey('End', 'BUTTON', false, none), true)
  assert.equal(shouldHandleKey('Home', 'TEXTAREA', false, none), false)
  assert.equal(shouldHandleKey('End', 'DIV', false, { ...none, ctrl: true }), false)
})

test('navTarget maps keys to a ply inside 0..last', () => {
  assert.equal(navTarget('ArrowLeft', 5, 28), 4)
  assert.equal(navTarget('ArrowRight', 5, 28), 6)
  assert.equal(navTarget(' ', 5, 28), 6)
  assert.equal(navTarget('Home', 5, 28), 0)
  assert.equal(navTarget('End', 5, 28), 28)
  assert.equal(navTarget('ArrowLeft', 0, 28), 0)
  assert.equal(navTarget('ArrowRight', 28, 28), 28)
  assert.equal(navTarget('a', 5, 28), null)
})

test('H asks for a hint, but never while typing and never with modifiers', () => {
  assert.equal(isHintKey('h', 'BODY', false, none), true)
  assert.equal(isHintKey('H', 'BUTTON', false, none), true)
  assert.equal(isHintKey('h', 'INPUT', false, none), false)
  assert.equal(isHintKey('h', 'TEXTAREA', false, none), false)
  assert.equal(isHintKey('h', 'DIV', true, none), false)
  assert.equal(isHintKey('h', 'BODY', false, { ...none, ctrl: true }), false)
  assert.equal(isHintKey('x', 'BODY', false, none), false)
})

test('F flips the board, but never while typing and never with modifiers', () => {
  assert.equal(isFlipKey('f', 'BODY', false, none), true)
  assert.equal(isFlipKey('F', 'BUTTON', false, none), true)
  assert.equal(isFlipKey('f', 'TEXTAREA', false, none), false)
  assert.equal(isFlipKey('f', 'SELECT', false, none), false)
  assert.equal(isFlipKey('f', 'DIV', true, none), false)
  assert.equal(isFlipKey('f', 'BODY', false, { ...none, ctrl: true }), false)
  assert.equal(isFlipKey('h', 'BODY', false, none), false)
})
