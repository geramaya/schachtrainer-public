import { Chess } from 'chess.js'
import type { ContentBundle, Side } from '../content/types.ts'
import type { OpeningOverlays } from '../store/overlays.ts'
import { treeFor } from '../content/tree.ts'
import { applyUci } from '../chess/game.ts'
import { positionKey } from '../chess/position.ts'
import type { FigurId } from '../teacher/avatar.ts'
import { bookExit } from './review.ts'

const INITIAL_KEY = positionKey(new Chess().fen())

/** True if the game, played from the initial position, goes through all moves of the opening's entry (English SAN). */
function followsEntry(ucis: string[], entry: string[]): boolean {
  if (ucis.length < entry.length) return false
  let fen = new Chess().fen()
  for (let i = 0; i < entry.length; i++) {
    const r = applyUci(fen, ucis[i]!)
    if (!r || r.san !== entry[i]) return false
    fen = r.fen
  }
  return true
}

/**
 * Free game: the player's own opening that the game (`ucis`) has entered completely (all moves of `Opening.entry`) and whose book it follows longest.
 * From the initial position only; from another start position the tree decides. A shared prefix, an unfinished entry or a tie name no
 * opening (null) - then the teacher says nothing about the repertoire.
 */
export function pickOpening(b: ContentBundle, ucis: string[], startFen: string, ov: OpeningOverlays, side: Side): string | null {
  const fromStart = positionKey(startFen) === INITIAL_KEY
  let best: { id: string; len: number; tie: boolean } | null = null
  for (const o of b.openings) {
    if (o.side !== side || !treeFor(b, o.id)[positionKey(startFen)]) continue
    if (fromStart && !followsEntry(ucis, o.entry)) continue
    const len = bookExit(ucis, b, o.id, ov, startFen) ?? ucis.length
    if (!best || len > best.len) best = { id: o.id, len, tie: false }
    else if (len === best.len) best.tie = true
  }
  return best && !best.tie && best.len > 0 ? best.id : null
}

/** Help the player asked for during the game (hints = piece marked, bests = best move shown, repertoire = planned repertoire move shown). */
export interface Helps { hints: number; bests: number; repertoire: number }
/** How many moves of the game are book moves: the longest stay in the repertoire tree among the own openings; null without opening data. */
export function bookPliesOf(b: ContentBundle | null, ucis: string[], startFen: string, ov: OpeningOverlays, side: Side): number | null {
  if (!b) return null
  let best = 0
  for (const o of b.openings) {
    if (o.side !== side || !treeFor(b, o.id)[positionKey(startFen)]) continue
    best = Math.max(best, bookExit(ucis, b, o.id, ov, startFen) ?? ucis.length)
  }
  return best
}

export type EndReason = 'matt' | 'patt' | 'wiederholung' | '50-zuege' | 'material' | 'aufgabe' | 'remis' | 'abbruch'
export interface Outcome { winner: Side | null; reason: EndReason }

/** Everything needed to save a finished game later (PGN: start position, moves, result, date, strength, teacher). */
export interface GameRecord {
  startFen: string
  ucis: string[]
  /** English SAN */
  sans: string[]
  /** '*' = game left unfinished */
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  reason: EndReason
  /** ISO 8601 */
  date: string
  elo: number
  teacher: FigurId | null
  ownSide: Side
  helps: Helps
}

export function gameRecord(o: { startFen: string; ucis: string[]; outcome: Outcome; date: Date; elo: number; teacher: FigurId | null; ownSide: Side; helps: Helps }): GameRecord {
  let fen = o.startFen
  const sans = o.ucis.map((u) => {
    const r = applyUci(fen, u)!
    fen = r.fen
    return r.san
  })
  const result = o.outcome.reason === 'abbruch' ? '*' : o.outcome.winner === null ? '1/2-1/2' : o.outcome.winner === 'white' ? '1-0' : '0-1'
  return { startFen: o.startFen, ucis: [...o.ucis], sans, result, reason: o.outcome.reason, date: o.date.toISOString(), elo: o.elo, teacher: o.teacher, ownSide: o.ownSide, helps: { ...o.helps } }
}
