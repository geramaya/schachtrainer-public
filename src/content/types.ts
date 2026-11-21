export type Side = 'white' | 'black'
export type Status = 'entwurf' | 'engine-geprüft' | 'human-ok'
export interface Source { kind: 'dokument' | 'chess-openings' | 'stockfish' | 'lichess-explorer' | 'lichess-puzzles' | 'autor'; ref: string }
/** label = name shown to the user (e.g. a gambit name); note = build remark (e.g. veto), not for display as a name. */
export interface Candidate { uci: string; san: string; evalCp: number | null; source: Source; label?: string; note?: string }
/** ownMove=true: side to move is the side of the opening, candidates (>=1) with active index; false: replies = known opponent moves. */
export interface TreeNode { key: string; fen: string; ownMove: boolean; candidates: Candidate[]; active: number; replies: Candidate[] }
/** Introductory text of a variation (opening page). `draft`: written by the build from facts of the line, not yet a released text. */
export interface VariationIntro { text: string; source: Source; draft: boolean }
export interface Variation { id: string; name: string; nameEn: string; line: string[]; keyPositions: string[]; fromDocument: boolean; /** Identical to, or only the first part of, this more specific variation. */ partOf?: string; intro?: VariationIntro }
export type OpeningId = 'scotch' | 'smith-morra' | 'caro-kann' | 'budapest' | 'kings-indian' | 'italian' | 'alapin' | 'nimzo-indian' | 'tarrasch' | 'vienna'
export interface Opening { id: OpeningId; name: string; side: Side; entry: string[]; role: string; docRef: string; variations: Variation[] }
export interface Claim { kind: 'threat' | 'best' | 'blunder'; uci: string; verified?: { evalCp: number; depth: number } }
export interface Arrow { orig: string; dest: string; brush: 'green' | 'red' | 'blue' | 'yellow' | 'ceval' | 'cevalPale' }
export interface Explanation { id: string; key: string; title: string; text: string; arrows: Arrow[]; claims: Claim[]; status: Status; source: Source }
export interface Question { id: string; key: string; variationId: string; prompt: string; kind: 'move' | 'choice'; answerUci?: string; choices?: { text: string; correct: boolean }[]; explanationId: string }
export interface Puzzle { id: string; fen: string; moves: string[]; rating: number; popularity?: number; nbPlays?: number; themes: string[]; openingTags: string[]; url: string }
export interface Deviation { key: string; variationId: string; replyUci: string; punishUci: string; explanationId: string }
/** One tree per opening (keyed by opening id): openings share positions but not choices, so no tree is shared. */
export type Trees = Record<string, Record<string, TreeNode>>
export const BUNDLE_SCHEMA = 3
export interface ContentBundle { schemaVersion: typeof BUNDLE_SCHEMA; contentVersion: string; openings: Opening[]; trees: Trees; explanations: Explanation[]; questions: Question[]; deviations: Deviation[]; puzzles: Record<string, Puzzle[]> }
