import type { Ev, Nag } from '../analysis/nag.ts'
import { nagFromCode } from '../analysis/nag.ts'
import { MATE_CP } from '../coach/texts.ts'
import { ANALYSIS_VERSION, categoryOfSign, moverAt } from '../analysis/build.ts'
import type { GameAnalysis } from '../analysis/build.ts'

/** What stands behind each move of the main line of a PGN movetext: NAG numbers and comments (variations and their comments are skipped). */
export interface MoveAnnotations { /** the SAN of the main line without numbers, comments, NAGs and ! ? suffixes */ sans: string[]; nags: number[][]; comments: string[][] }

const SUFFIX_NAG: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 }
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

export function readAnnotations(movetext: string): MoveAnnotations {
  const sans: string[] = []
  const nags: number[][] = []
  const comments: string[][] = []
  let i = 0
  const s = movetext
  while (i < s.length) {
    const ch = s[i]!
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '{') {
      const end = s.indexOf('}', i)
      const text = s.slice(i + 1, end < 0 ? s.length : end)
      if (comments.length) comments[comments.length - 1]!.push(text)
      i = end < 0 ? s.length : end + 1
      continue
    }
    if (ch === ';') { const end = s.indexOf('\n', i); i = end < 0 ? s.length : end + 1; continue }
    if (ch === '(') { // variation: skip to the matching bracket, braces inside do not count
      let depth = 0
      while (i < s.length) {
        const c = s[i]!
        if (c === '{') { const e = s.indexOf('}', i); i = e < 0 ? s.length : e + 1; continue }
        if (c === '(') depth++
        if (c === ')' && --depth === 0) { i++; break }
        i++
      }
      continue
    }
    let j = i
    while (j < s.length && !/[\s{(;]/.test(s[j]!)) j++
    const token = s.slice(i, j)
    i = j
    if (token.startsWith('$')) { const n = Number(token.slice(1)); if (nags.length && Number.isFinite(n)) nags[nags.length - 1]!.push(n); continue }
    if (RESULTS.has(token) || /^\d+\.+$/.test(token)) continue
    const san = token.replace(/^\d+\.+/, '')
    if (!san) continue
    const suffix = /[!?]+$/.exec(san)?.[0]
    sans.push(suffix ? san.slice(0, -suffix.length) : san)
    nags.push(suffix && SUFFIX_NAG[suffix] ? [SUFFIX_NAG[suffix]!] : [])
    comments.push([])
  }
  return { sans, nags, comments }
}

/** The evaluation from a Lichess-style `[%eval 0.23]` or `[%eval #-3]` (white view). */
export function readEval(comments: string[]): Ev | null {
  for (const c of comments) {
    const m = /\[%eval\s+(#)?(-?\d+(?:\.\d+)?)/.exec(c)
    if (!m) continue
    const v = Number(m[2])
    if (m[1] && v === 0) return null // mate 0: the side is not known
    if (m[1]) return { cp: (v > 0 ? 1 : -1) * MATE_CP, mate: v }
    return { cp: Math.round(v * 100), mate: null }
  }
  return null
}

export function nagOf(codes: number[]): Nag | null {
  for (const c of codes) { const n = nagFromCode(c); if (n) return n }
  return null
}

const MACHINE = /^(Trainer:|(Ungenau|Fehler|Patzer) \(-\d+\.\d\), besser:)/

/** The own note of a move: what is left of its comments after the tags `[%...]`; our own machine comments are no notes. */
export function noteOf(comments: string[]): string | null {
  const texts = comments.map((c) => c.replace(/\[%[^\]]*\]/g, '').trim()).filter((t) => t && !MACHINE.test(t))
  return texts.length ? texts.join(' ') : null
}

/** A reduced analysis from the NAGs and [%eval] comments of a foreign file (no engine lines, the start position is unknown); null without any of them. */
export function analysisFromAnnotations(startFen: string, a: MoveAnnotations): GameAnalysis | null {
  const n = a.nags.length
  const positions: (Ev | null)[] = Array.from({ length: n + 1 }, () => null)
  a.comments.forEach((c, i) => { positions[i + 1] = readEval(c) })
  const moves = a.nags.map((codes, i) => {
    const mover = moverAt(startFen, i)
    const [before, after] = [positions[i], positions[i + 1]]
    const lossCp = before && after ? Math.max(0, (mover === 'white' ? 1 : -1) * (before.cp - after.cp)) : 0
    return { cat: categoryOfSign(nagOf(codes)), lossCp }
  })
  if (!positions.some(Boolean) && !moves.some((m) => m.cat)) return null
  return { version: ANALYSIS_VERSION, source: 'pgn', depth: 0, positions, moves, lines: Array.from({ length: n + 1 }, () => null), bookPlies: null }
}
