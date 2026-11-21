import type { Side } from '../content/types.ts'
import { applyUci } from '../chess/game.ts'
import { formatLine } from '../chess/notation.ts'
import { gameFens } from '../train/review.ts'
import { moverAt } from './build.ts'
import type { GameAnalysis } from './build.ts'
import { NAME, SYMBOL } from './category.ts'
import type { Category } from './category.ts'
import type { Ev } from './nag.ts'

/** Categories that get a visible mark in the graph (the quiet ones - best, excellent, good, book - would only clutter it). */
export const MARKED: readonly Category[] = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']
const PRIORITY: Record<Category, number> = { blunder: 6, miss: 5, mistake: 4, brilliant: 3, great: 2, inaccuracy: 1, best: 0, excellent: 0, good: 0, book: 0 }

export interface GraphMark {
  /** the position after the move (1 = after the first move), like the position index of the graph */
  ply: number
  cat: Category
  symbol: string
  name: string
  side: Side
  /** "6. Lf4?" */
  title: string
  /** "+0,25 → −2,50" */
  evalText: string
  /** one short sentence of the analysis comment */
  sentence: string
  priority: number
}

/** Evaluation for people: German comma, sign, mate with the winning side (white view). */
export function evalText(e: Ev): string {
  if (e.mate !== null) return `Matt in ${Math.abs(e.mate)} für ${e.mate > 0 ? 'Weiß' : 'Schwarz'}`
  if (e.cp === 0) return '0,00'
  return `${e.cp > 0 ? '+' : '−'}${(Math.abs(e.cp) / 100).toFixed(2).replace('.', ',')}`
}

/** The comment cut down to one line: the first sentence and, if there is one, "Besser war X" without the reason. */
export function shortSentence(comment: string | null, max = 170): string {
  if (!comment) return ''
  const sentences = comment.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const first = sentences[0] ?? ''
  const better = sentences.slice(1).find((s) => s.startsWith('Besser war'))
  const out = better ? `${first} ${better.split(':')[0]!.replace(/\.$/, '')}.` : first
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out
}

/** The marks of the graph for the notable categories; `comment(ply)` supplies the analysis comment of a move (0-based index). */
export function graphMarks(a: GameAnalysis, startFen: string, ucis: string[], o: { comment?: (ply: number) => string | null } = {}): GraphMark[] {
  const fens = gameFens(startFen, ucis)
  const f = startFen.split(' ')
  const startPly = (Number(f[5]) - 1) * 2 + (f[1] === 'b' ? 1 : 0)
  const out: GraphMark[] = []
  a.moves.forEach((m, i) => {
    if (!m.cat || !MARKED.includes(m.cat)) return
    const san = applyUci(fens[i]!, ucis[i]!)?.san
    const [before, after] = [a.positions[i], a.positions[i + 1]]
    if (!san || !before || !after) return
    out.push({
      ply: i + 1, cat: m.cat, symbol: SYMBOL[m.cat], name: NAME[m.cat], side: moverAt(startFen, i),
      title: `${formatLine([san], startPly + i)}${SYMBOL[m.cat]}`, evalText: `${evalText(before)} → ${evalText(after)}`,
      sentence: shortSentence(o.comment?.(i) ?? null), priority: PRIORITY[m.cat],
    })
  })
  return out
}

/**
 * Rows for marks on one side of the curve so that no two marks of a row are closer than `gap` pixels. The most important marks are placed
 * first; a mark that fits into no row gets null (it is drawn as a dot only; its tooltip still works).
 */
export function layoutMarks(items: { x: number; priority: number }[], gap: number, rows: number): (number | null)[] {
  const placed: number[][] = Array.from({ length: rows }, () => [])
  const out: (number | null)[] = items.map(() => null)
  const order = items.map((_, i) => i).sort((a, b) => items[b]!.priority - items[a]!.priority || items[a]!.x - items[b]!.x)
  for (const i of order) {
    const r = placed.findIndex((xs) => xs.every((x) => Math.abs(x - items[i]!.x) >= gap))
    if (r >= 0) { placed[r]!.push(items[i]!.x); out[i] = r }
  }
  return out
}

/** Left edge of a tooltip centred on `x`, kept inside the graph. */
export const tooltipLeft = (x: number, width: number, tipWidth: number): number => Math.max(0, Math.min(width - tipWidth, x - tipWidth / 2))
