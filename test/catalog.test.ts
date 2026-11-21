import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATALOG, accentFor } from '../src/content/catalog.ts'

test('every opening has a unique code and its own service colour variable', () => {
  assert.deepEqual(CATALOG.map((c) => c.code), ['SCO', 'SMG', 'CK', 'BUD', 'KID', 'ITA', 'ALA', 'NIM', 'TAR', 'WIE'])
  assert.equal(new Set(CATALOG.map((c) => c.acc)).size, CATALOG.length)
  for (const c of CATALOG) assert.match(c.acc, /^var\(--op-[a-z]+\)$/)
})

test('accentFor falls back to the neutral colour for unknown openings', () => {
  assert.equal(accentFor('scotch'), 'var(--op-sco)')
  assert.equal(accentFor('nope'), 'var(--muted)')
})

test('the five systems of the document form the main stack, the five new ones the alternatives', () => {
  assert.deepEqual(CATALOG.filter((c) => c.group === 'main').map((c) => c.id), ['scotch', 'smith-morra', 'caro-kann', 'budapest', 'kings-indian'])
  assert.deepEqual(CATALOG.filter((c) => c.group === 'alt').map((c) => c.id), ['italian', 'alapin', 'nimzo-indian', 'tarrasch', 'vienna'])
})

/** WCAG contrast of a text colour on the page background (--bg). */
const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
test('retro palette: dark ink on every service colour reaches 4.5:1; as line or band the colour reaches 3:1 on the page and panel (design/2026-11-21-retro-palette.md)', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  const v = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1]!
  const ratio = (x: string, y: string) => { const [hi, lo] = [Math.max(lum(x), lum(y)), Math.min(lum(x), lum(y))]; return (hi + 0.05) / (lo + 0.05) }
  for (const c of CATALOG) {
    const acc = v(c.acc.slice(6, -1))
    assert.ok(ratio(acc, v('ink')) >= 4.5, `${c.code} ${acc}: ink text`)
    for (const bg of [v('bg'), v('panel')]) assert.ok(ratio(acc, bg) >= 3, `${c.code} ${acc} on ${bg}`)
  }
})
