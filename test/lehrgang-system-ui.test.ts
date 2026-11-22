import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseRoute, hrefLehrgangSystem, hrefLehrgangUeben } from '../src/router.ts'
import { astLabel, linieMitAst, pruefeRaetselZug } from '../src/lehrgang/system.ts'
import type { System } from '../src/lehrgang/types.ts'

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const z = (san: string, uci: string) => ({ san, uci, satz: 'x' })
const sys = {
  id: 'vorstoss', hauptlinie: {
    zuege: [z('e4', 'e2e4'), z('c6', 'c7c6'), z('d4', 'd2d4'), z('d5', 'd7d5'), z('e5', 'e4e5'), z('Bf5', 'c8f5'), z('Nf3', 'g1f3'), z('e6', 'e7e6')],
    aeste: [{ id: 'ast1', ab: 6, satz: 'x', anteil: 0.227, zuege: [z('Bd3', 'f1d3'), z('Bxd3', 'f5d3')] }],
  },
} as unknown as System

test('route: the system page and the practise page of a system line / model game of a system have their own addresses; the practise page can start in a mode', () => {
  assert.deepEqual(parseRoute(hrefLehrgangSystem('caro-kann', 'vorstoss')), { name: 'lehrgang-system', id: 'caro-kann', systemId: 'vorstoss' })
  assert.deepEqual(parseRoute(hrefLehrgangUeben('caro-kann', 's', 'vorstoss', 'gefuehrt')), { name: 'lehrgang-ueben', id: 'caro-kann', kind: 's', itemId: 'vorstoss', modus: 'gefuehrt' })
  assert.deepEqual(parseRoute(hrefLehrgangUeben('caro-kann', 'm', 'vorstoss/muster-1')), { name: 'lehrgang-ueben', id: 'caro-kann', kind: 'm', itemId: 'vorstoss/muster-1' })
  assert.deepEqual(parseRoute('#/lehrgang/caro-kann/v/abc'), { name: 'lehrgang-ueben', id: 'caro-kann', kind: 'v', itemId: 'abc' })
  assert.deepEqual(parseRoute('#/lehrgang/caro-kann/s/vorstoss/quatsch'), { name: 'notfound' })
})

test('line: the main line, or a branch = main line up to the deviation + the branch moves', () => {
  assert.equal(linieMitAst(sys, null).zuege.length, 8)
  const a = linieMitAst(sys, 'ast1')
  assert.deepEqual(a.zuege.map((x) => x.san), ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Bd3', 'Bxd3'])
  assert.equal(a.abzweig, 6)
  assert.equal(linieMitAst(sys, null).abzweig, -1)
  assert.equal(linieMitAst(sys, 'gibt-es-nicht').zuege.length, 8, 'unknown branch = main line')
})

test('branch label: move number, German move and the share in words', () => {
  assert.equal(astLabel(sys.hauptlinie.aeste[0]!), '4. Ld3 (etwa 2 von 10)')
  assert.equal(astLabel({ ...sys.hauptlinie.aeste[0]!, ab: 7, anteil: null, zuege: [z('Bxd3', 'f5d3')] }), '4… Lxd3')
})

test('puzzle step: the right move is accepted and the reply of the opponent is played by the page; a wrong move names the expected one; the last move finishes', () => {
  const l = ['d8a5', 'd1d2', 'a5b5']
  assert.deepEqual(pruefeRaetselZug(l, 0, 'd8a5'), { ok: true, antwort: 'd1d2', naechst: 2, fertig: false })
  assert.deepEqual(pruefeRaetselZug(l, 2, 'a5b5'), { ok: true, antwort: null, naechst: 3, fertig: true })
  assert.deepEqual(pruefeRaetselZug(l, 0, 'a7a6'), { ok: false, erwartet: 'd8a5' })
  assert.deepEqual(pruefeRaetselZug(['e5f3'], 0, 'e5f3'), { ok: true, antwort: null, naechst: 1, fertig: true })
})

test('system page: layout A with the teacher card, the five steps as tabs, no audio; the Lehrgang page offers the system above the learning path; the practise page knows system lines and model games of systems', () => {
  const v = src('views/LehrgangSystem.vue')
  assert.match(v, /<BoardLayout>/)
  assert.match(v, /<ModeTabs\b/)
  assert.match(v, /<TeacherCard\b/)
  for (const step of ['Idee', 'Hauptlinie', 'Motive', 'Musterpartien', 'Üben']) assert.match(v, new RegExp(`label: '${step}'`))
  assert.doesNotMatch(v, /:audio="true"|SatzAudio/)
  const l = src('views/Lehrgang.vue')
  assert.ok(l.indexOf('aria-label="System"') > 0 && l.indexOf('aria-label="System"') < l.indexOf('aria-label="Lernpfad"'), 'system section before Lernpfad')
  assert.match(src('views/LehrgangUeben.vue'), /kind === 's'/)
  assert.match(src('App.vue').split('\n').find((x) => x.startsWith('const wide'))!, /'lehrgang-system'/)
})
