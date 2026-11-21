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
}
export interface Access {
  engineLock: 'task' | 'busy' | null
  /** the coach panel may run the engine (and recommend moves) */
  coachEngine: boolean
  /** "Hinweis" / "Bester Zug" may be used */
  canAsk: boolean
}

export function access(s: AccessInput): Access {
  const playing = s.phase === 'play'
  const engineLock = !playing ? (s.analysing ? 'busy' : null) : s.free && !s.withTeacher && s.along ? (s.thinking || s.judging ? 'busy' : null) : 'task'
  const coachEngine = !s.thinking && !s.analysing && !s.judging && !s.pending && !(playing && (s.withTeacher || (s.free && !s.along)))
  const canAsk = playing && s.withTeacher && !s.thinking && !s.judging && !s.helping && !s.pending && s.myTurn && !s.browsing
  return { engineLock, coachEngine, canAsk }
}
