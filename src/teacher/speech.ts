import { computed, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { avatarMood } from './mood.ts'
import { pickQuip } from './quips.ts'
import type { QuipCategory, QuipFacts } from './quips.ts'
import { QUIPS } from './quips-data.ts'
import type { TeacherSettings } from './avatar.ts'
import { hasQuipAudio } from '../audio/quip-audio.ts'
import { loadAudioManifest } from '../audio/manifest.ts'
import { playQuip, stopQuip } from '../audio/play-quip.ts'
import { parseTalk, DEFAULT_TALK } from './commentary.ts'
import type { TalkSettings } from './commentary.ts'

/** How long an event feeling and a quip stay at the avatar. */
export const QUIP_SHOWN_MS = 9000

interface SpeechOptions {
  teacher: Ref<TeacherSettings>
  /** the teacher speaks at all (a game with teacher, the switch at the board) */
  enabled: () => boolean
  /** something waits for a decision: feeling and quip stay */
  hold?: () => boolean
  /** varies the quip choice per position, e.g. the number of half-moves */
  seedKey: () => string | number
}

/**
 * Feeling and quip of the teacher: the event of the last half-move shows at the avatar for QUIP_SHOWN_MS, then the
 * position (evaluation); a quip is picked per event (never repeating), optionally spoken. Shared by the sparring game,
 * the saved-game view and the analysis board.
 */
export function useTeacherSpeech(o: SpeechOptions) {
  const eventMood = ref<QuipCategory | null>(null)
  const positionCp = ref<number | null>(null)
  const quip = ref('')
  const audioAvailable = ref(false)
  const mood = computed(() => avatarMood(o.teacher.value.figur, eventMood.value, positionCp.value))
  let spoken: string[] = [] // against repetition
  let moodTimer: ReturnType<typeof setTimeout> | undefined
  let quipTimer: ReturnType<typeof setTimeout> | undefined
  const hold = () => !!o.hold?.()

  function setMood(category: QuipCategory | undefined) {
    if (!o.enabled() || !category) return
    clearTimeout(moodTimer)
    eventMood.value = category
    moodTimer = setTimeout(() => { if (!hold()) eventMood.value = null }, QUIP_SHOWN_MS)
  }
  const clearQuip = () => { clearTimeout(quipTimer); quip.value = '' }
  function say(categories: readonly QuipCategory[], facts: QuipFacts, seed: string) {
    setMood(categories[0])
    if (!o.teacher.value.quips || !o.enabled()) return
    const q = pickQuip(QUIPS, o.teacher.value.figur, categories, facts, `${o.seedKey()}|${seed}`, spoken)
    if (!q) return
    spoken = [...spoken, q]
    clearQuip()
    quip.value = q
    quipTimer = setTimeout(() => { if (!hold()) quip.value = '' }, QUIP_SHOWN_MS)
    if (o.teacher.value.speak && audioAvailable.value) void playQuip(o.teacher.value.figur, q)
  }
  /** New game or position series: nothing said so far. */
  function reset() {
    clearQuip(); stopQuip(); spoken = []
    clearTimeout(moodTimer); eventMood.value = null; positionCp.value = null
  }
  const silence = () => { clearTimeout(moodTimer); clearQuip(); stopQuip() }

  onMounted(() => { void loadAudioManifest().then((m) => { audioAvailable.value = hasQuipAudio(m) }) })
  onDeactivated(() => { clearQuip(); stopQuip() })
  onBeforeUnmount(silence)
  return { eventMood, positionCp, mood, quip, audioAvailable, setMood, say, clearQuip, reset }
}

const KEY = 'schachtrainer.teachertalk'
const storage = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }
function loadTalk(): TalkSettings {
  try { const raw = storage()?.getItem(KEY); return parseTalk(raw ? JSON.parse(raw) : undefined) } catch { return DEFAULT_TALK }
}
/** Where the teacher talks (saved game view, analysis board): persistent, shared by all views. */
export const talk = ref<TalkSettings>(loadTalk())
export function setTalk(patch: Partial<TalkSettings>): void {
  talk.value = parseTalk({ ...talk.value, ...patch })
  try { storage()?.setItem(KEY, JSON.stringify(talk.value)) } catch { /* blocked or full: stays for this session */ }
}
