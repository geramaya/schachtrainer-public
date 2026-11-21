import { ref } from 'vue'
import { Chess } from 'chess.js'
import { publicUrl } from './assetBase.ts'

export type SoundName = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'wrong' | 'end' | 'correct'
export type SoundSetId = 'holz' | 'sfx' | 'piano' | 'nes' | 'futuristic'
export const SOUND_SETS: { id: SoundSetId; label: string }[] = [
  { id: 'holz', label: 'Holz (eigene Synthese)' },
  { id: 'sfx', label: 'SFX' },
  { id: 'piano', label: 'Piano' },
  { id: 'nes', label: 'NES' },
  { id: 'futuristic', label: 'Futuristic' },
]
export interface SoundSettings { on: boolean; volume: number; set: SoundSetId }
export const DEFAULT_SOUND: SoundSettings = { on: true, volume: 0.7, set: 'holz' }
const KEY = 'schachtrainer.sound'
const DEBOUNCE_MS = 70

/** Sound of a move by its SAN. Priority: end (mate) > check > capture > promotion > castling > plain move. */
export function soundForSan(san: string): SoundName {
  if (san.includes('#')) return 'end'
  if (san.includes('+')) return 'check'
  if (san.includes('x')) return 'capture'
  if (san.includes('=')) return 'promote'
  if (san.startsWith('O-O')) return 'castle'
  return 'move'
}

const placementAndTurn = (fen: string) => fen.split(' ').slice(0, 2).join(' ')

/**
 * Sound for the step from one position to the next: only when `next` is reached by exactly one legal move from `prev`.
 * Jumps (Home/End), steps back, equal or invalid positions give null. A drawn end (stalemate etc.) also gives 'end'.
 */
export function soundForTransition(prev: string, next: string): SoundName | null {
  let game: Chess
  try { game = new Chess(prev) } catch { return null }
  const target = placementAndTurn(next)
  for (const m of game.moves({ verbose: true })) {
    const after = new Chess(prev)
    after.move(m.san)
    if (placementAndTurn(after.fen()) !== target) continue
    return after.isGameOver() ? 'end' : soundForSan(m.san)
  }
  return null
}

/**
 * File (below public/) for a sound in a set. The own set has all eight. The sets of Enigmahack (via lila) have no castling
 * or promotion sound (Lichess plays the move sound there too), and their Error file points to the non-free standard set,
 * so "wrong" is always our own tone.
 */
export function soundFile(set: SoundSetId, name: SoundName): string {
  if (set === 'holz' || name === 'wrong') return `sounds/${name}.mp3`
  return `sounds/${set}/${name === 'castle' || name === 'promote' ? 'move' : name}.mp3`
}

export function parseSoundSettings(raw: unknown): SoundSettings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const v = o.volume
  return {
    on: typeof o.on === 'boolean' ? o.on : DEFAULT_SOUND.on,
    volume: typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_SOUND.volume,
    set: SOUND_SETS.find((x) => x.id === o.set)?.id ?? DEFAULT_SOUND.set,
  }
}

const storage = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }

function load(): SoundSettings {
  try { const raw = storage()?.getItem(KEY); return parseSoundSettings(raw ? JSON.parse(raw) : undefined) } catch { return DEFAULT_SOUND }
}

export const soundSettings = ref<SoundSettings>(load())

export function setSoundSettings(patch: Partial<SoundSettings>): void {
  soundSettings.value = parseSoundSettings({ ...soundSettings.value, ...patch })
  try { storage()?.setItem(KEY, JSON.stringify(soundSettings.value)) } catch { /* storage blocked or full: the setting stays for this session */ }
}

const pool = new Map<string, HTMLAudioElement>()

/** Plays a sound now (if sounds are on). Never throws: blocked autoplay or a missing file just stays silent. */
export function playSound(name: SoundName, set: SoundSetId = soundSettings.value.set): void {
  if (!soundSettings.value.on || typeof Audio === 'undefined') return
  const file = soundFile(set, name)
  let a = pool.get(file)
  if (!a) { a = new Audio(publicUrl(file)); pool.set(file, a) }
  a.volume = soundSettings.value.volume
  a.currentTime = 0
  void a.play().catch(() => undefined)
}

const VERDICT_DELAY_MS = 180 // after the move sound of the same answer

/** Verdict of an exercise answer: wrong at once (the move was rejected), correct just after the move sound. */
export function playVerdict(ok: boolean): void {
  if (ok) setTimeout(() => playSound('correct'), VERDICT_DELAY_MS)
  else playSound('wrong')
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Board position changed: plays the sound of the move, debounced so quick clicking through moves sounds only the last one. */
export function soundOnPositionChange(prev: string, next: string): void {
  clearTimeout(timer)
  const name = soundForTransition(prev, next)
  if (name) timer = setTimeout(() => playSound(name), DEBOUNCE_MS)
}
