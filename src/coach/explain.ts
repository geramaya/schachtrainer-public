import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import type { Side } from '../content/types.ts'
import type { Analysis, Engine } from '../engine/service.ts'
import { applyUci } from '../chess/game.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { positionKey } from '../chess/position.ts'
import { gameStatus } from '../chess/status.ts'
import { classify, scoreCp, toWhiteCp } from '../train/review.ts'
import { features, tacticalMotifs } from './features.ts'
import type { Motif, SideFeatures } from './features.ts'
import { nullMoveFen, threatsByNullMove } from './threats.ts'
import { BOOK_TEXT, FILE_LIST, SEVERITY_TEXT, VALUE, cap, fmtScore, isMateCp, other, sideName, the } from './texts.ts'
import type { PieceType } from './texts.ts'

export type BookStatus = 'theorie' | 'abweichung' | 'ausserhalb'
/** evalBefore / evalAfter are white-side centipawns. */
export interface MoveContext { bookStatus: BookStatus; evalBefore?: number; evalAfter?: number; depth?: number }

/** One sentence plus where it comes from: 'regel' (computed from the position) or 'stockfish Tiefe n'. */
export interface Statement { text: string; source: string }
export type ShapeKind = 'own' | 'opp' | 'weak'
export interface CoachShape { id: string; orig: string; dest?: string; kind: ShapeKind; label: string; dim?: boolean }
export interface Chance { id: string; kind: ShapeKind; label: string; statement: Statement; shape: CoachShape }
export interface PositionRow { label: string; white: string; black: string; edge: Side | null }

const MAX_SHAPES = 4
export const COACH_DEPTH = 14
const engineSource = (depth?: number) => (depth ? `stockfish Tiefe ${depth}` : 'stockfish')
const rule = (text: string): Statement => ({ text, source: 'regel' })
const decimal = (cp: number) => (Math.abs(cp) / 100).toFixed(1).replace('.', ',')

// ---------- what happened ----------

/** Sentence about the mover's evaluation change (scores are white-side centipawns). */
export function evalStatement(mover: Side, before: number, after: number, depth?: number): Statement {
  const loss = classify([after], mover, before, mover)[0]
  const sized = !isMateCp(before) && !isMateCp(after) // a loss "of 98,8 pawns" against a mate score would be meaningless
  const text = loss
    ? `${SEVERITY_TEXT[loss.severity]}: Die Bewertung fällt von ${fmtScore(before)} auf ${fmtScore(after)} (aus Sicht von Weiß${sized ? `, Verlust ${decimal(loss.lossCp)}` : ''}).`
    : `Die Bewertung bleibt im Rahmen (${fmtScore(before)} → ${fmtScore(after)} aus Sicht von Weiß).`
  return { text, source: engineSource(depth) }
}

const motifKey = (m: Motif) => `${m.kind}:${m.side}:${m.squares.join('')}`
const fromUci = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })

export function describeMoveStatements(fenBefore: string, uci: string, ctx: MoveContext): Statement[] {
  const chess = new Chess(fenBefore)
  let m
  try { m = chess.move(fromUci(uci)) } catch { return [] }
  const mover: Side = m.color === 'w' ? 'white' : 'black'
  let what: string
  if (m.flags.includes('k') || m.flags.includes('q')) {
    what = `${sideName(mover)} rochiert ${m.flags.includes('k') ? 'kurz' : 'lang'}.`
  } else {
    const piece = m.piece as PieceType
    const move = m.captured
      ? `${cap(the(piece))} schlägt ${the(m.captured as PieceType, true)} auf ${m.to}${m.flags.includes('e') ? ' (en passant)' : ''}`
      : `${cap(the(piece))} zieht von ${m.from} nach ${m.to}`
    const promo = m.promotion ? ` und verwandelt sich in ${the(m.promotion as PieceType, true)}` : ''
    const check = chess.isCheckmate() ? ' und setzt matt' : chess.inCheck() ? ' und gibt Schach' : ''
    what = `${move}${promo}${check}.`
  }
  const out: Statement[] = [rule(`${sideName(mover)} spielt ${toGermanSan(m.san)}: ${what}`), rule(BOOK_TEXT[ctx.bookStatus])]
  const seen = new Set(tacticalMotifs(fenBefore).map(motifKey))
  for (const mo of tacticalMotifs(chess.fen()).filter((x) => x.side === mover && !seen.has(motifKey(x))).slice(0, 2)) out.push(rule(`Neu: ${mo.text}`))
  if (ctx.evalBefore !== undefined && ctx.evalAfter !== undefined) out.push(evalStatement(mover, ctx.evalBefore, ctx.evalAfter, ctx.depth))
  return out
}

