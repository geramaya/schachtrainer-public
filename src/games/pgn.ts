import { Chess } from 'chess.js'
import type { Side } from '../content/types.ts'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'
import type { Helps } from '../train/free-play.ts'
import { MATE_CP } from '../coach/texts.ts'
import { NAG_CODE, SIGN_CODE, positionSign } from '../analysis/nag.ts'
import type { Ev } from '../analysis/nag.ts'
import { moveComment } from '../analysis/comments.ts'
import type { GameAnalysis } from '../analysis/build.ts'
import { analysisFromAnnotations, nagOf as nagOfCode, noteOf, readAnnotations } from './annotations.ts'
import { CATEGORIES } from '../analysis/category.ts'
import { nagOf, normalizeAnalysis } from '../analysis/build.ts'
import type { GameMeta, GameResult, StoredGame } from './model.ts'

const RESULTS: GameResult[] = ['1-0', '0-1', '1/2-1/2', '*']
const EVENT: Record<StoredGame['source'], string> = { sparring: 'Schachtrainer: Sparring', free: 'Schachtrainer: freie Partie', import: 'Schachtrainer' }
const SEVERITY = { ungenau: 'Ungenau', fehler: 'Fehler', patzer: 'Patzer' } as const

/** PGN tag value: backslash and quote escaped, line breaks turned into spaces. */
const escapeTag = (v: string): string => v.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const unescapeTag = (v: string): string => v.replace(/\\(["\\])/g, '$1')

/** What the PGN tags cannot carry (evaluation, retractions, how the game ended), kept as JSON in the tag "Trainer" so a backup is complete. */
export interface TrainerData { source: StoredGame['source']; reason: StoredGame['reason']; retractions: StoredGame['retractions']; review: StoredGame['review']; analysis: GameAnalysis | null; notes: StoredGame['notes']; comments: StoredGame['comments'] }

/** One game as PGN: Seven Tag Roster plus FEN/SetUp, Elo of the engine, Opening, Teacher, OwnSide, help counts and Trainer (backup data). With an analysis: NAGs (move and position signs), [%eval] and a "Trainer:" comment per move; own notes as separate comments. */
export function toPgn(g: StoredGame): string {
  const header: [string, string][] = [
    ['Event', g.meta?.event ?? EVENT[g.source]], ['Site', g.meta?.site ?? 'Schachtrainer'], ['Date', g.date.slice(0, 10).replace(/-/g, '.') || g.meta?.dateText || '????.??.??'], ['Round', '-'],
    ['White', g.white], ['Black', g.black], ['Result', g.result],
  ]
  if (g.startFen !== new Chess().fen()) header.push(['SetUp', '1'], ['FEN', g.startFen])
  if (g.ownSide && g.elo !== null) header.push([g.ownSide === 'white' ? 'BlackElo' : 'WhiteElo', String(g.elo)])
  else for (const [k, v] of [['WhiteElo', g.meta?.whiteElo], ['BlackElo', g.meta?.blackElo]] as const) if (v) header.push([k, String(v)])
  if (g.meta?.timeControl) header.push(['TimeControl', g.meta.timeControl])
  if (g.reason === 'zeit') header.push(['Termination', 'time forfeit'])
  if (g.eco) header.push(['ECO', g.eco])
  if (g.opening) header.push(['Opening', g.opening])
  if (g.repertoire) header.push(['Repertoire', g.repertoire])
  if (g.teacher) header.push(['Teacher', g.teacher])
  if (g.ownSide) header.push(['OwnSide', g.ownSide])
  if (g.helps) header.push(['Hints', String(g.helps.hints)], ['BestMoves', String(g.helps.bests)], ['RepertoireMoves', String(g.helps.repertoire ?? 0)])
  const data: TrainerData = { source: g.source, reason: g.reason, retractions: g.retractions, review: g.review, analysis: g.analysis, notes: g.notes ?? {}, comments: g.comments ?? {} }
  header.push(['Trainer', JSON.stringify(data)])
  return `${header.map(([k, v]) => `[${k} "${escapeTag(v)}"]`).join('\n')}\n\n${movetext(g)} ${g.result}`
}

/** [%eval ...] (white view); a finished game (checkmate, no mate distance) has no evaluation to write. */
const evalTag = (e: Ev): string => (e.mate !== null ? `[%eval #${e.mate}]` : Math.abs(e.cp) >= MATE_CP ? '' : `[%eval ${(e.cp / 100).toFixed(2)}]`)
const noBrace = (t: string): string => t.replace(/[{}]/g, (c) => (c === '{' ? '(' : ')')).replace(/\s*[\r\n]+\s*/g, ' ')

function movetext(g: StoredGame): string {
  const c = new Chess(g.startFen)
  const f = g.startFen.split(' ')
  let number = Number(f[5])
  let white = f[1] !== 'b'
  const marks = new Map((g.review?.marks ?? []).map((m) => [m.ply, m]))
  const a = g.analysis
  const out: string[] = []
  g.ucis.forEach((u, i) => {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
    out.push(white ? `${number}. ${m.san}` : i === 0 ? `${number}... ${m.san}` : m.san)
    const nag = a?.moves[i] ? nagOf(a.moves[i]!) : null
    const pos = a?.positions[i + 1]
    if (nag) out.push(`$${NAG_CODE[nag]}`)
    if (pos) out.push(`$${SIGN_CODE[positionSign(pos)]}`)
    if (a) {
      const text = moveComment(a, g.startFen, g.ucis, i)
      const parts = [pos ? evalTag(pos) : '', text ? `Trainer: ${noBrace(text)}` : ''].filter(Boolean)
      if (parts.length) out.push(`{ ${parts.join(' ')} }`)
    } else {
      const mk = marks.get(i)
      if (mk) out.push(`{${SEVERITY[mk.severity]} (-${(mk.lossCp / 100).toFixed(1)}), besser: ${noBrace(mk.betterSan)}}`)
    }
    for (const text of [g.notes?.[i], g.comments?.[i]]) if (text) out.push(`{ ${noBrace(text)} }`)
    if (!white) number++
    white = !white
  })
  return out.join(' ')
}

/** A game read from PGN; main line only. */
export interface ParsedGame {
  startFen: string
  ucis: string[]
  sans: string[]
  result: GameResult
  /** YYYY-MM-DD or '' */
  date: string
  white: string
  black: string
  ownSide: Side | null
  elo: number | null
  teacher: FigurId | null
  helps: Helps | null
  opening: string | null
  eco: string | null
  repertoire: string | null
  meta: GameMeta
  /** from the tag "Trainer", null for foreign files or unreadable data */
  data: Partial<TrainerData> | null
  /** the stored analysis (Trainer tag) or, from NAGs and [%eval], a reduced one; null without annotations */
  analysis: GameAnalysis | null
  /** the own notes (from the Trainer tag) */
  notes: Record<number, string>
  /** comments of a foreign file, per move */
  comments: Record<number, string>
}
export interface ParseError { /** 1-based position in the file */ index: number; message: string }

const HEADER = /^\s*\[[A-Za-z0-9_]+\s+".*"\s*\]\s*$/
const HEADER_PARTS = /^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\s*\]\s*$/

/** Splits a file into games: a header line after movetext starts the next game. */
export function splitGames(text: string): string[] {
  const blocks: string[] = []
  let cur: string[] = []
  let movetext = false
  const flush = () => { if (cur.join('').trim()) blocks.push(cur.join('\n')); cur = []; movetext = false }
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (line.startsWith('%')) continue
    if (HEADER.test(line)) {
      if (movetext) flush()
    } else if (line.trim()) movetext = true
    cur.push(line)
  }
  flush()
  return blocks
}

/** The Date tag as written when it is incomplete (2026.??.??), for display. */
const partialDate = (d: string | undefined): string | null => (d && /^[\d?]{4}\.[\d?]{2}\.[\d?]{2}$/.test(d) && d.includes('?') ? d : null)
const posInt = (v: string | undefined): number | null => (v !== undefined && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null)
const real = (v: string | undefined): string | null => (v && v.trim() && v.trim() !== '?' ? v.trim() : null)
const day = (d: string | undefined): string => (d && /^\d{4}\.\d{2}\.\d{2}$/.test(d) ? d.replace(/\./g, '-') : '')
const count = (v: string | undefined): number | null => (v !== undefined && /^\d+$/.test(v) ? Number(v) : null)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const SOURCES = ['sparring', 'free', 'import']
const isEv = (v: unknown): boolean => isRecord(v) && typeof v.cp === 'number' && (v.mate === null || typeof v.mate === 'number')
const isLine = (v: unknown): boolean => isRecord(v) && typeof v.uci === 'string' && Array.isArray(v.pv) && v.pv.every((u) => typeof u === 'string')

/** A stored analysis read from the Trainer tag: shape and lengths are checked (n moves, n+1 positions). */
function validAnalysis(v: unknown, moves: number): v is GameAnalysis {
  if (!isRecord(v) || (v.source !== 'engine' && v.source !== 'pgn') || typeof v.depth !== 'number') return false
  const [pos, mv, lines] = [v.positions, v.moves, v.lines]
  if (!Array.isArray(pos) || pos.length !== moves + 1 || !pos.every((p) => p === null || isEv(p))) return false
  if (!Array.isArray(mv) || mv.length !== moves || !mv.every((m) => isRecord(m) && typeof m.lossCp === 'number' && (m.cat === undefined || m.cat === null || CATEGORIES.includes(m.cat as never)) && (m.nag === undefined || m.nag === null || nagOfCode([NAG_CODE[m.nag as keyof typeof NAG_CODE] ?? 0]) !== null))) return false
  return Array.isArray(lines) && lines.length === moves + 1 && lines.every((l) => l === null || (isRecord(l) && isLine(l.best) && (l.second === null || (isLine(l.second) && isEv((l.second as Record<string, unknown>).ev)))))
}
const SEVERITIES = ['ungenau', 'fehler', 'patzer']

/** The Trainer tag, checked field by field; anything that does not fit is dropped. */
function readTrainer(json: string | undefined, moves: number): Partial<TrainerData> | null {
  if (!json) return null
  let raw: unknown
  try { raw = JSON.parse(json) } catch { return null }
  if (!isRecord(raw)) return null
  const out: Partial<TrainerData> = {}
  if (typeof raw.source === 'string' && SOURCES.includes(raw.source)) out.source = raw.source as TrainerData['source']
  if (typeof raw.reason === 'string' || raw.reason === null) out.reason = raw.reason as TrainerData['reason']
  if (Array.isArray(raw.retractions) && raw.retractions.every((r) => isRecord(r) && typeof r.ply === 'number' && typeof r.san === 'string' && typeof r.betterSan === 'string' && (r.severity === 'fehler' || r.severity === 'patzer'))) out.retractions = raw.retractions as TrainerData['retractions']
  if (validAnalysis(raw.analysis, moves)) out.analysis = raw.analysis
  const texts = (v: unknown): Record<number, string> | null => (isRecord(v) && Object.entries(v).every(([k, t]) => /^\d+$/.test(k) && typeof t === 'string') ? (v as Record<number, string>) : null)
  if (texts(raw.notes)) { out.notes = texts(raw.notes)!; out.comments = texts(raw.comments) ?? {} }
  const rv = raw.review
  if (isRecord(rv) && Array.isArray(rv.marks) && (rv.bookExit === null || typeof rv.bookExit === 'number')
    && rv.marks.every((m) => isRecord(m) && typeof m.ply === 'number' && typeof m.lossCp === 'number' && typeof m.betterSan === 'string' && SEVERITIES.includes(m.severity as string))) out.review = rv as unknown as TrainerData['review']
  return out
}

/** Reads one game block. Tags are read here (with escapes undone); chess.js only gets the position and the movetext. */
export function parseGame(block: string, index: number): { game: ParsedGame } | { error: ParseError } {
  try {
    const h: Record<string, string> = {}
    const movetext: string[] = []
    for (const line of block.split('\n')) {
      const m = HEADER_PARTS.exec(line)
      if (m) h[m[1]!] = unescapeTag(m[2]!)
      else movetext.push(line)
    }
    if (h.Variant && !/^(standard|chess|from position)$/i.test(h.Variant)) throw new Error(`Die Variante "${h.Variant}" wird nicht unterstützt.`)
    const c = new Chess()
    const ann = readAnnotations(movetext.join('\n'))
    c.loadPgn((h.FEN ? `[SetUp "1"]\n[FEN "${h.FEN.replace(/"/g, '')}"]\n\n` : '') + ann.sans.join(' '))
    const moves = c.history({ verbose: true })
    if (!moves.length) throw new Error('Die Partie enthält keinen Zug.')
    const foreign: Record<number, string> = {}
    ann.comments.forEach((c, i) => { const n = noteOf(c); if (n) foreign[i] = n })
    const trainer = readTrainer(h.Trainer, moves.length)
    const end = /(1-0|0-1|1\/2-1\/2|\*)\s*$/.exec(movetext.join('\n').trim())?.[1]
    const result = RESULTS.find((r) => r === (h.Result ?? end)) ?? RESULTS.find((r) => r === end) ?? '*'
    const ownSide = h.OwnSide === 'white' || h.OwnSide === 'black' ? h.OwnSide : null
    const elo = ownSide ? Number(h[ownSide === 'white' ? 'BlackElo' : 'WhiteElo']) : NaN
    const [hints, bests] = [count(h.Hints), count(h.BestMoves)]
    return {
      game: {
        startFen: moves[0]!.before, ucis: moves.map((m) => m.from + m.to + (m.promotion ?? '')), sans: moves.map((m) => m.san), result,
        date: day(h.Date), white: h.White || '?', black: h.Black || '?', ownSide, elo: Number.isFinite(elo) && elo > 0 ? elo : null,
        teacher: FIGUREN.find((f) => f.id === h.Teacher)?.id ?? null,
        helps: hints !== null && bests !== null ? { hints, bests, repertoire: count(h.RepertoireMoves) ?? 0 } : null,
        opening: real(h.Opening), eco: real(h.ECO), repertoire: real(h.Repertoire),
        meta: { event: real(h.Event), site: real(h.Site), timeControl: real(h.TimeControl), whiteElo: posInt(h.WhiteElo), blackElo: posInt(h.BlackElo), dateText: partialDate(h.Date) },
        data: trainer, analysis: trainer?.analysis ? normalizeAnalysis(trainer.analysis, moves[0]!.before, moves.map((m) => m.from + m.to + (m.promotion ?? ''))) : analysisFromAnnotations(moves[0]!.before, ann),
        // our own file: notes and comments exactly from the Trainer tag; a foreign file: its comments are Fremdkommentar
        notes: trainer?.notes ?? {}, comments: trainer?.notes ? trainer.comments ?? {} : foreign,
      },
    }
  } catch (e) {
    return { error: { index, message: (e as Error).message } }
  }
}

/** Reads every game of a file; a broken game is reported (with its position) and skipped, never aborts the rest. */
export function parsePgn(text: string): { games: ParsedGame[]; errors: ParseError[] } {
  const games: ParsedGame[] = []
  const errors: ParseError[] = []
  splitGames(text).forEach((block, i) => {
    const r = parseGame(block, i + 1)
    if ('game' in r) games.push(r.game)
    else errors.push(r.error)
  })
  return { games, errors }
}
