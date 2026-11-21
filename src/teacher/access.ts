/** What the engine may show and what the player may ask for, as a pure function of the game state (the rule that keeps a teacher game free of unasked tips). */
export interface AccessInput {
  phase: 'setup' | 'play' | 'over'
  withTeacher: boolean
  /** free game (route "Spielen") */
  free: boolean
  /** free game without teacher: "Engine mitlaufen lassen" */
  along: boolean
  thinking: boolean
  judging: boolean
  /** the end-of-game review runs */
  analysing: boolean
  helping: boolean
  /** a Fehler/Patzer is held */
  pending: boolean
  myTurn: boolean
  /** the finished game is browsed */
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
  /** the coach may draw arrows and circles (not during a teacher game: tips only on request) */
  coachShapes: boolean
}

export function access(s: AccessInput): Access {
  const playing = s.phase === 'play'
  const busy = (s.thinking || s.judging) && !s.analyseWhileThinking ? 'busy' : null
  const engineLock = !playing ? (s.analysing ? 'busy' : null) : (s.free && !s.withTeacher && s.along) || (s.withTeacher && s.engineUnlocked) ? busy : 'task'
  const coachEngine = !s.thinking && !s.analysing && !s.judging && !s.pending && !(playing && (s.withTeacher || (s.free && !s.along)))
  const canAsk = playing && s.withTeacher && !s.thinking && !s.judging && !s.helping && !s.pending && s.myTurn && !s.browsing
  return { engineLock, coachEngine, canAsk, coachShapes: !(playing && s.withTeacher) }
}
