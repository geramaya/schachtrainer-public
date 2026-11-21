/**
 * Own training rating from Wertungspartien against Stockfish, per time category. This is NOT comparable with Lichess or FIDE: the opponent
 * is the Stockfish level set in the app (UCI_Elo), which is not calibrated against human ratings.
 *
 * Elo, not Glicko-2: every game has a single opponent of known fixed strength and the player has no inactivity or rating periods to model, so
 * the extra rating deviation and volatility of Glicko-2 (Glickman, "Example of the Glicko-2 system", 2013) would add state without adding
 * information. Expected score and update follow Elo (The Rating of Chessplayers, Past and Present, 1978); K = 40 for the first 30 games
 * of a category and 20 afterwards (the FIDE Handbook B.02 uses the same two steps for new and established players).
 */
export type Category = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'none'
export const CATEGORIES: Category[] = ['none', 'bullet', 'blitz', 'rapid', 'classical']
export const CATEGORY_LABEL: Record<Category, string> = { none: 'Ohne Zeit', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Schnellschach', classical: 'Klassisch' }
export const START_RATING = 1500
export const LEVEL_MIN = 1320
export const LEVEL_MAX = 2400

/** The part of a stored game the rating needs. */
export interface RatedGame {
  id: string
  /** ISO 8601 */
  date: string
  /** half-moves played */
  plies: number
  ownSide: 'white' | 'black' | null
  /** Stockfish level of the game */
  elo: number | null
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  reason: string | null
  /** PGN event: "Wertungspartie" counts, "Lernpartie" and everything else does not */
  event: string | null
  /** PGN TimeControl, "180+2" */
  timeControl: string | null
}

/** Lichess rule: estimated duration = base seconds + 40 * increment; < 180 s Bullet, < 480 Blitz, < 1500 Schnellschach, else Klassisch. */
export function categoryOf(timeControl: string | null): Category {
  const m = timeControl?.match(/^(\d+)\+(\d+)$/)
  if (!m) return 'none'
  const est = Number(m[1]) + 40 * Number(m[2])
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : est < 1500 ? 'rapid' : 'classical'
}

export const expectedScore = (rating: number, opponent: number): number => 1 / (1 + 10 ** ((opponent - rating) / 400))
export const kFactor = (gamesSoFar: number): number => (gamesSoFar < 30 ? 40 : 20)

export function updateRating(rating: number, opponent: number, score: number, gamesSoFar: number): { rating: number; delta: number } {
  const delta = Math.round(kFactor(gamesSoFar) * (score - expectedScore(rating, opponent)))
  return { rating: rating + delta, delta }
}

/** Score of the player (1, 0.5, 0) or null if the game does not count: only Wertungspartien of the player, not before move 2; a left game is a loss. */
export function scoreOf(g: RatedGame): number | null {
  if (g.event !== 'Wertungspartie' || !g.ownSide || g.elo === null || g.plies < 2) return null
  if (g.result === '1/2-1/2') return 0.5
  if (g.result === '*') return 0
  return (g.result === '1-0') === (g.ownSide === 'white') ? 1 : 0
}

export interface RatingEntry { id: string; date: string; category: Category; before: number; after: number; delta: number; opponent: number; score: number }

/** All counting games in chronological order, the rating per category after each game. A pure function of the games: it can be recomputed any time. */
export function replayRatings(games: RatedGame[]): { entries: RatingEntry[]; current: Record<Category, number> } {
  const current = Object.fromEntries(CATEGORIES.map((c) => [c, START_RATING])) as Record<Category, number>
  const played = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  const entries: RatingEntry[] = []
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const g of sorted) {
    const score = scoreOf(g)
    if (score === null) continue
    const category = categoryOf(g.timeControl)
    const u = updateRating(current[category], g.elo!, score, played[category])
    entries.push({ id: g.id, date: g.date, category, before: current[category], after: u.rating, delta: u.delta, opponent: g.elo!, score })
    current[category] = u.rating
    played[category]++
  }
  return { entries, current }
}

/** Advice for the next level: from the last 5 games of a category (at least 3), >= 60 % -> +100, <= 30 % -> -100. `level` = the Stockfish level set now. */
export function recommend(entries: RatingEntry[], category: Category, level: number): { level: number; text: string } | null {
  const last = entries.filter((e) => e.category === category).slice(-5)
  if (last.length < 3) return null
  const share = last.reduce((s, e) => s + e.score, 0) / last.length
  const clamp = (v: number) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, v))
  if (share >= 0.6) return { level: clamp(level + 100), text: `Du gewinnst meist gegen ${level} – probier ${clamp(level + 100)}.` }
  if (share <= 0.3) return { level: clamp(level - 100), text: `Gegen ${level} fällt es dir noch schwer – probier ${clamp(level - 100)}.` }
  return { level, text: `Gegen ${level} hältst du gut mit – bleib dabei, bis du mehr als die Hälfte gewinnst.` }
}
