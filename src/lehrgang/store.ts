import type { Lehrgang, Stufe } from './types.ts'

/** Own storage area: the Lehrgang progress never touches the progress of the Repertoire courses ("schachtrainer-v1"). */
export const LEHRGANG_KEY = 'schachtrainer-lehrgang-v1'
export type Step = 'vorfuehren' | 'gefuehrt' | 'kopf'
export interface LehrgangState { version: 1; varianten: Record<string, Partial<Record<Step, true>>>; fallen: Record<string, true> }

export const emptyState = (): LehrgangState => ({ version: 1, varianten: {}, fallen: {} })

const isState = (x: unknown): x is LehrgangState => {
  const s = x as Partial<LehrgangState> | null
  return !!s && s.version === 1 && typeof s.varianten === 'object' && s.varianten !== null && typeof s.fallen === 'object' && s.fallen !== null
}

export function loadState(storage: Storage): LehrgangState {
  try {
    const raw = storage.getItem(LEHRGANG_KEY)
    const x: unknown = raw ? JSON.parse(raw) : null
    return isState(x) ? x : emptyState()
  } catch { return emptyState() }
}

/** False if the browser refused to store (full or blocked). */
export function saveState(storage: Storage, s: LehrgangState): boolean {
  try { storage.setItem(LEHRGANG_KEY, JSON.stringify(s)); return true } catch { return false }
}

export const markStep = (s: LehrgangState, lehrgang: string, variante: string, step: Step): LehrgangState => {
  const k = `${lehrgang}/${variante}`
  return { ...s, varianten: { ...s.varianten, [k]: { ...s.varianten[k], [step]: true } } }
}
export const markFalle = (s: LehrgangState, lehrgang: string, falle: string): LehrgangState => ({ ...s, fallen: { ...s.fallen, [`${lehrgang}/${falle}`]: true } })

/** A variety counts as done when it was played from memory ("Aus dem Kopf"). */
export function stufeFortschritt(s: LehrgangState, l: Pick<Lehrgang, 'id' | 'varianten'>, stufe: Stufe): { done: number; total: number } {
  const vs = l.varianten.filter((v) => v.stufe === stufe)
  return { done: vs.filter((v) => s.varianten[`${l.id}/${v.id}`]?.kopf).length, total: vs.length }
}

/** For the backup (own file or later a part of the app backup): plain JSON text. */
export const exportState = (s: LehrgangState): string => JSON.stringify(s)
export function importState(text: string): LehrgangState {
  let x: unknown
  try { x = JSON.parse(text) } catch { throw new Error('Lehrgang-Stand: keine gültige Datei.') }
  if (!isState(x)) throw new Error('Lehrgang-Stand: unbekanntes Format.')
  return x
}
