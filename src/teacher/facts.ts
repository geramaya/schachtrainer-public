import { Chess } from 'chess.js'
import type { Color, Square } from 'chess.js'
import type { AnalysisLine } from '../engine/service.ts'
import type { Side } from '../content/types.ts'
import { tacticalMotifs } from '../coach/features.ts'
import type { Motif, MotifKind } from '../coach/features.ts'
import { VALUE, cap, the } from '../coach/texts.ts'
import type { PieceType } from '../coach/texts.ts'
import { formatLine } from '../chess/notation.ts'
import { units } from './blocks.ts'

/** Everything the teacher says about a move is one of these, each proven by the engine line (PV, replayed with chess.js) or the position. SANs are English here; the text layer converts. */
export type Fact =
  | { kind: 'mate-allowed'; n: number; san: string | null; backRank: boolean }
  | { kind: 'mate-missed'; n: number; san: string }
  | { kind: 'promotion'; square: string; san: string }
  | { kind: 'hanging'; piece: PieceType; square: string; san: string; undefended: boolean }
  | { kind: 'motif'; motif: MotifKind; text: string; san: string }
  /** loss: the line itself loses `pawns`; missed: the line is level or loses little, but the best move wins `pawns` more */
  | { kind: 'material'; mode: 'loss' | 'missed'; pawns: number; line: string }

export interface Step {
  color: Side; uci: string; san: string; from: string; to: string
  /** square of the captured piece (differs from `to` for en passant) */
  captureSquare?: string
  piece: PieceType; captured?: PieceType; promotion?: PieceType; check: boolean
  /** position before / after the step */
  before: string; after: string
}

const MAX_WINDOW = 6
const MOTIFS: MotifKind[] = ['gabel', 'fesselung', 'spiess', 'abzug']
export const opposite = (s: Side): Side => (s === 'white' ? 'black' : 'white')
const colorOf = (s: Side): Color => (s === 'white' ? 'w' : 'b')

/** Plays a PV from `fen`; stops silently at the first illegal move. */
export function replay(fen: string, pv: string[]): Step[] {
  const chess = new Chess(fen)
  const out: Step[] = []
  for (const u of pv) {
    const before = chess.fen()
    let m
    try { m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }) } catch { break }
    out.push({
      color: m.color === 'w' ? 'white' : 'black', uci: u, san: m.san, from: m.from, to: m.to,
      captureSquare: m.captured ? (m.flags.includes('e') ? `${m.to[0]}${m.from[1]}` : m.to) : undefined,
      piece: m.piece as PieceType, captured: m.captured as PieceType | undefined, promotion: m.promotion as PieceType | undefined,
      check: chess.inCheck(), before, after: chess.fen(),
    })
  }
  return out
}

/** The first plies of a line (at most 6) that count for material; a trailing capture of the opponent is followed through to the recapture if the line has one. */
function window(steps: Step[], mover: Side): Step[] {
  const w = steps.slice(0, MAX_WINDOW)
  const last = w.at(-1)
  if (last && last.color !== mover && last.captured && steps[MAX_WINDOW]) w.push(steps[MAX_WINDOW]!)
  return w
}

/** The line may be judged by material only if it ends quietly or on a capture the other side cannot retake; otherwise the PV was cut in the middle of an exchange. */
function settled(w: Step[]): boolean {
  const last = w.at(-1)
  if (!last?.captured) return true
  return new Chess(last.after).attackers(last.to as Square, last.color === 'white' ? 'b' : 'w').length === 0
}

/** Material the mover wins (positive) or loses over the window, in pawns; null if the line is cut mid-exchange. */
function saldo(steps: Step[], mover: Side): number | null {
  const w = window(steps, mover)
  if (!settled(w)) return null
  return w.reduce((sum, s) => {
    const gain = (s.captured ? VALUE[s.captured] : 0) + (s.promotion ? VALUE[s.promotion] - 1 : 0)
    return sum + (s.color === mover ? gain : -gain)
  }, 0)
}

const motifKey = (m: Motif) => `${m.kind}:${m.side}:${m.squares.join(',')}`
/** Tactical motifs for `side` that appear in `after` but were not there in `before`. */
function newMotifs(before: string, after: string, side: Side): Motif[] {
  const old = new Set(tacticalMotifs(before).map(motifKey))
  return tacticalMotifs(after).filter((m) => m.side === side && MOTIFS.includes(m.kind) && !old.has(motifKey(m)))
}

const startPly = (fen: string): number => { const f = fen.split(' '); return (Number(f[5]) - 1) * 2 + (f[1] === 'b' ? 1 : 0) }

/** Grundreihenmatt: the final position is mate against `loser`, whose king sits on its first rank, checked by a rook or queen along that rank, with every second-rank square next to it blocked by its own pieces. */
function isBackRankMate(steps: Step[], loser: Side): boolean {
  const last = steps.at(-1)
  if (!last) return false
  const chess = new Chess(last.after)
  if (!chess.isCheckmate() || last.color === loser) return false
  const home = loser === 'white' ? '1' : '8'
  const second = loser === 'white' ? 2 : 7
  const king = chess.board().flat().find((p) => p?.type === 'k' && p.color === colorOf(loser))
  if (!king || king.square[1] !== home || (last.piece !== 'r' && last.piece !== 'q') || last.to[1] !== home) return false
  const files = 'abcdefgh'
  const fi = files.indexOf(king.square[0]!)
  const squares = [fi - 1, fi, fi + 1].filter((f) => f >= 0 && f <= 7).map((f) => `${files[f]}${second}` as Square)
  return squares.every((sq) => chess.get(sq)?.color === colorOf(loser))
}

