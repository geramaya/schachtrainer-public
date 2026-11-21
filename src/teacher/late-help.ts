import type { Judgement } from './judge.ts'

/** Offer "Besseren Zug zeigen" after an inaccurate move; it lives until the player makes the next move. */
export interface LateHelp { reveal: string; shown: boolean }
export type LateEvent = { kind: 'judged'; j: Judgement } | { kind: 'show' } | { kind: 'moved' } | { kind: 'reset' }

export function lateHelp(prev: LateHelp | null, e: LateEvent): LateHelp | null {
  switch (e.kind) {
    case 'judged': return e.j.rating === 'ungenau' ? { reveal: e.j.reveal, shown: false } : null
    case 'show': return prev && { ...prev, shown: true }
    case 'moved':
    case 'reset': return null
  }
}
