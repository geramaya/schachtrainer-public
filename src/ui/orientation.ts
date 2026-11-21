import { ref } from 'vue'
import type { Side } from '../content/types.ts'

export type Pov = 'white' | 'bottom'

/** Board orientation when a view opens: the own side of the game if there is one, otherwise White at the bottom. */
export const startOrientation = (ownSide: Side | null | undefined): Side => ownSide ?? 'white'
export const flipSide = (s: Side): Side => (s === 'white' ? 'black' : 'white')
/** Which side stands at the top and which at the bottom of the board (the player bars follow). */
export const barSides = (orientation: Side): { top: Side; bottom: Side } => ({ top: flipSide(orientation), bottom: orientation })

/** Sign for scores (given from White view): from the side at the bottom they flip when Black is at the bottom. */
export const povSign = (pov: Pov, orientation: Side): 1 | -1 => (pov === 'bottom' && orientation === 'black' ? -1 : 1)
export const povScore = (whiteCp: number, pov: Pov, orientation: Side): number => whiteCp * povSign(pov, orientation)

export const parsePov = (raw: unknown): Pov => (raw === 'bottom' ? 'bottom' : 'white')
export function parseFlips(raw: unknown): Record<string, Side> {
  const out: Record<string, Side> = {}
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (v === 'white' || v === 'black') out[k] = v
  return out
}

const storage = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }
const read = (key: string): unknown => { try { const raw = storage()?.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null } }
const write = (key: string, v: unknown) => { try { storage()?.setItem(key, JSON.stringify(v)) } catch { /* stays for this session */ } }

/** Evaluation from the view of White (Lichess default) or of the side at the bottom; remembered. */
export const evalPov = ref<Pov>(parsePov(read('schachtrainer.evalpov')))
export function setEvalPov(p: Pov): void { evalPov.value = p; write('schachtrainer.evalpov', p) }

const flips = ref<Record<string, Side>>(parseFlips(read('schachtrainer.flips')))
/** The remembered orientation of a view (null = none yet: use the start orientation). */
export const savedOrientation = (view: string): Side | null => flips.value[view] ?? null
export function rememberOrientation(view: string, o: Side): void { flips.value = { ...flips.value, [view]: o }; write('schachtrainer.flips', flips.value) }
