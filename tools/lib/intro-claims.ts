import { Chess } from 'chess.js'
import { toGermanSan } from '../../src/chess/notation.ts'
import { NAMES, bilanzText, count, settle } from './intro-facts.ts'
import type { Counts, IntroFacts } from './intro-facts.ts'

/**
 * Direction and material statements of an intro text, checked against the fact sheet ("known wordings" only: what is not
 * in this list is not checked, see content-src/intros/README.md).
 *  - evaluation, state ("steht Schwarz schlechter", "du stehst besser", "ausgeglichen"): value after the named move, else at the end
 *  - evaluation, shift ("kippt zu dir", "verliert Weiß seinen Vorteil"): jump caused by the named move, else the critical move
 *  - material ("einen Bauern mehr", "Läufer weniger", "Qualität mehr", "Material ausgeglichen", "Läuferpaar"): count after the
 *    named move, else at the end; accepted when the strict count or the count after the pending recaptures matches
 */

/** Thresholds in centipawns, direction of the claim as seen from the repertoire side. */
export const CLAIM_CP = { weak: 20, plain: 50, strong: 100, equal: 50 } as const

const SAN = /^(?:O-O(?:-O)?|[KDTLS]?[a-h]?[1-8]?x?[a-h][1-8](?:=[DTLS])?)[+#]?$/
const NUMBER = /^(\d+)(\.\.\.|…|\.)$/
const ADV = '(?:klar(?:en?)?|deutlich(?:en?)?|stark|leicht(?:em?)?|etwas|kurz|knapp|klein(?:en?)?)'
const STRONG = /klar|deutlich|stark/
const WEAK = /leicht|etwas|kurz|knapp|klein/

interface Ref { start: number; end: number; first: number; ply: number }
type Sign = 1 | -1

/** Move fragments with a move number ("7… Sc3", "1. e4 e5 2. Sf3"), with the 0-based ply of their last move; only those that are on the line. */
function refsOf(text: string, line: string[]): Ref[] {
  const german = line.map(toGermanSan)
  const tokens = [...text.matchAll(/\S+/g)].map((m) => ({ raw: m[0], at: m.index!, w: m[0].replace(/^\(/, '').replace(/[.,;:!?)]+$/, '') }))
  const out: Ref[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    const n = NUMBER.exec(/^\d+\.$/.test(t.raw.replace(/^\(/, '')) ? t.raw.replace(/^\(/, '') : t.w)
    if (!n) continue
    const first = (Number(n[1]) - 1) * 2 + (n[2] === '.' ? 0 : 1)
    let ply = first - 1
    let end = t.at + t.raw.length
    let j = i + 1
    for (; j < tokens.length; j++) {
      const u = tokens[j]!
      const num = NUMBER.exec(u.w)
      if (num) continue
      if (!SAN.test(u.w) || german[ply + 1] !== u.w) break
      ply++
      end = u.at + u.raw.length
    }
    if (ply >= first) out.push({ start: t.at, end, first, ply })
    i = j - 1
  }
  return out
}

function clausesOf(sentence: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = []
  let from = 0
  for (const m of sentence.matchAll(/[,;:]\s+/g)) {
    out.push({ text: sentence.slice(from, m.index), start: from, end: m.index! })
    from = m.index! + m[0].length
  }
  out.push({ text: sentence.slice(from), start: from, end: sentence.length })
  return out
}

const NUMBERS: Record<string, number> = { ein: 1, eine: 1, einen: 1, eines: 1, zwei: 2, drei: 3, vier: 4, fünf: 5 }
const TYPES: [RegExp, keyof Counts][] = [[/^Bauer/, 'p'], [/^Läufer/, 'b'], [/^Springer/, 'n'], [/^Türme?$|^Turm/, 'r'], [/^Dame/, 'q']]

export function checkClaims(text: string, line: string[], f: IntroFacts, splitSentences: (t: string) => string[]): string[] {
  const own: Sign = f.seite === 'white' ? 1 : -1
  const cp = f.bewertung.entlangLinie.map((p) => p.cpWeiss)
  const problems: string[] = []
  const sideSign = (raw: string): Sign | null => { const name = raw.replace(/^D/, 'd'); return (/^(du|dir|dich|dein\w*)$/.test(name) ? own : /^dein Gegner$/.test(name) ? (-own as Sign) : name === 'Weiß' ? 1 : name === 'Schwarz' ? -1 : null) }
  const fmt = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${(Math.abs(c) / 100).toFixed(2).replace('.', ',')}`

  const stateAt = (ply: number | null): { at: number; c: number | null } => {
    if (ply !== null) return { at: ply, c: cp[ply] ?? null }
    const e = f.bewertung.endbewertung
    return { at: e?.ply ?? line.length - 1, c: e?.cpWeiss ?? null }
  }
  const need = (adv: string) => (STRONG.test(adv) ? CLAIM_CP.strong : WEAK.test(adv) ? CLAIM_CP.weak : CLAIM_CP.plain)

  function material(ply: number | null) {
    const upTo = ply === null ? line.length : ply + 1
    const strict = new Chess(); line.slice(0, upTo).forEach((san) => strict.move(san))
    const s = settle(line.slice(0, upTo)).board
    return [strict, s].map((g) => ({ w: count(g, 'w'), b: count(g, 'b') }))
  }

  for (const sentence of splitSentences(text)) {
    const refs = refsOf(sentence, line)
    for (const cl of clausesOf(sentence)) {
      const t = cl.text
      const ref = [...refs].reverse().find((r) => r.start < cl.end)
      const ownRef = refs.some((r) => r.start >= cl.start && r.start < cl.end)
      const atEnd: boolean = /\bEnde\b|\bendet\b|\bam Schluss\b/.test(t)
      const ply = atEnd || !ref ? null : ref.ply
      const where = ply === null ? 'am Ende der Linie' : `nach ${refText(ply)}`
      const fail = (why: string) => problems.push(`"${t.trim()}": ${why}`)
      function refText(p: number) { return `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'} ${toGermanSan(line[p]!)}` }

      // ---- evaluation, shift
      const target = [...t.matchAll(/zu (dir|deinen Gunsten|deinem Vorteil|Weiß|Schwarz)|für (dich|Weiß|Schwarz)/g)].at(-1)
      const shiftTo = (() => {
        if (/\b(kippt|dreht|springt|wächst|wechselt|wandert|schlägt|hebt|verschiebt|bringt)\b/.test(t) && target) return sideSign(['deinen Gunsten', 'deinem Vorteil', 'dir'].includes(target[1] ?? '') ? 'du' : (target[1] ?? target[2]!.replace('dich', 'du')))
        const grows = /\bwächst (dein|der (weiße|schwarze)) Vorteil/.exec(t)
        if (grows) return grows[1] === 'dein' ? own : grows[2] === 'weiße' ? 1 : -1
        const falls = /\b(?:sinkt|schwindet|verschwindet)\b.*?\b(dein|(?:der )?(?:\w+ )?(weiße|schwarze))\w* Vorteil/.exec(t)
        if (falls) return (falls[1]!.startsWith('dein') ? -own : falls[2] === 'weiße' ? -1 : 1) as Sign
        const loses = /\bverliert (Weiß|Schwarz|du) (?:seinen|den|deinen) (?:kleinen )?Vorteil/.exec(t)
        if (loses) return (-(sideSign(loses[1]!) ?? 1) as Sign)
        return null
      })()
      const fading = /\b(?:sinkt|schwindet|verschwindet|verliert)\b/.test(t)
      if (shiftTo) {
        const adv = ' ' + ([...t.matchAll(new RegExp(ADV, 'g'))].at(-1)?.[0] ?? '') + (fading ? ' leicht' : '')
        const [a, b] = ply === null ? [f.bewertung.kritischerZug?.vonCp ?? null, f.bewertung.kritischerZug?.nachCp ?? null] : [ref!.first > 0 ? cp[ref!.first - 1] ?? null : null, cp[ply] ?? null]
        if (a === null || b === null) fail(`Bewertungssprung ${ply === null ? 'des kritischen Zugs' : `bei ${refText(ref!.first)}–${refText(ply)}`} ist nicht im Faktenblatt`)
        else if ((b - a) * shiftTo < need(adv)) fail(`Bewertung ${fmt(a)} → ${fmt(b)} (Weiß) passt nicht zur Richtung ${shiftTo === own ? 'zu dir' : 'weg von dir'} (mind. ${need(adv)} cp, ${ply === null ? 'kritischer Zug ' + f.bewertung.kritischerZug?.zug : refText(ply)})`)
        continue
      }

      // ---- evaluation, state
      const state = ((): { sign: Sign | 0; adv: string } | null => {
        if (/\bMaterial/.test(t)) return null
        let m = new RegExp(`\\b(du )?stehst(?: du)? (${ADV} )?(besser|schlechter)\\b`).exec(t)
        if (m) return { sign: ((m[3] === 'besser' ? 1 : -1) * own) as Sign, adv: m[2] ?? '' }
        m = new RegExp(`\\bsteht (Weiß|Schwarz|dein Gegner) (${ADV} )?(besser|schlechter)\\b`).exec(t)
        if (m) return { sign: ((m[3] === 'besser' ? 1 : -1) * sideSign(m[1]!)!) as Sign, adv: m[2] ?? '' }
        m = new RegExp(`\\bsteht es (${ADV} )?für (dich|Weiß|Schwarz)(?![\\wäöüß])`).exec(t)
        if (m) return { sign: sideSign(m[2] === 'dich' ? 'du' : m[2]!)!, adv: m[1] ?? '' }
        m = new RegExp(`(${ADV}) Vorteil für (dich|Weiß|Schwarz)`).exec(t)
        if (m) return { sign: sideSign(m[2] === 'dich' ? 'du' : m[2]!)!, adv: m[1]! }
        m = new RegExp(`(?:(${ADV}) )?zu (?:deinen Gunsten|deinem Vorteil)`).exec(t)
        if (m) return { sign: own, adv: m[1] ?? '' }
        if (/\bausgeglichen\b|\bgleichst du aus\b/.test(t)) return { sign: 0, adv: '' }
        return null
      })()
      if (state) {
        const { at, c } = stateAt(ply)
        if (c === null) fail(`Bewertung ${where} ist nicht im Faktenblatt`)
        else if (state.sign === 0 ? Math.abs(c) >= CLAIM_CP.equal : c * state.sign < need(state.adv)) fail(`Bewertung ${fmt(c)} (Weiß) ${where} (${refText(at)}) passt nicht zu "${state.sign === 0 ? 'ausgeglichen' : state.sign === 1 ? 'Weiß besser' : 'Schwarz besser'}" (mind. ${state.sign === 0 ? CLAIM_CP.equal : need(state.adv)} cp)`)
      }

      // ---- material
      // a clause without its own move or "Ende" after an earlier move: the claim may concern any later position
      const plies: (number | null)[] = ply === null || ownRef || !ref ? [ply] : Array.from({ length: line.length - ref.ply }, (_x, i) => ref.ply + i)
      const states = plies.flatMap((p) => material(p))
      const [strict, settled] = material(ply)
      const subject = ((): Sign => {
        const m = /\b(?:hat|hast|hatte)\s+(?:am Ende\s+)?(Weiß|Schwarz|dein Gegner|du)(?![\wäöüß])|\b(Weiß|Schwarz|dein Gegner|[Dd]u)\s+(?:hat|hast)\b/.exec(t)
        return (m && sideSign(m[1] ?? m[2]!)) ?? own
      })()
      const diff = (s: { w: Counts; b: Counts }, sign: Sign): Counts => ({ q: (s.w.q - s.b.q) * sign, r: (s.w.r - s.b.r) * sign, b: (s.w.b - s.b.b) * sign, n: (s.w.n - s.b.n) * sign, p: (s.w.p - s.b.p) * sign })
      const worth = (n: Counts) => n.q * 9 + n.r * 5 + (n.b + n.n) * 3 + n.p
      if (/\bMaterial (?:ist|bleibt)(?: am Ende)? (?:gleich|ausgeglichen)/.test(t) && !states.some((s) => worth(diff(s, 1)) === 0)) fail(`Material ist ${where} nicht ausgeglichen (Bilanz Weiß: ${bilanzText(diff(settled, 1))})`)
      if (!/\bstatt\b/.test(t)) {
        const items = [...t.matchAll(/\b(?:(ein|eine|einen|zwei|drei|vier|fünf)\s+)?(Bauern|Bauer|Läufer|Springer|Türme|Turm|Damen|Dame|Qualität)\b/g)]
        for (const it of items) {
          const rest = t.slice(it.index! + it[0].length)
          const dir = /\b(mehr|weniger)\b|\bim Rückstand\b/.exec(rest)
          const between = dir ? rest.slice(0, dir.index) : ''
          // only a list "einen Läufer und zwei Bauern mehr": every item has a number (or is the Qualität) and only "und" lies between
          if (!dir || (!it[1] && it[2] !== 'Qualität') || !/^(?:\s+und\s+(?:(?:ein|eine|einen|zwei|drei|vier|fünf)\s+)?(?:Bauern|Bauer|Läufer|Springer|Türme|Turm|Damen|Dame|Qualität))*\s*$/.test(between)) continue
          const sign = dir[0] === 'mehr' ? 1 : -1
          const qty = NUMBERS[it[1] ?? 'ein']!
          const asClaimed = (s: { w: Counts; b: Counts }) => {
            const d = diff(s, subject)
            if (it[2] === 'Qualität') return bilanzText(d).split(', ').includes(sign === 1 ? 'Qualität mehr' : 'Qualität weniger')
            const type = TYPES.find(([re]) => re.test(it[2]!))![1]
            const [, one, many] = NAMES.find(([k]) => k === type)!
            const net = `${sign === 1 ? '+' : '−'}${qty} ${qty === 1 ? one : many}`
            return d[type] === sign * qty || bilanzText(d).split(', ').includes(net) // also net of a named exchange ("Springer mehr, Qualität weniger")
          }
          if (!states.some(asClaimed)) fail(`"${it[0]} ${dir[0]}" stimmt ${where} nicht (Bilanz ${subject === own ? 'deiner Sicht' : 'Sicht dieser Seite'}: ${bilanzText(diff(settled, subject))})`)
        }
      }
      if (/Läuferpaar/.test(t) && !/\b(kein\w*|ohne|gibst|gibt|verlier\w*|tauscht|tauschst)\b/.test(t)) {
        const m = /\b(Weiß|Schwarz|dein Gegner|[Dd]u|[Dd]ir|[Dd]ein)(?![\wäöüß])/.exec(t)
        const who = m && sideSign(m[1]!)
        if (who && !states.some((s) => (who === 1 ? s.w.b : s.b.b) >= 2)) fail(`${m![1]} hat ${where} nicht das Läuferpaar`)
      }
    }
  }
  return problems
}
