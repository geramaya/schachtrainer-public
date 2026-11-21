import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveRows } from '../src/chess/moveText.ts'
import { scrollTopToShow } from '../src/ui/scrollIntoBox.ts'

test('moveRows puts one move number with white and black on each row and keeps the ply index', () => {
  assert.deepEqual(moveRows(['e4', 'e5', 'Nf3']), [
    { number: 1, white: { san: 'e4', index: 1 }, black: { san: 'e5', index: 2 } },
    { number: 2, white: { san: 'Sf3', index: 3 } },
  ])
})

test('moveRows starts a row without white when black moves first', () => {
  assert.deepEqual(moveRows(['e5', 'Nf3', 'Nc6'], 1), [
    { number: 1, black: { san: 'e5', index: 1 } },
    { number: 2, white: { san: 'Sf3', index: 2 }, black: { san: 'Sc6', index: 3 } },
  ])
  assert.equal(moveRows(['Nc6'], 9)[0]!.number, 5)
})

test('moveRows of an empty line is empty', () => {
  assert.deepEqual(moveRows([]), [])
})

test('scrollTopToShow leaves the scroll position when the element is fully visible', () => {
  assert.equal(scrollTopToShow({ scrollTop: 100, height: 200 }, { top: 150, height: 20 }), 100)
})

test('scrollTopToShow scrolls down just far enough for an element below the box', () => {
  assert.equal(scrollTopToShow({ scrollTop: 0, height: 100 }, { top: 130, height: 20 }), 50)
})

test('scrollTopToShow scrolls up to an element above the box', () => {
  assert.equal(scrollTopToShow({ scrollTop: 300, height: 100 }, { top: 280, height: 20 }), 280)
})
