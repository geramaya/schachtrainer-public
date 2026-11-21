import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATEGORIES } from '../src/analysis/category.ts'

/** The colours of the move categories live in ONE place: the CSS variables --q-<category> in styles.css. */
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  assert.ok(m, `--${name} is missing in styles.css`)
  return m[1]!
}
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
const lum = (h: string) => { const [r, g, b] = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]; return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contrast = (a: string, b: string): number => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05) }
function hsl(h: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(h)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (d !== 0) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (hue * 60 + 360) % 360, s, l }
}

test('every category has a colour token, all different', () => {
  const colours = CATEGORIES.map((c) => token(`q-${c}`))
  assert.equal(new Set(colours.map((c) => c.toLowerCase())).size, CATEGORIES.length)
})

test('text contrast of every category colour is at least 4.5:1 on the dark panels (list, tooltip, analysis table)', () => {
  for (const c of CATEGORIES) for (const bg of ['bg', 'panel', 'panel-2']) {
    const ratio = contrast(token(`q-${c}`), token(bg))
    assert.ok(ratio >= 4.5, `${c} on --${bg}: ${ratio.toFixed(2)}`)
  }
})

test('good moves are blue, bad moves yellow, orange and red; the book is a muted grey-blue; no green', () => {
  for (const c of ['brilliant', 'great', 'best', 'excellent', 'good'] as const) {
    const { h } = hsl(token(`q-${c}`))
    assert.ok(h >= 190 && h <= 230, `${c} hue ${h.toFixed(0)}`)
  }
  const book = hsl(token('q-book'))
  assert.ok(book.h >= 190 && book.h <= 230 && book.s < 0.35, `book hue ${book.h.toFixed(0)} saturation ${book.s.toFixed(2)}`)
  const hue = (c: string) => hsl(token(`q-${c}`)).h
  assert.ok(hue('inaccuracy') >= 40 && hue('inaccuracy') <= 55, 'inaccuracy yellow')
  assert.ok(hue('mistake') >= 28 && hue('mistake') < 40, 'mistake orange')
  for (const c of ['miss', 'blunder']) assert.ok(hue(c) >= 340 || hue(c) <= 8, `${c} red`)
})

test('brilliant is the strongest blue, the quality blues get paler from best to good', () => {
  const sat = (c: string) => hsl(token(`q-${c}`))
  assert.ok(sat('brilliant').s >= sat('great').s - 1e-9)
  assert.ok(sat('best').l <= sat('excellent').l && sat('excellent').l <= sat('good').l)
})
