import type { Opening } from './types.ts'

/** Systems of the start page: the main stack of the document first, then the alternatives (phase 2); entries not yet in the bundle show as "In Vorbereitung". */
export type CatalogEntry = Pick<Opening, 'id' | 'name' | 'side' | 'entry' | 'role'> & { entryText?: string; code: string; acc: string; group: 'main' | 'alt' }

export const CATALOG: CatalogEntry[] = [
  { id: 'scotch', code: 'SCO', group: 'main', acc: 'var(--op-sco)', name: 'Schottische Partie', side: 'white', entry: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], role: 'Main Backend gegen 1…e5' },
  { id: 'smith-morra', code: 'SMG', group: 'main', acc: 'var(--op-smg)', name: 'Smith-Morra-Gambit', side: 'white', entry: ['e4', 'c5', 'd4', 'cxd4', 'c3'], role: 'Gegen das Sizilianische' },
  { id: 'caro-kann', code: 'CK', group: 'main', acc: 'var(--op-ck)', name: 'Caro-Kann', side: 'black', entry: ['e4', 'c6', 'd4', 'd5'], role: 'Die Festung gegen 1. e4' },
  { id: 'budapest', code: 'BUD', group: 'main', acc: 'var(--op-bud)', name: 'Budapester Gambit', side: 'black', entry: ['d4', 'Nf6', 'c4', 'e5'], role: 'Gegen 1. d4' },
  { id: 'kings-indian', code: 'KID', group: 'main', acc: 'var(--op-kid)', name: 'Königsindischer Aufbau', side: 'black', entry: [], entryText: 'Aufbau mit …g6, …Lg7, …d6', role: 'Fallback gegen 1. c4 / 1. Sf3' },
  { id: 'italian', code: 'ITA', group: 'alt', acc: 'var(--op-ita)', name: 'Italienische Partie', side: 'white', entry: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], role: 'Alternative gegen 1…e5' },
  { id: 'alapin', code: 'ALA', group: 'alt', acc: 'var(--op-ala)', name: 'Alapin-Variante', side: 'white', entry: ['e4', 'c5', 'c3'], role: 'Ruhige Alternative gegen das Sizilianische' },
  { id: 'nimzo-indian', code: 'NIM', group: 'alt', acc: 'var(--op-nim)', name: 'Nimzo-Indisch', side: 'black', entry: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], role: 'Alternative gegen 1. d4' },
  { id: 'tarrasch', code: 'TAR', group: 'alt', acc: 'var(--op-tar)', name: 'Tarrasch-Verteidigung', side: 'black', entry: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'c5'], role: 'Solide Alternative gegen 1. d4' },
  { id: 'vienna', code: 'WIE', group: 'alt', acc: 'var(--op-wie)', name: 'Wiener Partie', side: 'white', entry: ['e4', 'e5', 'Nc3'], role: 'Alternative gegen 1…e5' },
]

/** Service colour of an opening (a CSS value for `--acc`); neutral for ids outside the catalog. */
export const accentFor = (id: string): string => CATALOG.find((c) => c.id === id)?.acc ?? 'var(--muted)'