/** Facts about the played move, strongest first. `playedPv`/`bestPv` start with the move itself. */
export function detectFacts(fenBefore: string, played: AnalysisLine, best: AnalysisLine): Fact[] {
  const mover: Side = fenBefore.split(' ')[1] === 'b' ? 'black' : 'white'
  const foe = opposite(mover)
  const ps = replay(fenBefore, played.pv)
  const bs = replay(fenBefore, best.pv)
  const sp = saldo(ps, mover)
  const sb = saldo(bs, mover)
  const delta = sp === null || sb === null ? null : sp - sb
  const losing = delta !== null && sp! <= -1 && delta <= -1 // the line really loses material, and more than the best line does
  const facts: Fact[] = []

  if (played.mate !== null && played.mate < 0 && !(best.mate !== null && best.mate < 0)) {
    facts.push({ kind: 'mate-allowed', n: -played.mate, san: ps[1]?.san ?? null, backRank: isBackRankMate(ps, mover) })
  }
  if (best.mate !== null && best.mate > 0 && !(played.mate !== null && played.mate > 0) && bs[0]) {
    facts.push({ kind: 'mate-missed', n: best.mate, san: bs[0].san })
  }

  const queened = ps.slice(1, MAX_WINDOW).find((s) => s.color === foe && s.promotion)
  const bestQueens = bs.slice(1, MAX_WINDOW).some((s) => s.color === foe && s.promotion && s.to === queened?.to)
  if (queened && !bestQueens) facts.push({ kind: 'promotion', square: queened.to, san: queened.san })

  const reply = ps[1]
  if (reply?.captured && reply.color === foe && losing) {
    const square = reply.captureSquare!
    const undefended = new Chess(ps[0]!.after).attackers(square as Square, colorOf(mover)).length === 0
    if (undefended || VALUE[reply.piece] < VALUE[reply.captured]) {
      facts.push({ kind: 'hanging', piece: reply.captured, square, san: reply.san, undefended })
    }
  }

  if (reply && ps[0] && losing) {
    const m = newMotifs(ps[0].after, reply.after, foe)[0]
    if (m) facts.push({ kind: 'motif', motif: m.kind, text: m.text, san: reply.san })
  }

  if (delta !== null && delta <= -2) {
    const line = formatLine(window(ps, mover).map((s) => s.san), startPly(fenBefore))
    facts.push(sp! <= -2 ? { kind: 'material', mode: 'loss', pawns: -sp!, line } : { kind: 'material', mode: 'missed', pawns: -delta, line })
  }
  return facts
}

const HOME: Record<Side, string[]> = { white: ['b1', 'g1', 'c1', 'f1'], black: ['b8', 'g8', 'c8', 'f8'] }

/** Why the best move is good: only what the engine line or the position proves; null if nothing specific can be said. */
export function explainBest(fenBefore: string, best: AnalysisLine): string | null {
  const mover: Side = fenBefore.split(' ')[1] === 'b' ? 'black' : 'white'
  const bs = replay(fenBefore, best.pv)
  const first = bs[0]
  if (!first) return null
  if (best.mate !== null && best.mate > 0) return best.mate === 1 ? 'Er setzt sofort matt.' : `Er setzt in ${best.mate} Zügen matt.`
  if (first.promotion) return 'Er wandelt den Bauern um.'
  const gain = saldo(bs, mover)
  const grab = first.captured && first.captureSquare && new Chess(first.before).attackers(first.captureSquare as Square, colorOf(opposite(mover))).length === 0
    ? `Er schlägt ${the(first.captured, true)} auf ${first.captureSquare}: ${cap(the(first.captured))} steht ungedeckt.`
    : null
  if (gain !== null && gain >= 1) {
    const won = `Er gewinnt in der Folge ${units(gain)} Material (${formatLine(window(bs, mover).map((s) => s.san), startPly(fenBefore))}).`
    return grab ? `${grab} ${won}` : won
  }
  if (grab) return grab
  const hanging = tacticalMotifs(fenBefore).some((m) => m.kind === 'haengend' && m.side === opposite(mover) && m.squares[0] === first.from)
  if (hanging) return `Er rettet die angegriffene Figur auf ${first.from}.`
  const fork = newMotifs(first.before, first.after, mover)[0]
  if (fork) return fork.text
  if (first.check) return 'Er gibt Schach.'
  if (first.san.startsWith('O-O-O')) return `Er rochiert lang: Der König zieht nach ${first.to}, der Turm kommt ins Spiel.`
  if (first.san.startsWith('O-O')) return `Er rochiert kurz: Der König zieht nach ${first.to} in die Ecke, der Turm kommt ins Spiel.`
  if ((first.piece === 'n' || first.piece === 'b') && HOME[mover].includes(first.from)) return `Er entwickelt ${first.piece === 'n' ? 'den Springer' : 'den Läufer'} von ${first.from}.`
  return null
}

/** The first plies of an engine line as a German move list ("1. a4 a5 2. b4 b5"). */
export function mainLine(fen: string, pv: string[], plies = 4): string {
  return formatLine(replay(fen, pv).slice(0, plies).map((s) => s.san), startPly(fen))
}
