import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { checkAuthoredIntro } from '../tools/lib/intro-check.ts'
import { introFacts } from '../tools/lib/intro-facts.ts'
import type { FactSources } from '../tools/lib/intro-facts.ts'
import type { Variation } from '../src/content/types.ts'

const LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4']
/** white perspective after each ply: -20, 30, -25, +150, +130, +35 (the jump of +175 is 2… Sc6) */
const CPS = [20, 30, 25, 150, -130, 35]

function sheet(line: string[], side: 'white' | 'black', cps: number[] = []) {
  const g = new Chess()
  const analysis: FactSources['analysis'] = {}
  line.forEach((san, i) => { g.move(san); if (cps[i] !== undefined) analysis[`${g.fen()}|18|1`] = { lines: [{ cp: cps[i]!, mate: null }] } })
  const v: Variation = { id: 'v', name: 'V', nameEn: 'V', line, keyPositions: [], fromDocument: false }
  return introFacts({ id: 'scotch', side, entry: ['e4'], docRef: 'doc' }, v, { analysis, explorer: {} })
}
const check = (text: string, f = sheet(LINE, 'white', CPS), line = LINE) => checkAuthoredIntro({ text, belege: [] }, line, f, [])
const bad = (text: string, f?: ReturnType<typeof sheet>, line?: string[]) => assert.equal(check(text, f, line).length, 1, text)
const ok = (text: string, f?: ReturnType<typeof sheet>, line?: string[]) => assert.deepEqual(check(text, f, line), [], text)

test('shift to you: the named move must move the evaluation towards the repertoire side', () => {
  ok('Mit 2… Sc6 kippt die Bewertung deutlich zu dir.')
  bad('Mit 3… exd4 kippt die Bewertung zu dir.')
  bad('Mit 3. d4 kippt die Stellung deutlich zu deinen Gunsten.')
})

test('shift without a named move is compared with the critical move; for the black side the direction flips', () => {
  ok('Danach kippt die Stellung zu dir.')
  bad('Danach kippt die Stellung zu dir.', sheet(LINE, 'black', CPS))
  ok('Danach kippt die Stellung zu Weiß.')
})

test('state claims are read at the named move, in this wording: besser, schlechter, ausgeglichen, Vorteil für', () => {
  ok('Nach 2… Sc6 steht Schwarz schlechter.')
  bad('Nach 2… Sc6 steht Schwarz besser.')
  bad('Nach 2. Sf3 steht Weiß besser.')
  ok('Nach 2. Sf3 ist die Stellung ausgeglichen.')
  bad('Nach 2… Sc6 ist die Stellung ausgeglichen.')
  ok('Nach 2… Sc6 hast du klaren Vorteil für dich.')
})

test('state claims "am Ende" and "endet" are read at the final evaluation, with the thresholds 50 (plain), 100 (deutlich/klar), 20 (leicht)', () => {
  ok('Die Linie endet ausgeglichen.')
  bad('Am Ende steht Weiß deutlich besser.')
  ok('Am Ende steht Weiß leicht besser.')
  bad('Am Ende stehst du besser.')
})

test('material: counts and exchange are compared with the line, "Material ausgeglichen" with the settled count', () => {
  const line = ['e4', 'd5', 'exd5', 'Nf6']
  const f = sheet(line, 'white')
  ok('Am Ende hast du einen Bauern mehr.', f, line)
  bad('Am Ende hast du zwei Bauern mehr.', f, line)
  bad('Am Ende hast du einen Läufer mehr.', f, line)
  bad('Das Material ist ausgeglichen.', f, line)
  assert.equal(check('Am Ende hat Schwarz einen Bauern mehr.', f, line).length, 1)
})

test('material: a side that is a pawn up at the named move, not at the end', () => {
  const line = ['e4', 'd5', 'exd5', 'Nf6', 'c4', 'e6', 'dxe6', 'Bxe6']
  const f = sheet(line, 'white')
  ok('Nach 2… Sf6 hast du einen Bauern mehr.', f, line)
  ok('Nach 4… Lxe6 hast du einen Bauern mehr.', f, line)
  bad('Nach 3… e6 hast du einen Läufer mehr.', f, line)
})

test('the bishop pair belongs to the side that still has both bishops', () => {
  const line = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6']
  const f = sheet(line, 'white')
  bad('Weiß hat das Läuferpaar.', f, line)
  ok('Schwarz hat das Läuferpaar.', f, line)
  bad('Du hast das Läuferpaar.', f, line)
})

test('a list needs numbers and "und": "Läufer gegen Springer und einen Bauern mehr" claims only the pawn', () => {
  const line = ['e4', 'd5', 'exd5', 'Nf6']
  ok('Nach 2… Sf6 tauschst du den Läufer gegen den Springer und hast einen Bauern mehr.', sheet(line, 'white'), line)
})

test('a later clause without its own move may hold at any position after the earlier move, so "dafür einen Springer weniger" is still rejected when no position fits', () => {
  const line = ['e4', 'd5', 'exd5', 'Nf6']
  const problems = check('Nach 1… d5 spielt Schwarz Sf6, am Ende hast du einen Bauern mehr, dafür einen Springer weniger.', sheet(line, 'white'), line)
  assert.equal(problems.length, 1)
  assert.match(problems[0]!, /Springer weniger/)
})

test('a shift over two named moves is measured from before the first to after the last', () => {
  // 2. Sf3 (-25) 2… Sc6 (+150): "Bei 2. Sf3 Sc6 dreht die Bewertung zu dir" is +175 for white
  ok('Bei 2. Sf3 Sc6 dreht die Bewertung deutlich zu dir.')
  bad('Bei 2. Sf3 Sc6 dreht die Bewertung deutlich zu Schwarz.')
})

test('a claim that the line gives no evaluation for is rejected, not passed', () => {
  const line = ['e4', 'e5']
  bad('Nach 1… e5 steht Schwarz besser.', sheet(line, 'white'), line)
})

test('material and shift claims by an unknown wording are not checked (known list only)', () => {
  ok('Mit 2… Sc6 geht die Partie ganz anders weiter, das Material ändert sich stark.')
})

test('more known wordings: wechselt zu deinen Gunsten, wächst dein Vorteil, leicht zu deinen Gunsten, steht leicht besser/schlechter', () => {
  ok('Mit 2… Sc6 wechselt die Bewertung zu deinen Gunsten.')
  bad('Mit 3… exd4 wechselt die Bewertung zu deinen Gunsten.')
  ok('Mit 2… Sc6 wächst dein Vorteil.')
  bad('Mit 3… exd4 wächst dein Vorteil.')
  ok('Nach 2… Sc6 steht es leicht zu deinen Gunsten.')
  bad('Nach 2. Sf3 steht es leicht zu deinen Gunsten.')
  ok('Nach 3… exd4 steht Weiß leicht besser.')
  bad('Nach 3… exd4 steht Weiß leicht schlechter.')
  bad('Nach 2. Sf3 steht Weiß leicht besser.')
})
