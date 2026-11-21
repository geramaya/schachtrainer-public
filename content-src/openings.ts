export type OpeningId =
  | 'scotch' | 'smith-morra' | 'caro-kann' | 'budapest' | 'kings-indian'
  | 'italian' | 'alapin' | 'nimzo-indian' | 'tarrasch' | 'vienna'

export interface OwnChoice { san: string; label?: string }

export interface OpeningSpec {
  id: OpeningId
  name: string
  side: 'white' | 'black'
  /** SAN moves from the start position, both sides; given by the repertoire document. */
  entry: string[]
  role: string
  docRef: string
  /** Key: SAN line up to (not including) the own move, space separated. First choice is active. */
  ownChoices: Record<string, OwnChoice[]>
  /** Prefixes of chess-openings names that belong to this opening. */
  variationNames: string[]
  /** Lichess puzzle opening-tag prefixes (verified in the puzzle CSV); default: derived from variationNames. */
  puzzleTags?: string[]
  /** Further document lines (SAN from the start), e.g. opponent deviations with the planned answer. */
  extraEntries?: string[][]
  /** Variations defined by hand (no chess-openings name needed): the whole line, own moves from the document. */
  extraVariations?: { name: string; nameEn: string; line: string[] }[]
}

const DOC = 'docs/repertoire-v1.8.md'

