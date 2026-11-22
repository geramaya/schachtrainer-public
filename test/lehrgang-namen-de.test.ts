import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLehrgaenge } from '../tools/lib/lehrgang-build.ts'
import { ladeEco } from '../tools/lib/lehrgang-namen.ts'

const ECO = new URL('../public/eco/eco.json', import.meta.url).pathname
const ROOT = new URL('../content-src/lehrgaenge/', import.meta.url).pathname
const PREFIX: Record<string, string> = { scotch: 'Schott', italian: 'Italienische Partie', 'caro-kann': 'Caro-Kann' }
const ENGLISH = /\b(Game|Defense|Defence|Variation|Attack|Gambit|Declined|Counterattack|Opening)\b/

test('Variantennamen: every derived name starts with the German opening of its Lehrgang and has no English generic word left', () => {
  const eco = ladeEco(ECO)
  assert.ok(eco, 'public/eco/eco.json fehlt (npm run eco)')
  const { lehrgaenge } = buildLehrgaenge(ROOT, { eco })
  const names = lehrgaenge.flatMap((l) => l.varianten.map((v) => ({ id: l.id, name: v.name })))
  assert.ok(names.length > 30)
  for (const { id, name } of names) {
    // the plain "-Gambit"/"-Angriff" German compounds are fine; English words standing alone are not
    assert.ok(name.startsWith(PREFIX[id]!), `${id}: "${name}" beginnt nicht mit ${PREFIX[id]}`)
    assert.ok(!ENGLISH.test(name.replace(/-(Gambit|Angriff)/g, '')), `${id}: "${name}" enthält englische Gattungswörter`)
  }
})