/** Sentences about the move just played, in German notation; [] for an illegal move. */
export const describeMove = (fenBefore: string, uci: string, ctx: MoveContext): string[] => describeMoveStatements(fenBefore, uci, ctx).map((s) => s.text)

// ---------- plan from the principal variation ----------

/** "Hauptvariante: 3. Lc4 Sf6 4. Sg5, Druck auf f7": the first three plies of the engine line (own, reply, own) with move numbers; '' if the first move is illegal. */
export function planFromPv(fen: string, pv: string[]): string {
  const chess = new Chess(fen)
  const me = chess.turn()
  const sans: string[] = []
  const dests: Square[] = []
  for (let i = 0; i < Math.min(pv.length, 3); i++) {
    let m
    try { m = chess.move(fromUci(pv[i]!)) } catch { break }
    sans.push(m.san)
    if (m.color === me) dests.push(m.to)
  }
  if (!sans.length) return ''
  const parts = fen.split(' ')
  const startPly = (Number(parts[5]) - 1) * 2 + (parts[1] === 'b' ? 1 : 0)
  let pressure = ''
  if (dests.length === 2) {
    const targets = chess.board().flat().flatMap((p) =>
      p && p.color !== me && p.type !== 'k' && chess.attackers(p.square, me).filter((a) => dests.includes(a)).length === 2 ? [p] : [])
    targets.sort((a, b) => VALUE[b.type as PieceType] - VALUE[a.type as PieceType])
    if (targets[0]) pressure = `, Druck auf ${targets[0].square}`
  }
  return `Hauptvariante: ${formatLine(sans, startPly)}${pressure}`
}

// ---------- position, rule based ----------

const edgeOf = (w: number, b: number): Side | null => (w === b ? null : w > b ? 'white' : 'black')

function positionRows(fs: SideFeatures[]): PositionRow[] {
  const [w, b] = fs as [SideFeatures, SideFeatures]
  const structure = (f: SideFeatures) =>
    [f.isolated.length ? `Isolani ${FILE_LIST(f.isolated)}` : '', f.doubled.length ? `Doppelbauer ${FILE_LIST(f.doubled)}` : '', f.passed.length ? `Freibauer ${FILE_LIST(f.passed)}` : '']
      .filter(Boolean).join(', ') || 'unauffällig'
  const score = (f: SideFeatures) => f.passed.length - f.isolated.length - f.doubled.length
  const lines = (f: SideFeatures) =>
    [f.halfOpenFiles.length ? `halboffen ${FILE_LIST(f.halfOpenFiles)}` : '', f.openFiles.length ? `offen ${FILE_LIST(f.openFiles)}` : ''].filter(Boolean).join(', ') || 'keine'
  const king = (f: SideFeatures) => `${f.castled ? 'rochiert' : 'nicht rochiert'}, Schutz ${f.kingShelter}/3`
  return [
    { label: 'Entwicklung', white: `${w.development} Figuren`, black: `${b.development} Figuren`, edge: edgeOf(w.development, b.development) },
    { label: 'Königssicherheit', white: king(w), black: king(b), edge: edgeOf(Number(w.castled) * 2 + w.kingShelter, Number(b.castled) * 2 + b.kingShelter) },
    { label: 'Zentrum', white: `${w.centerControl} von 4 Feldern`, black: `${b.centerControl} von 4 Feldern`, edge: edgeOf(w.centerControl, b.centerControl) },
    { label: 'Linien', white: lines(w), black: lines(b), edge: edgeOf(w.halfOpenFiles.length, b.halfOpenFiles.length) },
    { label: 'Bauernstruktur', white: structure(w), black: structure(b), edge: edgeOf(score(w), score(b)) },
    { label: 'Vorposten', white: w.outposts.join(', ') || 'keine', black: b.outposts.join(', ') || 'keine', edge: edgeOf(w.outposts.length, b.outposts.length) },
    { label: 'Läuferpaar', white: w.bishopPair ? 'ja' : 'nein', black: b.bishopPair ? 'ja' : 'nein', edge: edgeOf(Number(w.bishopPair), Number(b.bishopPair)) },
  ]
}

