import type { Judgement } from './judge.ts'

/** Offer "Warum? Besseren Zug zeigen" after an inaccurate move, a mistake or a blunder; it lives until the player makes the next move. */
export interface LateHelp { reveal: string; /** the better move (arrow) */ uci: string; shown: boolean }
export type LateEvent = { kind: 'judged'; j: Judgement } | { kind: 'show' } | { kind: 'moved' } | { kind: 'reset' }

export function lateHelp(prev: LateHelp | null, e: LateEvent): LateHelp | null {
  switch (e.kind) {
    case 'judged': return e.j.rating === 'ungenau' || e.j.rating === 'fehler' || e.j.rating === 'patzer' ? { reveal: e.j.reveal, uci: e.j.betterUci, shown: false } : null
    case 'show': return prev && { ...prev, shown: true }
    case 'moved':
    case 'reset': return null
  }
}
