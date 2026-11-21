import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampWidth, defaultWidth, keyboardWidth, parseStored, resolveWidths, boardAreaWidth } from '../src/ui/splitWidths.ts'

test('default widths at 1440 wide leave the board more room than a 900 high viewport lets it use', () => {
  const area = boardAreaWidth(1440, defaultWidth('left', 1440), defaultWidth('right', 1440))
  assert.ok(area >= 900 - 48 - 40 - 12 - 44 - 8 + 22, `board area ${area} must not be the limit at 1440x900`)
})

test('default widths follow the viewport inside the old clamp ranges', () => {
  assert.equal(defaultWidth('left', 1440), 310)
  assert.equal(defaultWidth('right', 1440), 290)
  assert.equal(defaultWidth('left', 3000), 440)
  assert.equal(defaultWidth('right', 3000), 420)
  assert.equal(defaultWidth('left', 1200), 300)
  assert.equal(defaultWidth('right', 1200), 290)
})

test('clampWidth keeps the own minimum and maximum', () => {
  assert.equal(clampWidth('left', 100, 300, 1920), 260)
  assert.equal(clampWidth('left', 900, 300, 1920), 640)
  assert.equal(clampWidth('right', 100, 300, 1920), 240)
  assert.equal(clampWidth('right', 900, 300, 1920), 560)
})

test('clampWidth leaves the board at least its minimum width', () => {
  // 1280 - 2*12 padding - 2*20 handles = 1216 for the three; right column 300, middle >= 380 -> left <= 536
  assert.equal(clampWidth('left', 640, 300, 1280), 536)
  assert.equal(boardAreaWidth(1280, 536, 300), 380)
})

test('resolveWidths uses defaults for unset sides and clamps stored ones to the viewport', () => {
  assert.deepEqual(resolveWidths({ left: null, right: null }, 1440), { left: 310, right: 290 })
  assert.deepEqual(resolveWidths({ left: 400, right: null }, 1440), { left: 400, right: 290 })
  const r = resolveWidths({ left: 640, right: 560 }, 1280)
  assert.ok(boardAreaWidth(1280, r.left, r.right) >= 380, 'board keeps its minimum')
  assert.ok(r.left >= 260 && r.right >= 240)
})

test('keyboardWidth widens toward the board side and ignores other keys', () => {
  assert.equal(keyboardWidth('left', 400, 'ArrowRight'), 416)
  assert.equal(keyboardWidth('left', 400, 'ArrowLeft'), 384)
  assert.equal(keyboardWidth('right', 400, 'ArrowLeft'), 416)
  assert.equal(keyboardWidth('right', 400, 'ArrowRight'), 384)
  assert.equal(keyboardWidth('left', 400, 'Enter'), null)
})

test('parseStored accepts valid numbers and falls back to null for anything else', () => {
  assert.deepEqual(parseStored('{"left":420,"right":310}'), { left: 420, right: 310 })
  assert.deepEqual(parseStored('{"left":"x","right":null}'), { left: null, right: null })
  assert.deepEqual(parseStored('not json'), { left: null, right: null })
  assert.deepEqual(parseStored(null), { left: null, right: null })
})

test('with a known viewport height the left default takes the width a height-limited board leaves over', () => {
  // 1920x1080: board 1080-152 = 928, middle column 950, right 384 -> left = 1920 - 64 - 384 - 950
  assert.equal(defaultWidth('left', 1920, 1080), 522)
  assert.equal(defaultWidth('left', 1440, 900), 316)
  assert.equal(defaultWidth('left', 1920, 2000), 413, 'a tall window leaves nothing over: the plain default stays')
  assert.deepEqual(resolveWidths({ left: null, right: null }, 1920, 1080), { left: 522, right: 384 })
})