export function positionSummary(rows: PositionRow[]): string {
  const by = (s: Side) => rows.filter((r) => r.edge === s).map((r) => r.label)
  const parts = (['white', 'black'] as Side[]).filter((s) => by(s).length).map((s) => `${sideName(s)}: ${by(s).join(', ')}`)
  return parts.length ? `Vorteile · ${parts.join(' · ')}` : 'Ausgeglichen'
}

export interface CoachInput { fen: string; ownSide: Side; prevFen?: string; lastUci?: string; bookStatus?: BookStatus }
export interface StaticReport { happened: Statement[]; chances: Chance[]; rows: PositionRow[]; summary: string }

type Where = Pick<CoachShape, 'orig' | 'dest'>

/** Arrow or circle of a motif: first square acts; second (third for a discovered attack) is the target. */
function motifShape(m: Motif, fen: string): Where {
  if (m.kind === 'koenigsziel') return { orig: m.squares[0]! }
  if (m.kind === 'abzug') return { orig: m.squares[0]!, dest: m.squares[2]! }
  if (m.kind === 'haengend') {
    const from = new Chess(fen).attackers(m.squares[0] as Square, m.side === 'white' ? 'w' : 'b')[0]
    return from ? { orig: from, dest: m.squares[0]! } : { orig: m.squares[0]! }
  }
  return { orig: m.squares[0]!, dest: m.squares[1]! }
}

/** Own chances and weak squares are numbered 1, 2, 3; opponent ideas A, B, C. */
function addChance(list: Chance[], kind: ShapeKind, statement: Statement, where: Where): Chance {
  const label = kind === 'opp' ? String.fromCharCode(65 + list.filter((c) => c.kind === 'opp').length) : String(list.filter((c) => c.kind !== 'opp').length + 1)
  const id = `${kind}-${label}`
  const c: Chance = { id, kind, label, statement, shape: { id, kind, label, ...where } }
  list.push(c)
  return c
}

export function staticReport(inp: CoachInput): StaticReport {
  const happened = inp.prevFen && inp.lastUci ? describeMoveStatements(inp.prevFen, inp.lastUci, { bookStatus: inp.bookStatus ?? 'ausserhalb' }) : []
  const chances: Chance[] = []
  const order = (m: Motif) => (m.kind === 'koenigsziel' ? 2 : m.side === inp.ownSide ? 0 : 1)
  for (const m of [...tacticalMotifs(inp.fen)].sort((a, b) => order(a) - order(b))) {
    const kind: ShapeKind = m.kind === 'koenigsziel' ? 'weak' : m.side === inp.ownSide ? 'own' : 'opp'
    addChance(chances, kind, rule(m.text), motifShape(m, inp.fen))
  }
  const rows = positionRows(features(inp.fen))
  return { happened, chances, rows, summary: positionSummary(rows) }
}

/** At most four shapes on the board: own chances first, then opponent ideas, then weak squares. */
export function limitShapes(chances: Chance[], max = MAX_SHAPES): CoachShape[] {
  const rank: Record<ShapeKind, number> = { own: 0, opp: 1, weak: 2 }
  return [...chances].sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, max).map((c) => c.shape)
}

// ---------- engine part (Stockfish), cached per position ----------

export interface CoachCache { analysis: Map<string, Promise<Analysis>> }
export const createCoachCache = (): CoachCache => ({ analysis: new Map() })
const CACHE_LIMIT = 300
/** One cache for everything that asks the coach engine about positions (coach panel, board threat layer): the same position is computed once. */
export const sharedCoachCache: CoachCache = createCoachCache()

