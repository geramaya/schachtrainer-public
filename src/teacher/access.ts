/** What the engine may show and what the player may ask for, as a pure function of the game state. Without a teacher it is a Wertungspartie: no helps at all while playing. */
export interface AccessInput {
  phase: 'setup' | 'play' | 'over'
  withTeacher: boolean
  thinking: boolean
  judging: boolean
  /** the end-of-game review runs */
  analysing: boolean
  helping: boolean
  /** a Fehler/Patzer is held */
  pending: boolean
  myTurn: boolean
  /** an earlier position is shown */
  browsing: boolean
  /** teacher game: the player lifted the lock on purpose (counts as a help) */
  engineUnlocked: boolean
  /** the engine field may also run while Stockfish thinks or the teacher judges */
  analyseWhileThinking: boolean
}
export interface Access {
  engineLock: 'task' | 'busy' | null
  /** the coach panel may run the engine (and recommend moves) */
  coachEngine: boolean
  /** "Hinweis" / "Bester Zug" may be used */
  canAsk: boolean
  /** the coach may draw arrows and circles */
  coachShapes: boolean
  /** the coach panel is shown at all (not in a Wertungspartie) */
  coachPanel: boolean
  /** board layers (attacks, threats, ...) are all off */
  layersLocked: boolean
}

export function access(s: AccessInput): Access {
  const playing = s.phase === 'play'
  const rated = playing && !s.withTeacher
  const busy = (s.thinking || s.judging) && !s.analyseWhileThinking ? 'busy' : null
  const engineLock = !playing ? (s.analysing ? 'busy' : null) : s.withTeacher && s.engineUnlocked ? busy : 'task'
  const coachEngine = !playing && !s.thinking && !s.analysing && !s.judging && !s.pending
  const canAsk = playing && s.withTeacher && !s.thinking && !s.judging && !s.helping && !s.pending && s.myTurn && !s.browsing
  return { engineLock, coachEngine, canAsk, coachShapes: !playing, coachPanel: !rated, layersLocked: rated }
}
