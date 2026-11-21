import type { Side } from '../content/types.ts'

/** "Ich spiele Weiß | Schwarz | Zufall" (remembered); Zufall is drawn when the game starts. */
export type SideChoice = Side | 'random'
export const parseSideChoice = (v: unknown): SideChoice => (v === 'black' || v === 'random' ? v : 'white')
export const resolveSide = (c: SideChoice, rnd: number): Side => (c === 'random' ? (rnd < 0.5 ? 'white' : 'black') : c)

interface Idle { phase: 'setup' | 'play' | 'over'; free: boolean; hasStartFen: boolean; side: SideChoice }
const ready = (s: Idle) => s.free && !s.hasStartFen && s.phase === 'setup'

/** A free game is ready on the start position: the first move on the board starts it (only when the player has White; otherwise the engine moves first). */
export const canStartByMove = (s: Idle): boolean => ready(s) && s.side === 'white'

/** Flip (F or the button): before the first move of a free game it switches the side (Black: the engine starts at once); otherwise it only turns the view. */
export function flipIntent(s: Idle): { kind: 'view' } | { kind: 'side'; side: Side; start: boolean } {
  if (!ready(s)) return { kind: 'view' }
  const side: Side = s.side === 'black' ? 'white' : 'black'
  return { kind: 'side', side, start: side === 'black' }
}
