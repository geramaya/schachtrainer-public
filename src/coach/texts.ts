import type { Side } from '../content/types.ts'

/** Fixed text blocks of the coach. No sentence is invented anywhere else: every statement is built from these. */
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

const NAME: Record<PieceType, { nom: string; acc: string }> = {
  p: { nom: 'Bauer', acc: 'Bauern' }, n: { nom: 'Springer', acc: 'Springer' }, b: { nom: 'Läufer', acc: 'Läufer' },
  r: { nom: 'Turm', acc: 'Turm' }, q: { nom: 'Dame', acc: 'Dame' }, k: { nom: 'König', acc: 'König' },
}
export const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

/** "der Springer" / "den Bauern" etc.; the article is masculine except for "die Dame". */
export const the = (t: PieceType, acc = false): string => `${t === 'q' ? 'die' : acc ? 'den' : 'der'} ${acc ? NAME[t].acc : NAME[t].nom}`
export const pieceName = (t: PieceType): string => NAME[t].nom
export const sideName = (s: Side): string => (s === 'white' ? 'Weiß' : 'Schwarz')
export const other = (s: Side): Side => (s === 'white' ? 'black' : 'white')

type Kind = 'haengend' | 'gabel' | 'fesselung' | 'spiess' | 'abzug' | 'koenigsziel'
export interface MotifFacts { piece: PieceType; target?: PieceType; behind?: PieceType; squares: string[]; owner?: Side; undefended?: boolean; attackers?: number; defenders?: number }

export function motifText(kind: Kind, f: MotifFacts): string {
  const [a, b, c] = f.squares as [string, string?, string?]
  switch (kind) {
    case 'haengend':
      return `${cap(the(f.piece))} auf ${a} (${f.owner ? sideName(f.owner) : '?'}) ist angegriffen und ${f.undefended ? 'nicht gedeckt' : 'nur schlecht gedeckt (ein billigerer Angreifer)'}.`
    case 'gabel':
      return `${cap(the(f.piece))} auf ${a} greift gleichzeitig ${f.squares.slice(1).map((s, i) => `${i ? ' und ' : ''}${s}`).join('')} an (Gabel): nicht beide Ziele lassen sich retten.`
    case 'fesselung':
      return `${cap(the(f.piece))} auf ${a} fesselt ${the(f.target!, true)} auf ${b} an ${the(f.behind!, true)} auf ${c}: Er kann kaum ziehen.`
    case 'spiess':
      return `${cap(the(f.piece))} auf ${a} greift ${the(f.target!, true)} auf ${b} an; weicht sie aus, fällt ${the(f.behind!)} auf ${c} (Spieß).`
    case 'abzug':
      return `Zieht ${the(f.target!)} auf ${b} weg, greift ${the(f.piece)} auf ${a} ${f.behind === 'k' ? 'den König' : `${the(f.behind!, true)}`} auf ${c} an (Abzug).`
    case 'koenigsziel':
      return `${a} neben dem König ist ein Angriffsziel: ${f.attackers} Angreifer gegen ${f.defenders} Verteidiger.`
  }
}

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export const FILE_LIST = (files: string[]): string => files.join(', ')

export const BOOK_TEXT = {
  theorie: 'Das ist Theorie (Zug aus dem Buch).',
  abweichung: 'Das ist eine Abweichung vom Buch.',
  ausserhalb: 'Die Stellung liegt außerhalb des Buches.',
} as const

export const SEVERITY_TEXT = { ungenau: 'Ungenau', fehler: 'Fehler', patzer: 'Patzer' } as const

/** Evaluation in pawn units with German decimal comma and a real minus sign, e.g. "+0,35" / "−1,20". */
export const fmtCp = (cp: number): string => `${cp < 0 ? '−' : '+'}${(Math.abs(cp) / 100).toFixed(2).replace('.', ',')}`

/** Mate scores arrive as plus/minus this many centipawns (see scoreCp). */
export const MATE_CP = 10000
export const isMateCp = (cp: number): boolean => Math.abs(cp) >= MATE_CP

/** Like fmtCp, but a mate score is named as mate for a side, never shown as a pawn value. */
export const fmtScore = (cp: number): string => (isMateCp(cp) ? `Matt für ${cp > 0 ? 'Weiß' : 'Schwarz'}` : fmtCp(cp))

export const QUIET = 'Ruhige Stellung: keine Drohung, keine hängende Figur.'
