import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

test('the practise page is a full-width board page (main.wide) like Lernen/Spielen: App.vue lists lehrgang-ueben in `wide`, without waiting for the bundle', () => {
  const wide = src('App.vue').split('\n').find((l) => l.startsWith('const wide'))!
  assert.match(wide, /'lehrgang-ueben'/)
})

test('the practise page uses layout A (BoardLayout) and the app tab style (ModeTabs) for the three steps, not bare buttons', () => {
  const v = src('views/LehrgangUeben.vue')
  assert.match(v, /<BoardLayout>/)
  assert.match(v, /<ModeTabs\b/)
  assert.doesNotMatch(v, /class="modes"/)
})

test('the practise page speaks through the teacher card (chosen teacher remembered like in the game), shows the goal box and the model game step, and keeps reading aloud optional', () => {
  const v = src('views/LehrgangUeben.vue')
  assert.match(v, /<TeacherCard\b/)
  assert.match(v, /teacherOf\(progress\.value\.settings\)/)
  assert.match(v, /lehrgangGefuehl\(/)
  assert.match(v, /Ziel dieser Variante/)
  assert.match(v, /kind === 'm'/)
  assert.match(v, /const vorlesen = ref\(readStored\(\)\)/)
  assert.match(src('views/Lehrgang.vue'), /Musterpartie/)
})

test('the teacher card in a Lehrgang has no quip switches (plain), the game cards keep them', () => {
  assert.match(src('ui/TeacherHead.vue'), /plain/)
  assert.match(src('ui/TeacherCard.vue'), /:plain="plain"/)
})
