export type Stufe = 'kern' | 'erweiterung' | 'nachschlagen'
export const STUFEN: readonly Stufe[] = ['kern', 'erweiterung', 'nachschlagen']
export const PLAN_SECTIONS = ['Idee', 'Deine Züge', 'Pläne', 'Fallen', 'Wenn Unbekanntes kommt'] as const
/** Marker of a text that still has to be written; the build counts these and the pages show them as "Text folgt". */
export const TODO = 'TODO texter'
export const isTodo = (s: string): boolean => s.trim().startsWith(TODO)

/** What a sentence points at: arrows/circles ("Gd4c6", "Rc6"; see marks.ts, drawn on the board AFTER the move) and sources (text with a URL). Absent when empty. */
export interface Infos { pfeile?: string[]; felder?: string[]; quelle?: string[] }
/** Where a move of a line comes from: explorer data, own repertoire tree, or the engine (best move beyond the data limit). */
export type Herkunft = 'daten' | 'repertoire' | 'engine'
export interface Zug extends Infos { san: string; uci: string; satz: string; /** Set when the sentence comes from stellungen.json. */ status?: 'entwurf' | 'geprueft'; herkunft?: Herkunft; /** The move was added by the depth extension (its sentence is new work). */ neu?: true }
/** One memorable sentence of the goal box "Ziel dieser Variante". */
export interface Merksatz { satz: string; status?: 'entwurf' | 'geprueft'; quelle?: string[] }
export interface Variante { id: string; name: string; stufe: Stufe; anteil: number | null; haeufigkeit: string | null; vorlaeufig: boolean; veraltet: boolean; zuege: Zug[]; /** 2 to 3 sentences about the goal and intent of the line (empty while none are written). */ ziel: Merksatz[] }
/** A comment at a turning point of a model game: shown after `ply` plies (1 = after the first move), its marks refer to that board. */
export interface Kommentar extends Infos { ply: number; satz: string; status?: 'entwurf' | 'geprueft' }
export interface Musterpartie {
  id: string; titel: string; weiss: string; schwarz: string; jahr: number | string; event: string
  /** URL of the game record. */
  quelle: string
  /** A placeholder game: the moves are only a stand-in until the real game is chosen. */
  platzhalter: boolean
  zuege: { san: string; uci: string }[]
  kommentare: Kommentar[]
}
export interface Falle extends Infos { id: string; titel: string; fen: string; loesung: string; loesungUci: string; satz: string; platzhalter: boolean }
/** A board of a system page: the position (FEN) and the moves that lead there (empty when only a FEN is given), marks drawn on it. */
export interface SystemBrett extends Infos { fen: string; zuege: string[] }
export const SYSTEM_IDEE_IDS = ['struktur', 'figuren', 'plan-schwarz', 'plan-weiss', 'achten'] as const
export const SYSTEM_IDEE_TITEL: Record<(typeof SYSTEM_IDEE_IDS)[number], string> = { struktur: 'Struktur', figuren: 'Wohin die Figuren', 'plan-schwarz': 'Pläne Schwarz', 'plan-weiss': 'Pläne Weiß', achten: 'Worauf achten' }
export interface IdeeAbschnitt extends SystemBrett { id: string; titel: string; satz: string; status?: 'entwurf' | 'geprueft' }
/** A move of the main line or a branch; `plan` = id of the idea section the move serves. */
export interface HauptZug extends Zug { plan?: string }
/** A branch: the opponent deviates after `ab` plies of the main line; `zuege[0]` is the deviating move. */
export interface Ast { id: string; ab: number; satz: string; anteil: number | null; zuege: HauptZug[] }
/** A puzzle: `fen` with the solver to move; `loesung` = solver move, reply, solver move … (replies are played by the page). */
export interface Raetsel { id: string; fen: string; loesung: string[]; loesungUci: string[]; hinweis: string; satz: string; platzhalter: boolean; puzzleId?: string; rating?: number; themes?: string[]; url?: string }
export interface Motiv extends SystemBrett { id: string; titel: string; satz: string; status?: 'entwurf' | 'geprueft'; raetsel: Raetsel[] }
export interface System {
  id: string; titel: string
  /** The moves that define the system (1.e4 c6 2.d4 d5 3.e5 Bf5). */
  zuege: string[]
  idee: IdeeAbschnitt[]
  hauptlinie: { zuege: HauptZug[]; aeste: Ast[] }
  motive: Motiv[]
  musterpartien: Musterpartie[]
}
export interface Lehrgang {
  id: string; name: string; side: 'white' | 'black'; entry: string[]; band: string
  /** Date of the explorer run the shares come from, null while the data run has not happened. */
  abruf: string | null
  spielplan: { titel: string; text: string }[]
  varianten: Variante[]; fallen: Falle[]; musterpartien: Musterpartie[]
  /** Systems (idea, main line, motifs, model games); absent when the Lehrgang has none. */
  systeme?: System[]
  /** Number of texts still marked TODO. */
  offen: number
}
export const LEHRGANG_SCHEMA = 1
export interface LehrgangBundle { schemaVersion: typeof LEHRGANG_SCHEMA; lehrgaenge: Lehrgang[] }