/** Scotch is the pattern (document choices checked against the document); the other four are drafts for the next step. */
export const OPENINGS: OpeningSpec[] = [
  {
    id: 'scotch', name: 'Schottische Partie', side: 'white', entry: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    role: 'Main Backend gegen 1…e5', docRef: `${DOC} Abschnitt 5`,
    ownChoices: { 'e4 e5 Nf3 Nc6 d4 exd4': [{ san: 'Nxd4' }, { san: 'Bc4', label: 'Schottisches Gambit' }] },
    variationNames: ['Scotch Game'],
    extraEntries: [['e4', 'e5', 'Nf3', 'd6', 'd4'], ['e4', 'e5', 'Nf3', 'Nf6', 'd4']],
  },
  {
    id: 'smith-morra', name: 'Smith-Morra-Gambit', side: 'white', entry: ['e4', 'c5', 'd4', 'cxd4', 'c3'],
    role: 'Gegen das Sizilianische', docRef: `${DOC} Abschnitt 5`, ownChoices: {},
    extraEntries: [['e4', 'c5', 'd4', 'd5', 'exd5']],
    variationNames: ['Sicilian Defense: Smith-Morra Gambit'],
  },
  {
    id: 'caro-kann', name: 'Caro-Kann', side: 'black', entry: ['e4', 'c6', 'd4', 'd5'],
    role: 'Die Festung gegen 1. e4', docRef: `${DOC} Abschnitt 6`, ownChoices: {},
    variationNames: ['Caro-Kann Defense'],
    // lines of the key positions (own moves first, so they win against the theory counts)
    extraEntries: [
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4 Nxd4 Ne7'.split(' '),
      'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7'.split(' '),
      'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6'.split(' '),
      'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Bb4 cxd5 Nxd5 Bd2 Nc6 Bd3 Nf6 O-O O-O'.split(' '),
      'e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6 Be2 Nf6'.split(' '),
      'e4 c6 Nf3 d5'.split(' '), 'e4 c6 c4 d5'.split(' '), 'e4 c6 d3 d5'.split(' '),
    ],
  },
  {
    id: 'budapest', name: 'Budapester Gambit', side: 'black', entry: ['d4', 'Nf6', 'c4', 'e5'],
    role: 'Gegen 1. d4', docRef: `${DOC} Abschnitt 6`,
    ownChoices: { 'd4 Nf6 c4 e5 dxe5': [{ san: 'Ng4' }] },
    variationNames: ['Indian Defense: Budapest Gambit'], puzzleTags: ['Indian_Defense_Budapest_Defense'],
    extraEntries: [
      'd4 Nf6 c4 e5 dxe5 Ng4 Nf3 Nc6 Bf4 Bb4+ Nc3 Qe7 Bd2 Ncxe5'.split(' '),
      'd4 Nf6 c4 e5 dxe5 Ng4 e4 Nxe5 a3 g6 f4 Nec6 Bd2 d6 Nf3 Bh6'.split(' '),
    ],
    extraVariations: [
      { name: 'Budapester Falle: das erstickte Matt', nameEn: 'Budapest Gambit: Smothered Mate Trap',
        line: 'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7 a3 Ngxe5 axb4 Nd3'.split(' ') },
      { name: 'Budapester abgelehnt: 3. d5', nameEn: 'Budapest Gambit Declined: 3 d5',
        line: 'd4 Nf6 c4 e5 d5 Bb4+ Bd2 a5 e3 Na6 Bd3 Nc5 Bc2 Nfe4'.split(' ') },
      { name: 'Budapester abgelehnt: 3. e3', nameEn: 'Budapest Gambit Declined: 3 e3',
        line: 'd4 Nf6 c4 e5 e3 Bb4+ Bd2 Bxd2+ Qxd2 exd4 Qxd4 Nc6'.split(' ') },
    ],
  },
  {
    id: 'kings-indian', name: 'Königsindischer Aufbau', side: 'black', entry: ['d4', 'Nf6', 'Nf3', 'g6'],
    role: 'Fallback gegen 1. c4 / 1. Sf3', docRef: `${DOC} Abschnitt 6`, ownChoices: {},
    // the document gives a setup (g6, Bg7, d6, O-O), not chess-openings lines (those start 2 c4 g6, the Budapest branch)
    variationNames: [], puzzleTags: ['Kings_Indian_Defense'],
    extraVariations: [
      { name: 'Aufbau gegen 1. c4', nameEn: 'Kings Indian Setup vs 1 c4', line: 'c4 g6 Nc3 Bg7 g3 d6 Bg2 Nf6 Nf3 O-O d4 c5 d5 Re8'.split(' ') },
      { name: 'Aufbau gegen 1. Sf3', nameEn: 'Kings Indian Setup vs 1 Nf3', line: 'Nf3 g6 g3 Bg7 Bg2 d6 O-O Nf6 c4 c5 d4 O-O d5 Re8'.split(' ') },
      { name: 'Aufbau gegen 1. d4 Sf6 2. Sf3', nameEn: 'Kings Indian Setup vs 1 d4 2 Nf3', line: 'd4 Nf6 Nf3 g6 c4 Bg7 Nc3 O-O e4 d6 Be2 e5 O-O exd4 Nxd4 Re8'.split(' ') },
      { name: 'Aufbau gegen den Londoner Aufbau (2. Lf4)', nameEn: 'Kings Indian Setup vs London 2 Bf4', line: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 b6'.split(' ') },
      { name: 'Aufbau gegen 1. d4 Sf6 2. g3', nameEn: 'Kings Indian Setup vs 1 d4 2 g3', line: 'd4 Nf6 g3 g6 Bg2 Bg7 Nf3 O-O O-O d6 c4 c5'.split(' ') },
    ],
  },
  {
    id: 'italian', name: 'Italienische Partie', side: 'white', entry: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    role: 'Alternative gegen 1…e5 (aggressive Varianten)', docRef: `${DOC} Abschnitt 5`,
    ownChoices: {
      'e4 e5 Nf3 Nc6 Bc4 Bc5': [{ san: 'b4', label: 'Evans-Gambit' }],
      'e4 e5 Nf3 Nc6 Bc4 Nf6': [{ san: 'Ng5', label: 'Fried Liver / Springerangriff' }],
    },
    variationNames: ['Italian Game'],
  },
  {
    id: 'alapin', name: 'Alapin-Variante', side: 'white', entry: ['e4', 'c5', 'c3'],
    role: 'Option B (solide) gegen das Sizilianische', docRef: `${DOC} Abschnitt 5`,
    ownChoices: {},
    extraEntries: [['e4', 'c5', 'c3', 'd5', 'exd5', 'Qxd5', 'd4'], ['e4', 'c5', 'c3', 'Nf6', 'e5', 'Nd5', 'd4'], ['e4', 'c5', 'c3', 'd6', 'd4'], ['e4', 'c5', 'c3', 'e6', 'd4'], ['e4', 'c5', 'c3', 'g6', 'd4']],
    variationNames: ['Sicilian Defense: Alapin Variation'],
  },
  {
    id: 'nimzo-indian', name: 'Nimzo-Indisch', side: 'black', entry: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    role: 'Option B (stabil) gegen 1. d4', docRef: `${DOC} Abschnitt 6`,
    ownChoices: { 'd4 Nf6 c4 e6 Nc3': [{ san: 'Bb4' }] },
    variationNames: ['Nimzo-Indian Defense'],
    extraEntries: [['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3', 'c5', 'g3', 'cxd4', 'Nxd4', 'O-O'], ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5']],
  },
  {
    id: 'tarrasch', name: 'Tarrasch-Verteidigung', side: 'black', entry: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5'],
    role: 'Option C (aktiv) gegen 1. d4', docRef: `${DOC} Abschnitt 6`,
    ownChoices: { 'd4 d5 c4 e6 Nc3': [{ san: 'c5' }] },
    variationNames: ['Tarrasch Defense', "Queen's Gambit Declined: Tarrasch Defense"],
    extraEntries: [['d4', 'd5', 'c4', 'e6', 'e3', 'Nf6']],
  },
  {
    id: 'vienna', name: 'Wiener Partie', side: 'white', entry: ['e4', 'e5', 'Nc3'],
    role: 'Sicherheits-Hybrid gegen 1…e5', docRef: `${DOC} Abschnitt 8`,
    // the document names only 2. Nc3 and the Vienna Gambit 3. f4; the quiet first choice 3. Nf3 is an assumption (Bauern e4/d3)
    ownChoices: { 'e4 e5 Nc3 Nc6': [{ san: 'Nf3' }, { san: 'f4', label: 'Wiener Gambit' }] },
    variationNames: ['Vienna Game', 'Vienna Gambit'],
    extraEntries: [['e4', 'e5', 'Nc3', 'd5', 'Nxd5'], ['e4', 'e5', 'Nc3', 'g6', 'd4']],
  },
]
