import type { Side } from '../content/types.ts'

export interface TimeControl { id: string; label: string; baseMs: number; incMs: number }
const tcOf = (min: number, inc: number): TimeControl => ({ id: `${min}+${inc}`, label: `${min}+${inc}`, baseMs: min * 60_000, incMs: inc * 1000 })
/** The usual Lichess groups; "ohne Zeit" is no entry (null). */
export const TIME_CONTROLS: { group: string; items: TimeControl[] }[] = [
  { group: 'Bullet', items: [tcOf(1, 0), tcOf(2, 1)] },
  { group: 'Blitz', items: [tcOf(3, 0), tcOf(3, 2), tcOf(5, 0), tcOf(5, 3)] },
  { group: 'Schnellschach', items: [tcOf(10, 0), tcOf(10, 5), tcOf(15, 10)] },
  { group: 'Klassisch', items: [tcOf(30, 0), tcOf(30, 20)] },
]
/** Minutes of a free time control like on Lichess: a quarter, a half, three quarters, then 1 to 180. */
export const MINUTE_STEPS: number[] = [0.25, 0.5, 0.75, ...Array.from({ length: 180 }, (_, i) => i + 1)]
export const INC_MAX = 180
const FRACTION: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }
/** "Eigene": minutes (one of MINUTE_STEPS) and increment in whole seconds (0 to 180); null for anything else. */
export function customTimeControl(min: number, incSec: number): TimeControl | null {
  if (!MINUTE_STEPS.includes(min) || !Number.isInteger(incSec) || incSec < 0 || incSec > INC_MAX) return null
  return { id: `c:${min}+${incSec}`, label: `${FRACTION[min] ?? min}+${incSec}`, baseMs: min * 60_000, incMs: incSec * 1000 }
}
export function parseTimeControl(v: unknown): TimeControl | null {
  if (typeof v !== 'string') return null
  const m = v.match(/^c:(\d+(?:\.\d+)?)\+(\d+)$/)
  if (m) return customTimeControl(Number(m[1]), Number(m[2]))
  return TIME_CONTROLS.flatMap((g) => g.items).find((t) => t.id === v) ?? null
}
/** PGN tag value: seconds base + seconds increment. */
export const pgnTimeControl = (t: TimeControl): string => `${t.baseMs / 1000}+${t.incMs / 1000}`

/**
 * Chess clock as a pure value; every function gets `now` (ms). Like Lichess the clock starts once both sides made their first move: the first
 * move of each side runs no clock and earns no increment. `ticking` = the clock of `turn` runs.
 */
export interface Clock { ms: Record<Side, number>; incMs: number; turn: Side; ticking: boolean; since: number; moved: Record<Side, number> }
const other = (s: Side): Side => (s === 'white' ? 'black' : 'white')

export const newClock = (t: TimeControl): Clock => ({ ms: { white: t.baseMs, black: t.baseMs }, incMs: t.incMs, turn: 'white', ticking: false, since: 0, moved: { white: 0, black: 0 } })

export function remaining(c: Clock, side: Side, now: number): number {
  return Math.max(0, c.ms[side] - (c.ticking && c.turn === side ? now - c.since : 0))
}

/** `mover` has made a move: its time is settled, the increment added (not for the first move), the clock of the opponent starts, unless the teacher holds the clocks (`held`: they start with the resume). */
export function press(c: Clock, mover: Side, now: number, held = false): Clock {
  const used = c.ticking && c.turn === mover ? now - c.since : 0
  const first = c.moved[mover] === 0
  const ms = { ...c.ms, [mover]: Math.max(0, c.ms[mover] - used) + (first ? 0 : c.incMs) }
  const moved = { ...c.moved, [mover]: c.moved[mover] + 1 }
  const turn = other(mover)
  return { ...c, ms, moved, turn, ticking: moved[turn] > 0 && !held, since: now }
}

export function pause(c: Clock, now: number): Clock {
  return c.ticking ? { ...c, ms: { ...c.ms, [c.turn]: remaining(c, c.turn, now) }, ticking: false, since: now } : c
}
export function resume(c: Clock, now: number): Clock {
  return c.ticking || c.moved[c.turn] === 0 ? c : { ...c, ticking: true, since: now }
}
/** A held move is taken back: the clock returns to the state before that move, the thinking time is refunded. */
export const rewind = (before: Clock, now: number): Clock => (before.ticking ? { ...before, since: now } : before)

export const flagged = (c: Clock, now: number): Side | null => (c.ticking && remaining(c, c.turn, now) <= 0 ? c.turn : null)

/** The teacher stops both clocks while he judges, while the question to the player is open, while his comment after the move is shown and while a hint or the best move is on screen; only with the switch on. */
export function clockPaused(s: { withTeacher: boolean; teacherPause: boolean; judging: boolean; pending: boolean; helpOpen: boolean; commentOpen: boolean }): boolean {
  return s.withTeacher && s.teacherPause && (s.judging || s.pending || s.helpOpen || s.commentOpen)
}

/** A time control with a teacher who does NOT stop the clock suggests the hold setting "nie" (a question to the player and a running clock do not go together). */
export function holdSuggestion(s: { teacherOn: boolean; teacherPause: boolean; hadTime: boolean; hasTime: boolean }): 'never' | null {
  return s.teacherOn && !s.teacherPause && !s.hadTime && s.hasTime ? 'never' : null
}

/** "m:ss"; below 20 seconds with tenths ("0:19.5"). */
export function formatClock(ms: number): string {
  const v = Math.max(0, ms)
  if (v < 20_000) { const t = Math.floor(v / 100); return `0:${String(Math.floor(t / 10)).padStart(2, '0')}.${t % 10}` }
  const s = Math.ceil(v / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
export const isLow = (ms: number): boolean => ms < 20_000

/** Can the side still deliver mate? Pawns, rooks, queens or two minor pieces (a lone knight or bishop cannot). */
export function canMate(fen: string, side: Side): boolean {
  const board = fen.split(' ')[0]!
  const mine = [...board].filter((ch) => /[a-z]/i.test(ch) && (ch === ch.toUpperCase()) === (side === 'white')).map((ch) => ch.toLowerCase())
  return mine.some((p) => 'prq'.includes(p)) || mine.filter((p) => p === 'n' || p === 'b').length >= 2
}
/** Winner when `loser` ran out of time: the opponent, or nobody (draw) if the opponent cannot mate. */
export const flagWinner = (fen: string, loser: Side): Side | null => (canMate(fen, other(loser)) ? other(loser) : null)

/** Thinking time of the engine: a thirtieth of its remaining time plus most of the increment, capped by the strength setting, never below a sensible minimum. */
export function engineMoveMs(remainingMs: number, incMs: number, elo: number): number {
  const cap = 800 + (elo - 1320) * 2.5
  return Math.max(30, Math.floor(Math.min(cap, remainingMs / 30 + incMs * 0.8, remainingMs * 0.4)))
}
