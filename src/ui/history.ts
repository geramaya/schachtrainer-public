import { navTarget } from './keys.ts'

/**
 * Browsing the moves of a running or finished game: ←/→/Home/End. `null` = the live position (the last ply), `undefined` = not a navigation key.
 * The space bar is not navigation here: it means "Weiterspielen" while the teacher holds the game.
 */
export function historyTarget(key: string, view: number | null, total: number): number | null | undefined {
  if (key === ' ') return undefined
  const to = navTarget(key, view ?? total, total)
  if (to === null) return undefined
  return to >= total ? null : to
}

/** The line shown while an earlier position is on the board; `fresh` = the game moved on meanwhile. */
export function historyNotice(o: { view: number | null; startPly: number; fresh: boolean }): string {
  if (o.view === null) return ''
  const ply = o.startPly + o.view
  const where = o.view === 0 ? 'Ausgangsstellung' : `Zug ${Math.ceil(ply / 2)}${ply % 2 === 0 ? '…' : ''}`
  return `Ansicht ${where} – zurück zur Partie: Ende${o.fresh ? ' · Neuer Zug' : ''}`
}

export type EngineStatusKind = 'thinking' | 'waiting' | 'ready' | 'off'
/** What the opponent is doing, in one line that is always visible at the board. */
export function engineStatus(s: { phase: 'setup' | 'play' | 'over'; thinking: boolean; judging: boolean; pending: boolean; myTurn: boolean; /** before the game: who starts */ setupHint?: 'move' | 'engine' | 'choose'; /** the opponent of the game, default Stockfish */ opponent?: 'stockfish' | 'maia'; /** Maia is still being loaded */ maiaLoading?: boolean }): { kind: EngineStatusKind; text: string } {
  const name = s.opponent === 'maia' ? 'Maia' : 'Stockfish'
  if (s.phase === 'over') return { kind: 'off', text: 'Partie beendet' }
  if (s.phase === 'setup') return { kind: 'ready', text: s.setupHint === 'move' ? 'Bereit – zieh, um zu beginnen' : s.setupHint === 'engine' ? 'Bereit – Trainer beginnt nach dem Start' : 'Bereit – wähle den Start' }
  if (s.pending) return { kind: 'waiting', text: `${name} wartet auf deine Antwort` }
  if (s.judging) return { kind: 'thinking', text: 'Lehrer prüft deinen Zug …' }
  if (s.thinking) return { kind: 'thinking', text: s.maiaLoading ? 'Maia lädt …' : `${name} denkt …` }
  return { kind: 'ready', text: s.myTurn ? 'Du bist am Zug' : `${name} ist bereit` }
}