/** Engine facade whose analyse() is answered from the cache; failed (e.g. cancelled) jobs are not kept. */
export function cachedEngine(engine: Engine, cache: CoachCache): Engine {
  return {
    ...engine,
    analyse(fen, opts) {
      const key = `${positionKey(fen)}|${opts.depth}|${opts.multipv ?? 1}`
      let hit = cache.analysis.get(key)
      if (!hit) {
        hit = engine.analyse(fen, opts)
        cache.analysis.set(key, hit)
        if (cache.analysis.size > CACHE_LIMIT) cache.analysis.delete(cache.analysis.keys().next().value!)
        hit.catch(() => cache.analysis.delete(key))
      }
      return hit
    },
  }
}

/** whiteCp: evaluation from White's side in centipawns (null if the position is finished); whiteMate: moves to mate from White's side (+n White mates, -n Black mates), else null; feed the sparring evaluation bar. */
export interface EngineReport { happened: Statement[]; why: Statement[]; chances: Chance[]; depth: number; whiteCp: number | null; whiteMate: number | null }

const finished = (fen: string) => gameStatus(fen, []).over
const turnOf = (fen: string): Side => (fen.split(' ')[1] === 'b' ? 'black' : 'white')

/**
 * Stockfish-based sentences for the position and the evaluation jump of the last move; empty for finished positions.
 * `existing` are the rule-based chances (the numbering continues after them). Rejects with CancelledError when the engine job is cancelled.
 */
export async function engineReport(inp: CoachInput, engine: Engine, depth: number, cache: CoachCache, existing: Chance[] = []): Promise<EngineReport> {
  const out: EngineReport = { happened: [], why: [], chances: [], depth, whiteCp: null, whiteMate: null }
  if (finished(inp.fen)) return out
  const eng = cachedEngine(engine, cache)
  const src = engineSource(depth)
  const turn = turnOf(inp.fen)
  const a = await eng.analyse(inp.fen, { depth })
  const line = a.lines[0]!
  const nowWhite = toWhiteCp(scoreCp(line), turn)
  out.whiteCp = nowWhite
  if (line.mate !== null) {
    out.whiteMate = turn === 'white' ? line.mate : -line.mate
    const mating = line.mate > 0 ? turn : other(turn)
    const n = Math.abs(line.mate)
    out.why.push({ text: `Stockfish bewertet die Stellung: ${sideName(mating)} setzt in ${n} ${n === 1 ? 'Zug' : 'Zügen'} matt.`, source: src })
  } else {
    out.why.push({ text: `Stockfish bewertet die Stellung mit ${fmtScore(nowWhite)} aus Sicht von Weiß.`, source: src })
  }
  const plan = planFromPv(inp.fen, line.pv)
  if (plan) out.why.push({ text: plan, source: src })

  const list = [...existing]
  const add = (kind: ShapeKind, statement: Statement, where: Where) => { out.chances.push(addChance(list, kind, statement, where)) }
  const nullFen = nullMoveFen(inp.fen)
  for (const t of await threatsByNullMove(inp.fen, eng, depth)) {
    const r = applyUci(nullFen!, t.uci)
    if (!r) continue
    const owner = other(turn)
    const gain = t.mateIn === 1 ? 'setzt matt' : t.mateIn ? `führt zu Matt in ${t.mateIn}` : `gewinnt etwa ${decimal(t.gainCp)} Bauerneinheiten`
    add(owner === inp.ownSide ? 'own' : 'opp', { text: `${sideName(owner)} droht ${toGermanSan(r.san)}: Der Zug ${gain}.`, source: src }, { orig: t.uci.slice(0, 2), dest: t.uci.slice(2, 4) })
  }
  const best = applyUci(inp.fen, a.bestUci)
  if (turn === inp.ownSide && best) add('own', { text: `Stockfish empfiehlt ${toGermanSan(best.san)}.`, source: src }, { orig: a.bestUci.slice(0, 2), dest: a.bestUci.slice(2, 4) })

  if (inp.prevFen && inp.lastUci && !finished(inp.prevFen)) {
    const before = await eng.analyse(inp.prevFen, { depth })
    out.happened.push(evalStatement(turnOf(inp.prevFen), toWhiteCp(scoreCp(before.lines[0]!), turnOf(inp.prevFen)), nowWhite, depth))
  }
  return out
}
