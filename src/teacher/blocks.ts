import { toGermanSan } from '../chess/notation.ts'
import { cap, the } from '../coach/texts.ts'
import type { Rating } from './judge.ts'
import type { Fact } from './facts.ts'

/** Fixed sentence blocks of the teacher. Several wordings per category; the choice is a hash of position and move (stable for tests, varied in play). */
export const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const pick = (seed: string, variants: string[]): string => variants[hash(seed) % variants.length]!
const de = toGermanSan

/** "1 Bauerneinheit" / "3 Bauerneinheiten". */
export const units = (n: number): string => `${n} ${n === 1 ? 'Bauerneinheit' : 'Bauerneinheiten'}`

/** One sentence per category; `variants` = number of wordings, listed in BLOCKS for the report. */
export function factSentence(f: Fact, seed: string): string {
  switch (f.kind) {
    case 'mate-allowed': {
      const san = f.san ? de(f.san) : '…'
      const base = pick(seed, [`Das lässt Matt in ${f.n} zu (${san}).`, `Achtung, Matt in ${f.n}: Der Gegner beginnt mit ${san}.`])
      return f.backRank ? `${base} Grundreihenmatt: Dein König hat keine Fluchtfelder, die eigenen Figuren davor blockieren ihn.` : base
    }
    case 'mate-missed':
      return pick(seed, ['Du hast eine viel stärkere Fortsetzung verpasst.', 'Hier war viel mehr drin: Du hast eine viel stärkere Fortsetzung verpasst.'])
    case 'promotion':
      return pick(seed, [`Das lässt eine Umwandlung auf ${f.square} zu (${de(f.san)}).`, `Umwandlung auf ${f.square}: Der Gegner spielt ${de(f.san)}.`])
    case 'hanging': {
      return f.undefended
        ? pick(seed, [`${cap(the(f.piece))} auf ${f.square} steht ungedeckt – der Gegner schlägt mit ${de(f.san)}.`, `Ungedeckt: ${cap(the(f.piece))} auf ${f.square} fällt durch ${de(f.san)}.`])
        : pick(seed, [`${cap(the(f.piece))} auf ${f.square} wird mit ${de(f.san)} geschlagen – der Angreifer ist weniger wert.`, `Mit ${de(f.san)} verlierst du ${the(f.piece, true)} auf ${f.square} an einen billigeren Angreifer.`])
    }
    case 'motif':
      return pick(seed, [`Der Gegner zieht ${de(f.san)}. ${f.text}`, `Folge: ${de(f.san)}. ${f.text}`])
    case 'material':
      return f.mode === 'loss'
        ? pick(seed, [`Nach kurzer Folge (${f.line}) stehst du ${units(f.pawns)} schlechter.`, `Die Folge ${f.line} kostet dich ${units(f.pawns)} Material.`])
        : pick(seed, [`Du lässt Material liegen: In dieser Stellung waren ${units(f.pawns)} mehr zu holen.`, `Hier lässt du Material liegen – ${units(f.pawns)} mehr waren drin.`])
  }
}

export const PRAISE_BEST = ['Bester Zug.', 'Genau – das ist der beste Zug.', 'Stark, Stockfish würde genauso ziehen.']
/** Never names the better move: that is shown only on request. */
export const PRAISE_GOOD = ['Gut gespielt, der Unterschied zum Besten ist klein.', 'Solider Zug.']
export const PRAISE_EXCELLENT = ['Exzellent – fast so gut wie der beste Zug.', 'Exzellenter Zug.']
export const LABEL: Record<Rating, string> = { best: 'Bester Zug', excellent: 'Exzellent', gut: 'Gut', ungenau: 'Ungenau', fehler: 'Fehler', patzer: 'Patzer' }
/** The same symbols as the analysis (category.ts). */
export const SYMBOL: Record<Rating, string> = { best: '★', excellent: '✓✓', gut: '✓', ungenau: '?!', fehler: '?', patzer: '??' }

export const BOOK_NOTES = {
  treffer: (san: string) => [`Repertoirezug ✓ (${san}).`, `Das ist dein Repertoirezug: ${san} ✓.`],
  /** Never names the planned move: it is shown only on request ("Repertoirezug zeigen"). */
  abweichung: ['Hier weichst du von deinem Repertoire ab.'],
  abweichungPlan: (planned: string) => [`Hier weichst du von deinem Repertoire ab: geplant war ${planned}.`, `Abweichung vom Repertoire – geplant war ${planned}.`],
  gegner: ['Dein Gegner verlässt die Theorie.', 'Der Gegner spielt keinen Buchzug mehr – ab hier zählt eigenes Denken.'],
} as const

export { pick }
