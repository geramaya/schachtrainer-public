<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { Chess } from 'chess.js'
import type { Arrow, ContentBundle, Side, Variation } from '../content/types.ts'
import { nodeOfVariation, openingOfVariation } from '../content/tree.ts'
import { cardId } from '../train/srs.ts'
import { applyUci } from '../chess/game.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { describeResult, gameStatus } from '../chess/status.ts'
import { CancelledError, EngineError } from '../engine/service.ts'
import { engineErrorText } from '../content/fetch-bundle.ts'
import { cancelEngine, getEngine, resetEngine } from '../engine/instance.ts'
import { bookExit, cardsFromErrors, drawAccepted, evaluatePositions, gameFens, reviewErrors, scoreCp } from '../train/review.ts'
import type { ReviewError } from '../train/review.ts'
import { markApplied, progress, update } from '../store/state.ts'
import { isFlipKey, isHintKey, shouldHandleKey } from '../ui/keys.ts'
import { engineStatus, historyNotice, historyTarget } from '../ui/history.ts'
import { canStartByMove, flipIntent, parseSideChoice, resolveSide } from '../train/free-start.ts'
import type { SideChoice } from '../train/free-start.ts'
import { HOLD_MODES, holds, parseHold } from '../teacher/hold.ts'
import { EXPLAIN_MODES, autoExplain, parseExplain } from '../teacher/explain.ts'
import { engineSettings, setEngineSettings } from '../ui/useEngineSettings.ts'
import HoldBar from '../ui/HoldBar.vue'
import Icon from '../ui/Icon.vue'
import TimeControlPick from '../ui/TimeControlPick.vue'
import KingIcon from '../ui/KingIcon.vue'
import { clockPaused, engineMoveMs, holdSuggestion, flagWinner, flagged, formatClock, isLow, newClock, parseTimeControl, pause, pgnTimeControl, press, remaining, resume, rewind } from '../train/clock.ts'
import type { Clock, TimeControl } from '../train/clock.ts'
import PlayerBar from '../ui/PlayerBar.vue'
import { barSides, flipSide } from '../ui/orientation.ts'
import { applySparringId } from '../train/pipeline.ts'
import { hrefPartien } from '../router.ts'
import { bookPliesOf, gameRecord, pickOpening } from '../train/free-play.ts'
import type { GameRecord, Outcome } from '../train/free-play.ts'
import { addResults, saveGame, setNote } from '../games/library.ts'
import { createNoteSaver, deferredNoteSave } from '../games/note-saver.ts'
import type { NoteStatus } from '../games/note-saver.ts'
import { identityOf } from '../games/identity.ts'
import { loadEco } from '../openings/eco-load.ts'
import { detectOpening, openingInfo } from '../openings/eco.ts'
import { buildAnalysis, summarize } from '../analysis/build.ts'
import { graphMarks } from '../analysis/marks.ts'
import type { GameAnalysis } from '../analysis/build.ts'
import { moveComment } from '../analysis/comments.ts'
import { moveLabels } from '../analysis/labels.ts'
import AnalysisGraph from '../ui/AnalysisGraph.vue'
import AnalysisSummary from '../ui/AnalysisSummary.vue'
import { storedFromRecord } from '../games/model.ts'
import type { StoredReview } from '../games/model.ts'
import { gameStore } from '../games/idb.ts'
import Board from '../ui/Board.vue'
import { playSound } from '../ui/sound.ts'
import CoachPanel from '../ui/CoachPanel.vue'
import EvalBar from '../ui/EvalBar.vue'
import EnginePanel from '../ui/EnginePanel.vue'
import MoveList from '../ui/MoveList.vue'
import TeacherCard from '../ui/TeacherCard.vue'
import TeacherPick from '../ui/TeacherPick.vue'
import { FIGUREN, teacherOf } from '../teacher/avatar.ts'
import type { TeacherSettings } from '../teacher/avatar.ts'
import { evaluateMove } from '../teacher/analyse.ts'
import { judgeMove } from '../teacher/judge.ts'
import { bestMoveText } from '../teacher/commentary.ts'
import { lateHelp } from '../teacher/late-help.ts'
import { access } from '../teacher/access.ts'
import type { LateHelp } from '../teacher/late-help.ts'
import type { Judgement } from '../teacher/judge.ts'
import { adoptBest, canKeep, undoHeld } from '../teacher/session.ts'
import type { Held } from '../teacher/session.ts'
import { repertoireNote, repertoireSentence } from '../teacher/repertoire.ts'
import type { RepertoireNote } from '../teacher/repertoire.ts'
import { LABEL, SYMBOL, badgeTip } from '../teacher/blocks.ts'
import { moveFacts, quipCategories } from '../teacher/quip-events.ts'
import type { Rating } from '../teacher/judge.ts'
import { stopQuip } from '../audio/play-quip.ts'
import { QUIP_SHOWN_MS, useTeacherSpeech } from '../teacher/speech.ts'
import BoardLayout from '../ui/BoardLayout.vue'
import { EMPTY_VIEW } from '../coach/ceval.ts'
import type { EngineView } from '../coach/ceval.ts'
import type { CoachShape } from '../coach/explain.ts'

/** `free` = free game (route "Spielen"): no variation, the player picks the side, the repertoire opening is found from the game itself. */
const props = defineProps<{ bundle: ContentBundle; variation?: Variation; side: Side; startFen?: string; free?: boolean }>()
const emit = defineEmits<{ finished: [GameRecord] }>()

const INITIAL = new Chess().fen()
const ELO_MIN = 1320
const ELO_MAX = 2400
const REVIEW_DEPTH = 12
const TEACHER_DEPTH = 14

const ev = ref<EngineView>(EMPTY_VIEW)
const SIDE_KEY = 'schachtrainer.freeside'
const storedSide = (): SideChoice => { try { return parseSideChoice(typeof localStorage === 'undefined' ? null : localStorage.getItem(SIDE_KEY)) } catch { return 'white' } }
/** "Ich spiele Weiß | Schwarz | Zufall" (remembered); Zufall is drawn when the game starts. */
const sideChoice = ref<SideChoice>(storedSide())
const drawn = ref<Side>(props.side)
const freeSide = computed<Side>(() => (sideChoice.value === 'random' ? drawn.value : sideChoice.value))
const chooseSide = (c: SideChoice) => { sideChoice.value = c; try { localStorage.setItem(SIDE_KEY, c) } catch { /* blocked: stays for this session */ } }
const mySide = computed<Side>(() => (props.free ? (phase.value === 'setup' && sideChoice.value === 'random' ? 'white' : freeSide.value) : props.side))
const phase = ref<'setup' | 'play' | 'over'>('setup')
const startFen = ref(INITIAL)
const ucis = ref<string[]>([])
const lastMove = ref<[string, string] | undefined>()
const result = ref('')
const message = ref('')
const thinking = ref(false)
let token = 0 // bumped on every new game / unmount: a late engine answer of an old game is dropped

const fen = computed(() => gameFens(startFen.value, ucis.value).at(-1)!)
const turn = computed<Side>(() => (fen.value.split(' ')[1] === 'b' ? 'black' : 'white'))
const elo = computed(() => progress.value.settings.sparringElo)
/** The board shows the own side at the bottom; the flip button turns it for this game (a new game starts with the own side again). */
const flipped = ref(false)
const boardSide = computed<Side>(() => (flipped.value ? flipSide(mySide.value) : mySide.value))
const bars = computed(() => barSides(boardSide.value))
const barPlayer = (side: Side) => (side === mySide.value ? { name: 'Du', elo: null } : { name: 'Stockfish', elo: elo.value })
const setElo = (e: Event) => {
  const v = Math.min(ELO_MAX, Math.max(ELO_MIN, Number((e.target as HTMLInputElement).value)))
  update((p) => ({ ...p, settings: { ...p.settings, sparringElo: v } }))
}

// Teacher
const teacher = computed(() => teacherOf(progress.value.settings))
const teacherName = computed(() => FIGUREN.find((f) => f.id === teacher.value.figur)!.name)
const setTeacher = (patch: Partial<TeacherSettings>) =>
  update((p) => ({ ...p, settings: { ...p.settings, teacher: { ...p.settings.teacher, ...patch } } }))
/** Fixed at game start: the teacher setting of a running game does not change under it. */
const withTeacher = ref(false)
const judging = ref(false)
interface Said { j: Judgement | null; note: RepertoireNote | null; extra?: string; seed: string; /** planned repertoire move shown on request */ repShown?: boolean }
const said = ref<Said | null>(null)
// Quips and feeling: shared with the saved-game view and the analysis board (teacher/speech.ts)
const speech = useTeacherSpeech({ teacher, enabled: () => withTeacher.value, hold: () => !!pending.value, seedKey: () => ucis.value.length })
const { eventMood, positionCp, mood, quip, audioAvailable, say, clearQuip } = speech
/** The quip for the move just applied (`ucis` already contains it). */
function sayMove(fenBefore: string, uci: string, mine: boolean, rating: Rating | null, note: RepertoireNote | null) {
  const san = applyUci(fenBefore, uci)?.san ?? ''
  const categories = quipCategories({ mine, check: san.endsWith('+'), status: gameStatus(startFen.value, ucis.value), rating, note })
  say(categories, moveFacts(fenBefore, uci), `${fenBefore}|${uci}`)
}
/** A Fehler/Patzer that waits for the decision (undo, hint, best move, keep playing). */
const pending = ref<Held | null>(null)
const retracted = ref<ReviewError[]>([])
const card = computed(() => {
  const sd = said.value
  if (!sd) return null
  const noteText = sd.note ? repertoireSentence(sd.note, sd.seed, sd.repShown) : ''
  const r = sd.j?.rating ?? null
  return {
    gefuehl: mood.value,
    headline: r ? `${SYMBOL[r]} ${LABEL[r]}` : '',
    severity: r ?? '',
    tip: r && sd.j ? badgeTip(r, sd.j.lossCp) : '',
    text: sd.extra ?? sd.j?.text ?? noteText,
    note: sd.j ? noteText : '',
  }
})
const showCard = computed(() => withTeacher.value && (card.value !== null || quip.value !== '' || !!revealText.value))
const cardView = computed(() => card.value ?? { gefuehl: mood.value, headline: '', severity: '', tip: '', text: '', note: '' })
// Help on request: the teacher never volunteers a better move. Hint = the piece, best move = arrow and reason; both are counted.
interface Help { fen: string; uci: string; text: string; hinted: boolean; shown: boolean }
const help = ref<Help | null>(null)
const helping = ref(false)
const helps = ref({ hints: 0, bests: 0, repertoire: 0, engine: 0 })
/** "Besseren Zug zeigen" after an inaccurate move was used. */
const late = ref<LateHelp | null>(null)
const repertoireOffer = computed(() => said.value?.note?.kind === 'abweichung' && !!said.value.note.plannedSan && !said.value.repShown && !pending.value)
function showRepertoire() {
  if (!said.value || !repertoireOffer.value) return
  said.value = { ...said.value, repShown: true }
  helps.value = { ...helps.value, repertoire: helps.value.repertoire + 1 }
}
/** Position before the judged move: the arrow of "Besseren Zug zeigen" belongs to it. */
const lateFen = ref('')
const later = computed(() => !!late.value && !late.value.shown && !pending.value)
/** The player lifted the engine lock of a teacher game on purpose (counts once as a help). */
const engineUnlocked = ref(false)
const fresh = ref(false)
function unlockEngine() {
  if (engineUnlocked.value || !withTeacher.value || phase.value !== 'play') return
  engineUnlocked.value = true
  helps.value = { ...helps.value, engine: helps.value.engine + 1 }
}
const acc = computed(() => access({ phase: phase.value, withTeacher: withTeacher.value, thinking: thinking.value, judging: judging.value, analysing: analysing.value, helping: helping.value, pending: !!pending.value, myTurn: turn.value === mySide.value, browsing: view.value !== null, engineUnlocked: engineUnlocked.value, analyseWhileThinking: engineSettings.value.whileThinking }))
const canAsk = computed(() => acc.value.canAsk)
const revealText = computed(() => (pending.value?.revealed ? pending.value.j.reveal : help.value?.shown ? help.value.text : late.value?.shown ? late.value.reveal : undefined))
const bestFrom = computed(() => (pending.value?.hinted || pending.value?.revealed ? [pending.value.j.betterUci.slice(0, 2)] : help.value?.hinted ? [help.value.uci.slice(0, 2)] : []))

/** Opening of this variation: the tree the book exit follows. */
const variationOpening = computed(() => (props.variation ? openingOfVariation(props.bundle, props.variation.id)?.id ?? '' : ''))
/** Free game: the opening whose book the given game follows longest (see pickOpening); variation game: the variation's opening. */
const openingAt = (game: string[]): string => (props.free ? pickOpening(props.bundle, game, startFen.value, progress.value.overlays, mySide.value) ?? '' : variationOpening.value)
// Starting points
/** Position after the variation line; null if a SAN in the content is broken (the button is then hidden). */
const afterLine = computed(() => { if (!props.variation) return null; try { const c = new Chess(); for (const s of props.variation.line) c.move(s); return c.fen() } catch { return null } })
const deviationStarts = computed(() =>
  props.bundle.deviations.filter((d) => d.variationId === props.variation?.id).flatMap((d) => {
    const node = nodeOfVariation(props.bundle, props.variation!.id, d.key)
    const r = node && applyUci(node.fen, d.replyUci)
    return r ? [{ fen: r.fen, label: toGermanSan(r.san) }] : []
  }),
)

// Thinking time: chosen at the start (remembered), the clock is a pure value (train/clock.ts); the ticker only reads Date.now().
const TC_KEY = 'schachtrainer.timecontrol'
const PAUSE_KEY = 'schachtrainer.clockpause'
const store = (): Storage | undefined => { try { return typeof localStorage === 'undefined' ? undefined : localStorage } catch { return undefined } }
const timeControl = ref<TimeControl | null>(parseTimeControl(store()?.getItem(TC_KEY)))
const teacherPause = ref(store()?.getItem(PAUSE_KEY) !== 'off')
/** A time control without the clock stop of the teacher suggests "Anhalten bei: nie": a running clock and a question to the player do not go together. */
function pickTime(t: TimeControl | null) {
  if (holdSuggestion({ teacherOn: teacher.value.on, teacherPause: teacherPause.value, hadTime: !!timeControl.value, hasTime: !!t })) setTeacher({ hold: 'never' })
  timeControl.value = t
  try { store()?.setItem(TC_KEY, t?.id ?? 'none') } catch { /* blocked: stays for this session */ }
}
function pickPause(on: boolean) {
  if (holdSuggestion({ teacherOn: teacher.value.on, teacherPause: on, hadTime: false, hasTime: !!timeControl.value })) setTeacher({ hold: 'never' })
  teacherPause.value = on; try { store()?.setItem(PAUSE_KEY, on ? 'on' : 'off') } catch { /* blocked */ } }
const gameTime = ref<TimeControl | null>(null) // fixed at game start
const clock = ref<Clock | null>(null)
const clockNow = ref(Date.now())
const learning = ref(false) // the teacher stopped the clock at least once
let clockBefore: Clock | null = null // before the own last move: a taken-back move gets its time back
let ticker: ReturnType<typeof setInterval> | undefined
const stopTicker = () => { clearInterval(ticker); ticker = undefined }
function tick() {
  const c = clock.value
  if (!c || phase.value !== 'play') return
  clockNow.value = Date.now()
  const out = flagged(c, clockNow.value)
  if (out) timeOut(out)
}
function startClock() {
  stopTicker()
  gameTime.value = timeControl.value
  clock.value = gameTime.value ? newClock(gameTime.value) : null
  clockBefore = null; learning.value = false
  if (clock.value) ticker = setInterval(tick, 100)
}
function timeOut(loser: Side) {
  token++; cancelEngine(); thinking.value = false; judging.value = false
  const winner = flagWinner(fen.value, loser)
  const text = winner === null ? 'Zeit abgelaufen – Remis (der Gegner hat kein Mattmaterial)' : winner === mySide.value ? 'Die Zeit des Gegners ist abgelaufen – du hast gewonnen' : 'Deine Zeit ist abgelaufen – verloren'
  finishGame(text, { winner, reason: 'zeit' })
}
const helpOpen = computed(() => !!help.value && (help.value.hinted || help.value.shown))
/** The comment of the teacher after the move is on screen (QUIP_SHOWN_MS, or until the own next move). */
const commentOpen = ref(false)
let commentTimer: ReturnType<typeof setTimeout> | undefined
function openComment() { clearTimeout(commentTimer); commentOpen.value = true; commentTimer = setTimeout(() => { commentOpen.value = false }, QUIP_SHOWN_MS) }
function closeComment() { clearTimeout(commentTimer); commentOpen.value = false }
const clockHeld = computed(() => clockPaused({ withTeacher: withTeacher.value, teacherPause: teacherPause.value, judging: judging.value, pending: !!pending.value, helpOpen: helpOpen.value, commentOpen: commentOpen.value }))
watch(clockHeld, (paused) => {
  if (!clock.value || phase.value !== 'play') return
  if (paused) { if (clock.value.ticking) learning.value = true; clock.value = pause(clock.value, Date.now()) } else clock.value = resume(clock.value, Date.now())
}, { flush: 'sync' })
const clockStopped = computed(() => !!clock.value && !clock.value.ticking && phase.value === 'play' && clockHeld.value)
const barClock = (side: Side) => {
  const c = clock.value
  if (!c) return null
  const ms = remaining(c, side, clockNow.value)
  return { text: formatClock(ms), low: isLow(ms), active: c.ticking && c.turn === side, paused: clockStopped.value && c.turn === side }
}

/** Free game: the start position is ready, the first move on the board starts the game. */
const startable = computed(() => canStartByMove({ phase: phase.value, free: !!props.free, hasStartFen: !!props.startFen, side: sideChoice.value }))
function toSetup() { resetState(); startFen.value = INITIAL; flipped.value = false; phase.value = 'setup' }
function flipBoard() {
  const i = flipIntent({ phase: phase.value, free: !!props.free, hasStartFen: !!props.startFen, side: sideChoice.value })
  if (i.kind === 'view') { flipped.value = !flipped.value; return }
  chooseSide(i.side)
  if (i.start) newGame(INITIAL)
}

/** Back to a clean state: drops late engine answers, a running analysis and the shown review. */
function resetState() {
  void noteSaver.flush()
  token++
  cancelEngine()
  ucis.value = []; lastMove.value = undefined
  result.value = ''; message.value = ''; thinking.value = false; view.value = null; rv.value = null; analysing.value = false; trained.value = 0
  said.value = null; pending.value = null; judging.value = false; retracted.value = []
  speech.reset()
  stopTicker(); clock.value = null; clockBefore = null; closeComment()
  fullAnalysis.value = null
  help.value = null; helping.value = false; helps.value = { hints: 0, bests: 0, repertoire: 0, engine: 0 }; engineUnlocked.value = false; fresh.value = false; late.value = lateHelp(late.value, { kind: 'reset' })
}

function newGame(from: string) {
  resetState()
  flipped.value = false
  if (props.free) drawn.value = resolveSide(sideChoice.value, Math.random())
  startFen.value = from
  withTeacher.value = teacher.value.on
  const s = gameStatus(from, [])
  if (s.over) { // nothing to play: show the result at once, never send an ended position to the engine
    finishGame(describeResult(s, mySide.value), s)
    message.value = 'Diese Stellung ist schon beendet. Wähle einen anderen Start.'
    return
  }
  withTeacher.value = teacher.value.on
  phase.value = 'play'
  startClock()
  say(['partie_start'], {}, from)
  if (turn.value !== mySide.value) void engineMove()
}

// Notes at the end of the game: same saver as in the game view; the game is stored a moment after its end, so a note waits for its id.
const savedIds = new Map<string, Promise<string | null>>()
let gameNo = 0
let gameKey = ''
const noteDrafts = ref<Record<number, string>>({})
const noteDraft = ref('')
const noteStatus = ref<NoteStatus | null>(null)
const noteSaver = createNoteSaver({
  delayMs: 800,
  schedule: (fn, ms) => setTimeout(fn, ms), cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  onStatus: (st) => { noteStatus.value = st },
  save: deferredNoteSave((k) => savedIds.get(k) ?? Promise.resolve(null), async (id, ply, text) => {
    const r = await setNote(gameStore, id, ply, text)
    return r.ok ? { ok: true as const } : { ok: false as const, message: r.message }
  }),
})
function onNoteInput() {
  if (shownPly.value < 1 || !gameKey) return
  noteDrafts.value = { ...noteDrafts.value, [shownPly.value - 1]: noteDraft.value }
  noteSaver.change({ id: gameKey, ply: shownPly.value - 1 }, noteDraft.value)
}

function finishGame(text: string, outcome: Outcome) {
  phase.value = 'over'; result.value = text; pending.value = null
  stopTicker(); closeComment(); if (clock.value) clock.value = pause(clock.value, Date.now())
  if (outcome.reason === 'aufgabe' || outcome.reason === 'remis' || outcome.reason === 'zeit') playSound('end') // mate and stalemate sound from the board
  const record = gameRecord({ startFen: startFen.value, ucis: ucis.value, outcome, date: new Date(), elo: elo.value, teacher: withTeacher.value ? teacher.value.figur : null, ownSide: mySide.value, helps: helps.value, ...clockRecord(), rated: !withTeacher.value })
  emit('finished', record)
  gameKey = `g${++gameNo}`
  noteDrafts.value = {}; noteStatus.value = null
  savedIds.set(gameKey, autoSave(record))
}
/** Every finished game goes into the browser database; a failure is shown, the game stays on screen. */
let savedId: string | null = null
async function autoSave(record: GameRecord): Promise<string | null> {
  savedId = null
  if (!record.ucis.length) return null
  const mine = token
  const openingId = openingAt(ucis.value)
  const openingName = props.bundle.openings.find((o) => o.id === openingId)?.name ?? null
  const repertoire = openingName && props.variation ? `${openingName}: ${props.variation.name}` : openingName // the German name of the variation as the mark
  const retractions = retracted.value.map((e) => ({ ply: e.ply, san: e.san, severity: e.severity as 'fehler' | 'patzer', betterSan: e.betterSan }))
  const table = await loadEco()
  const found = table ? detectOpening(table, record.startFen, record.ucis) : null
  const info = openingInfo({}, found ? { eco: found.eco, name: found.name } : null)
  const stored = storedFromRecord(record, {
    source: props.free ? 'free' : 'sparring', opening: info.name, eco: info.eco, repertoire, detected: found ? { eco: found.eco, name: found.name } : null, enriched: !!table,
    retractions, review: null, playerName: identityOf(progress.value.settings).name,
  })
  const r = await saveGame(gameStore, stored)
  if (r.ok && mine === token) savedId = r.id
  else if (!r.ok && mine === token) message.value = `Die Partie wurde nicht gespeichert: ${r.message}`
  return r.ok ? r.id : null // also after a reset: a note typed meanwhile still needs the id
}
/** A running game that is left (other page, other start position) is kept as an unfinished game. */
function abandonGame() {
  if (phase.value !== 'play' || !ucis.value.length) return
  void autoSave(gameRecord({ startFen: startFen.value, ucis: ucis.value, outcome: { winner: null, reason: 'abbruch' }, date: new Date(), elo: elo.value, teacher: withTeacher.value ? teacher.value.figur : null, ownSide: mySide.value, helps: helps.value, ...clockRecord(), rated: !withTeacher.value }))
}
/** A game that counts for "Anwenden": only with a variation. */
const markDone = () => { if (props.variation) markApplied(applySparringId(props.variation.id)) }

const clockRecord = () => (gameTime.value ? { timeControl: pgnTimeControl(gameTime.value), ...(learning.value ? { learning: true } : {}) } : {})

function applyMove(uci: string): boolean {
  const r = applyUci(fen.value, uci)
  if (!r) return false
  const mover = turn.value
  if (clock.value) { if (mover === mySide.value) clockBefore = clock.value; clock.value = press(clock.value, mover, Date.now(), clockHeld.value) }
  ucis.value = [...ucis.value, uci]
  lastMove.value = [uci.slice(0, 2), uci.slice(2, 4)]
  if (view.value !== null && phase.value === 'play') fresh.value = true // the game moves on while an earlier position is shown
  const s = gameStatus(startFen.value, ucis.value)
  if (s.over) { finishGame(describeResult(s, mySide.value), s); markDone() }
  return true
}

async function engineMove() {
  const mine = token
  thinking.value = true; message.value = ''
  try {
    const c = clock.value
    const movetimeMs = c && gameTime.value ? engineMoveMs(remaining(c, turn.value, Date.now()), gameTime.value.incMs, elo.value) : 300 + Math.floor(Math.random() * 500)
    const uci = await getEngine().play(fen.value, { elo: elo.value, movetimeMs })
    const before = [...ucis.value]
    const fenBefore = fen.value
    if (mine === token && !applyMove(uci)) {
      resetEngine()
      message.value = `Die Engine lieferte einen ungültigen Zug (${uci}). Starte die Partie neu.`
    } else if (mine === token && withTeacher.value) {
      const note = repertoireNote(before, uci, startFen.value, props.bundle, openingAt([...before, uci]), progress.value.overlays, mySide.value)
      if (note) said.value = { j: null, note, seed: `${fenBefore}|${uci}` }
      sayMove(fenBefore, uci, false, null, note)
    }
  } catch (e) {
    if (e instanceof CancelledError || mine !== token) return
    if (e instanceof EngineError) resetEngine()
    message.value = `${engineErrorText(e)} Starte die Partie neu.`
  } finally {
    if (mine === token) thinking.value = false
  }
}

function onMove(uci: string) {
  if (startable.value) { newGame(INITIAL); if (phase.value !== 'play' || turn.value !== mySide.value) return }
  if (phase.value !== 'play' || thinking.value || judging.value || pending.value || turn.value !== mySide.value || view.value !== null) return
  const fenBefore = fen.value
  const before = [...ucis.value]
  closeComment()
  if (!applyMove(uci)) return
  late.value = lateHelp(late.value, { kind: 'moved' })
  if (phase.value !== 'play') { if (withTeacher.value) sayMove(fenBefore, uci, true, null, null); return }
  if (withTeacher.value) void teach(fenBefore, before, uci)
  else void engineMove()
}

/** Judges the move just played; a Fehler/Patzer holds the game, anything else lets the engine answer. */
async function teach(fenBefore: string, before: string[], uci: string) {
  const mine = token
  judging.value = true; message.value = ''
  try {
    const ev = await evaluateMove(getEngine(), fenBefore, uci, TEACHER_DEPTH)
    if (mine !== token) return
    const j = judgeMove(fenBefore, uci, ev)
    positionCp.value = scoreCp(ev.played)
    const note = repertoireNote(before, uci, startFen.value, props.bundle, openingAt([...before, uci]), progress.value.overlays, mySide.value)
    said.value = { j, note, seed: `${fenBefore}|${uci}` }
    openComment()
    late.value = lateHelp(late.value, { kind: 'judged', j })
    lateFen.value = fenBefore
    sayMove(fenBefore, uci, true, j.rating, note)
    if (holds(j.rating, teacher.value.hold) && (j.rating === 'fehler' || j.rating === 'patzer')) {
      pending.value = { j, uci, fenBefore, san: applyUci(fenBefore, uci)!.san, hinted: false, revealed: false }
      if (autoExplain(j.rating, teacher.value.explain)) showBest() // explained at once: counts as the help "Bester Zug"
      return
    }
    if (autoExplain(j.rating, teacher.value.explain)) showLate()
    void engineMove()
  } catch (e) {
    if (e instanceof CancelledError || mine !== token) return
    if (e instanceof EngineError) resetEngine()
    message.value = `Der Lehrer konnte den Zug nicht prüfen. ${engineErrorText(e)}`
    void engineMove()
  } finally {
    if (mine === token) judging.value = false
  }
}

/** Takes the held move back: it is kept for the training, the player tries again. */
function undoMove() {
  const p = pending.value
  const r = undoHeld(p, ucis.value, phase.value)
  if (!p || !r) return
  retracted.value = [...retracted.value, r.error]
  ucis.value = r.ucis
  const last = ucis.value.at(-1)
  lastMove.value = last ? [last.slice(0, 2), last.slice(2, 4)] : undefined
  pending.value = null; view.value = null; fresh.value = false
  if (clockBefore && clock.value) clock.value = rewind(clockBefore, Date.now())
  said.value = { j: null, note: null, extra: 'Zug zurückgenommen. Versuch einen anderen.', seed: p.fenBefore }
  say(['zuruecknehmen'], moveFacts(p.fenBefore, p.uci), p.fenBefore)
}
/** "Besten Zug übernehmen": the held move is taken back (for the training) and the best move is played instead; counts as a help. */
function takeBest() {
  const p = pending.value
  const r = adoptBest(p, ucis.value, phase.value)
  if (!p || !r) return
  if (!p.revealed) helps.value = { ...helps.value, bests: helps.value.bests + 1 }
  retracted.value = [...retracted.value, r.error]
  ucis.value = r.ucis.slice(0, -1)
  pending.value = null; view.value = null; fresh.value = false
  clearQuip(); eventMood.value = null
  if (clockBefore && clock.value) clock.value = rewind(clockBefore, Date.now())
  if (!applyMove(p.j.betterUci)) { message.value = 'Der beste Zug konnte nicht gespielt werden.'; return }
  said.value = { j: null, note: null, extra: 'Besten Zug übernommen. Weiter geht es.', seed: p.fenBefore }
  if (phase.value === 'play') void engineMove()
}
const hint = () => {
  const p = pending.value
  if (!p) return
  if (!p.hinted) helps.value = { ...helps.value, hints: helps.value.hints + 1 }
  pending.value = { ...p, hinted: true }
}
const showBest = () => {
  const p = pending.value
  if (!p) return
  if (!p.revealed) helps.value = { ...helps.value, bests: helps.value.bests + 1 }
  pending.value = { ...p, revealed: true }
  late.value = lateHelp(late.value, { kind: 'show' }) // after "Weiterspielen" the explanation stays, no second offer
}
const showLate = () => {
  if (!late.value || late.value.shown) return
  late.value = lateHelp(late.value, { kind: 'show' })
  helps.value = { ...helps.value, bests: helps.value.bests + 1 }
}

/** Asks the engine for the best move of the current position (once per position) and shows the requested help. */
async function askHelp(kind: 'hint' | 'best') {
  if (!canAsk.value) return
  const mine = token
  const at = fen.value
  let h = help.value?.fen === at ? help.value : null
  if (!h) {
    helping.value = true; message.value = ''
    try {
      const line = (await getEngine().analyse(at, { depth: TEACHER_DEPTH })).lines[0]
      if (mine !== token || fen.value !== at || !line) return
      h = { fen: at, uci: line.uci, text: bestMoveText(at, line), hinted: false, shown: false }
    } catch (e) {
      if (e instanceof CancelledError || mine !== token) return
      if (e instanceof EngineError) resetEngine()
      message.value = `Der Lehrer konnte keinen Zug berechnen. ${engineErrorText(e)}`
      return
    } finally {
      if (mine === token) helping.value = false
    }
  }
  if (kind === 'hint' && !h.hinted) { h = { ...h, hinted: true }; helps.value = { ...helps.value, hints: helps.value.hints + 1 } }
  if (kind === 'best' && !h.shown) { h = { ...h, hinted: true, shown: true }; helps.value = { ...helps.value, bests: helps.value.bests + 1 } }
  help.value = h
}
watch(fen, () => { help.value = null })
function keepMove() { if (!canKeep(pending.value, phase.value)) return; pending.value = null; view.value = null; fresh.value = false; clearQuip(); eventMood.value = null; void engineMove() }

function resign() { token++; cancelEngine(); thinking.value = false; finishGame('Du hast aufgegeben', { winner: mySide.value === 'white' ? 'black' : 'white', reason: 'aufgabe' }); say(['aufgeben'], {}, 'aufgeben') }

async function offerDraw() {
  const mine = token
  thinking.value = true; message.value = ''
  try {
    const a = await getEngine().analyse(fen.value, { depth: 10 })
    if (mine !== token) return
    if (drawAccepted(scoreCp(a.lines[0]!))) { finishGame('Remis vereinbart', { winner: null, reason: 'remis' }); markDone() }
    else message.value = 'Die Engine lehnt das Remis ab.'
  } catch (e) {
    if (e instanceof CancelledError || mine !== token) return
    if (e instanceof EngineError) resetEngine()
    message.value = engineErrorText(e)
  } finally {
    if (mine === token) thinking.value = false
  }
}

// Review
const rv = ref<{ errors: ReviewError[]; exit: number | null } | null>(null)
const analysing = ref(false)
const done = ref(0)
const total = ref(0)
const view = ref<number | null>(null) // plies shown while browsing the finished game
let cancelled = false
const trained = ref(0)

async function analyseGame() {
  const mine = token
  analysing.value = true; cancelled = false; done.value = 0; message.value = ''
  const fens = gameFens(startFen.value, ucis.value)
  total.value = fens.length
  try {
    const ev = await evaluatePositions(getEngine(), fens, REVIEW_DEPTH, { multipv: 2, onProgress: (d) => { done.value = d }, isCancelled: () => cancelled || mine !== token })
    if (mine !== token) return
    const book = props.free ? bookPliesOf(props.bundle, ucis.value, startFen.value, progress.value.overlays, mySide.value) : bookExit(ucis.value, props.bundle, variationOpening.value, progress.value.overlays, startFen.value) ?? ucis.value.length
    const analysis = buildAnalysis(startFen.value, ucis.value, ev, REVIEW_DEPTH, book)
    fullAnalysis.value = analysis
    rv.value = { errors: reviewErrors(startFen.value, ucis.value, ev, mySide.value), exit: bookExit(ucis.value, props.bundle, openingAt(ucis.value), progress.value.overlays, startFen.value) }
    // review and analysis in ONE write: two writes would read the stored game and overwrite each other
    const review = { marks: rv.value.errors.map((e) => ({ ply: e.ply, severity: e.severity, lossCp: e.lossCp, betterSan: e.betterSan })), bookExit: rv.value.exit }
    void saveResults(review, analysis)
  } catch (e) {
    if (mine !== token) return
    if (e instanceof EngineError) resetEngine()
    message.value = cancelled || e instanceof CancelledError ? 'Auswertung abgebrochen.' : `Auswertung nicht möglich. ${engineErrorText(e)}`
  } finally {
    if (mine === token) analysing.value = false
  }
}
function cancelAnalysis() { cancelled = true; cancelEngine() }

// Full analysis (move signs, evaluations, graph), stored with the game
const fullAnalysis = ref<GameAnalysis | null>(null)
async function saveResults(review: StoredReview, a: GameAnalysis) {
  if (!savedId) return
  const r = await addResults(gameStore, savedId, { review, analysis: a })
  if (!r.ok) message.value = `Die Analyse wurde nicht gespeichert: ${r.message}`
}const labels = computed(() => (fullAnalysis.value ? moveLabels(fullAnalysis.value) : { nags: {} as Record<number, string>, cats: {} as Record<number, string>, titles: {} as Record<number, string> }))
const graphMarkList = computed(() => (fullAnalysis.value ? graphMarks(fullAnalysis.value, startFen.value, ucis.value, { comment: (i) => moveComment(fullAnalysis.value!, startFen.value, ucis.value, i) }) : []))
const summary = computed(() => (fullAnalysis.value ? summarize(fullAnalysis.value, startFen.value) : null))
const shownComment = computed(() => (fullAnalysis.value && shownPly.value > 0 ? moveComment(fullAnalysis.value, startFen.value, ucis.value, shownPly.value - 1) : null))

/** Mistakes (taken back or kept) that do not have a training card yet; each button click trains what is still missing. */
const untrained = computed(() => props.free || !props.variation ? [] : cardsFromErrors([...retracted.value, ...(rv.value?.errors ?? [])], props.variation.id, variationOpening.value, props.bundle.contentVersion, progress.value.cards))
function toTraining() {
  const fresh = untrained.value
  update((p) => ({ ...p, cards: { ...p.cards, ...Object.fromEntries(fresh.map((c) => [cardId(c), c])) } }))
  trained.value += fresh.length
}

// Display
const shownFen = computed(() => (view.value === null ? fen.value : gameFens(startFen.value, ucis.value)[view.value]!))
const startPly = computed(() => { const f = startFen.value.split(' '); return (Number(f[5]) - 1) * 2 + (f[1] === 'b' ? 1 : 0) })
/** SAN of every played move (the move table converts to German). */
const moveSans = computed(() => {
  let cur = startFen.value
  return ucis.value.map((u) => {
    const r = applyUci(cur, u)!
    cur = r.fen
    return r.san
  })
})
/** 0-based ply to the move number shown in the summary: the plies before the retracted move are the game so far. */
const startPlyOf = (e: ReviewError) => startPly.value + e.ply
const errorAt = (ply: number) => rv.value?.errors.find((e) => e.ply === ply)
/** Review marks on the move table, keyed by the number of plies after the move: error severity and the book exit. */
const marks = computed(() => {
  const m: Record<number, string> = {}
  ucis.value.forEach((_, ply) => { m[ply + 1] = [fullAnalysis.value ? '' : errorAt(ply)?.severity, rv.value?.exit === ply ? 'exit' : ''].filter(Boolean).join(' ') })
  return m
})
const titles = computed(() => {
  const t: Record<number, string> = {}
  ucis.value.forEach((_, ply) => {
    const sev = errorAt(ply)?.severity
    t[ply + 1] = [labels.value.titles[ply + 1] ?? '', sev ? SEVERITY[sev] : '', rv.value?.exit === ply ? 'Buchausstieg' : ''].filter(Boolean).join(' · ')
  })
  return t
})
const selected = computed(() => (view.value === null ? undefined : errorAt(view.value)))
const arrows = computed<Arrow[]>(() => {
  const p = pending.value
  if (p?.revealed) return [{ orig: p.j.betterUci.slice(0, 2), dest: p.j.betterUci.slice(2, 4), brush: 'green' }]
  if (help.value?.shown) return [{ orig: help.value.uci.slice(0, 2), dest: help.value.uci.slice(2, 4), brush: 'green' }]
  if (late.value?.shown && shownFen.value === lateFen.value) return [{ orig: late.value.uci.slice(0, 2), dest: late.value.uci.slice(2, 4), brush: 'green' }]
  const e = selected.value
  if (!e) return []
  return [
    { orig: e.uci.slice(0, 2), dest: e.uci.slice(2, 4), brush: 'red' },
    { orig: e.betterUci.slice(0, 2), dest: e.betterUci.slice(2, 4), brush: 'green' },
  ]
})
const coachShapes = ref<CoachShape[]>([])
/** Number of plies shown (browsing a finished game or the live position). */
const shownPly = computed(() => view.value ?? ucis.value.length)
const coachPrev = computed(() => (shownPly.value > 0 ? gameFens(startFen.value, ucis.value)[shownPly.value - 1] : undefined))
const coachUci = computed(() => (shownPly.value > 0 ? ucis.value[shownPly.value - 1] : undefined))
const coachBook = computed(() => {
  if (!coachUci.value) return undefined
  const exit = bookExit(ucis.value.slice(0, shownPly.value), props.bundle, openingAt(ucis.value.slice(0, shownPly.value)), progress.value.overlays, startFen.value)
  return exit === null ? 'theorie' as const : exit === shownPly.value - 1 ? 'abweichung' as const : 'ausserhalb' as const
})
const shownLast = computed<[string, string] | undefined>(() => {
  if (view.value === null) return lastMove.value
  const u = ucis.value[view.value - 1]
  return u ? [u.slice(0, 2), u.slice(2, 4)] : undefined
})
const engineLock = computed(() => acc.value.engineLock)
const coachEngine = computed(() => acc.value.coachEngine)
const shapesShown = computed(() => (acc.value.coachShapes ? coachShapes.value : []))
const movable = computed(() => startable.value || phase.value === 'play' && !thinking.value && !judging.value && !pending.value && turn.value === mySide.value && view.value === null)
watch(shownPly, () => { void noteSaver.flush(); noteDraft.value = noteDrafts.value[shownPly.value - 1] ?? ''; noteStatus.value = null }, { flush: 'sync' })
const SEVERITY: Record<string, string> = { ungenau: 'Ungenau', fehler: 'Fehler', patzer: 'Patzer' }

watch(() => [props.variation?.id, props.startFen], () => { abandonGame(); resetState(); phase.value = 'setup' })
/** Shows an earlier position (null = back to the live game). */
function goto(n: number | null) { view.value = n === null || n >= ucis.value.length ? null : n; if (view.value === null) fresh.value = false }
const notice = computed(() => historyNotice({ view: view.value, startPly: startPly.value, fresh: fresh.value }))
const status = computed(() => engineStatus({ phase: phase.value, thinking: thinking.value, judging: judging.value, pending: !!pending.value, myTurn: turn.value === mySide.value, setupHint: props.free && !props.startFen ? (sideChoice.value === 'white' ? 'move' : 'engine') : 'choose' }))
/** Browsing the moves of a game (running or finished): ←/→/Home/End like in the lesson (not while a game is running, not in text fields). */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (isFlipKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) { flipBoard(); e.preventDefault(); return }
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName ?? '') || !!t?.isContentEditable
  if (e.key === ' ' && !typing && !e.altKey && !e.ctrlKey && !e.metaKey && canKeep(pending.value, phase.value)) { e.preventDefault(); keepMove(); return }
  if (e.key.toLowerCase() === 'b' && !typing && !e.altKey && !e.ctrlKey && !e.metaKey && canKeep(pending.value, phase.value)) { e.preventDefault(); takeBest(); return }
  if (isHintKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods) && canAsk.value) { e.preventDefault(); void askHelp('hint'); return }
  if (phase.value === 'setup' || !shouldHandleKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) return
  const to = historyTarget(e.key, view.value, ucis.value.length)
  if (to === undefined) return
  goto(to)
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
// Kept alive by Apply (tab switch): while hidden no keys and no speech; the game itself stays as it is.
onDeactivated(() => { void noteSaver.flush(); clearQuip(); stopQuip(); window.removeEventListener('keydown', onKey) })
onActivated(() => { window.removeEventListener('keydown', onKey); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { stopTicker(); void noteSaver.flush(); abandonGame(); token++; cancelEngine(); clearQuip(); stopQuip(); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <BoardLayout :held-severity="pending ? (pending.j.rating === 'patzer' ? 'patzer' : 'fehler') : null">
    <template #top><PlayerBar :side="bars.top" v-bind="barPlayer(bars.top)" :fen="shownFen" :clock="barClock(bars.top)" /></template>
    <template #bottom><PlayerBar :side="bars.bottom" v-bind="barPlayer(bars.bottom)" :fen="shownFen" :clock="barClock(bars.bottom)" /></template>
    <template #left>
      <div class="pane sparring">
        <slot name="tabs" />
        <h2>{{ free ? (phase === 'setup' ? 'Partie gegen Stockfish' : withTeacher ? 'Lehrerpartie gegen Stockfish' : 'Wertungspartie gegen Stockfish') : 'Sparring gegen Stockfish' }}</h2>
        <h3 v-if="phase === 'setup'" class="sech">Gegner</h3>
        <label class="eloline">Spielstärke (Elo): <b>{{ elo }}</b>
          <input type="range" :min="ELO_MIN" :max="ELO_MAX" step="10" :value="elo" @input="setElo" aria-label="Spielstärke der Engine" />
        </label>

        <div v-if="phase === 'setup'" class="expl">
          <section v-if="free" class="sec">
            <h3 class="sech">Seite</h3>
            <div class="segs wide" role="group" aria-label="Seite">
              <button type="button" class="seg" :aria-pressed="sideChoice === 'white'" @click="chooseSide('white')"><KingIcon mode="white" /> Weiß</button>
              <button type="button" class="seg" :aria-pressed="sideChoice === 'black'" @click="chooseSide('black')"><KingIcon mode="black" /> Schwarz</button>
              <button type="button" class="seg" :aria-pressed="sideChoice === 'random'" title="Die Farbe wird beim Start ausgelost" @click="chooseSide('random')"><KingIcon mode="half" /> Zufall</button>
            </div>
          </section>
          <p v-if="free && !props.startFen" class="muted">{{ sideChoice === 'white' ? 'Zieh einfach auf dem Brett – die Partie beginnt mit deinem ersten Zug.' : sideChoice === 'black' ? 'Du spielst Schwarz: Stockfish beginnt.' : 'Die Farbe wird beim Start ausgelost.' }}</p>
          <p v-else class="muted">Du spielst {{ side === 'white' ? 'Weiß' : 'Schwarz' }}. Wähle den Start:</p>
          <section class="sec">
            <h3 class="sech">Lehrer</h3>
            <TeacherPick
              :on="teacher.on" :figur="teacher.figur" :quips="teacher.quips" :speak="teacher.speak" :audio="audioAvailable"
              @on="setTeacher({ on: $event })" @figur="setTeacher({ figur: $event })" @quips="setTeacher({ quips: $event })" @speak="setTeacher({ speak: $event })"
            />
            <template v-if="teacher.on">
              <h3 class="sech sub2">Anhalten bei</h3>
              <div class="segs wide" role="group" aria-label="Anhalten bei">
                <button v-for="m in HOLD_MODES" :key="m.id" type="button" class="seg" :aria-pressed="teacher.hold === m.id" @click="setTeacher({ hold: parseHold(m.id) })">{{ m.label }}</button>
              </div>
              <h3 class="sech sub2" title="Der Lehrer zeigt den besseren Zug mit Begründung von selbst; sonst bleibt der Knopf „Warum? Besseren Zug zeigen“. Das zählt jeweils als Hilfe.">Besseren Zug erklären</h3>
              <div class="segs wide" role="group" aria-label="Besseren Zug erklären">
                <button v-for="m in EXPLAIN_MODES" :key="m.id" type="button" class="seg" :aria-pressed="teacher.explain === m.id" @click="setTeacher({ explain: parseExplain(m.id) })">{{ m.label }}</button>
              </div>
            </template>
          </section>
          <section class="sec">
            <h3 class="sech">Bedenkzeit</h3>
            <TimeControlPick :model-value="timeControl" :with-teacher="teacher.on" :teacher-pause="teacherPause" @select="pickTime" @pause="pickPause" />
          </section>
          <p v-if="!teacher.on" class="muted rated">Wertungspartie: ohne Hilfen – wie am Brett. Engine-Anzeige, Coach und Hinweise sind gesperrt, bis die Partie zu Ende ist.</p>
          <div class="choices">
            <button v-if="props.startFen" class="primary" @click="newGame(props.startFen)">{{ free ? 'Ab der Stellung aus der Adresse' : 'Ab der Stellung aus dem Festigen' }}</button>
            <button v-if="afterLine" @click="newGame(afterLine)">Ab Ende der Variante</button>
            <button v-for="d in deviationStarts" :key="d.fen" @click="newGame(d.fen)">Ab Abweichung {{ d.label }}</button>
            <button v-if="free && !props.startFen && sideChoice !== 'white'" class="primary" @click="newGame(INITIAL)">{{ sideChoice === 'black' ? 'Trainer beginnt' : 'Partie starten' }}</button>
            <button v-if="!free || props.startFen" :class="{ primary: free && !props.startFen }" @click="newGame(INITIAL)">Von der Grundstellung</button>
          </div>
        </div>

        <template v-else>
          <p v-if="phase === 'play'" class="muted statusline" :class="{ halt: pending }" role="status">{{ judging ? `${teacherName} prüft deinen Zug …` : thinking ? 'Die Engine denkt …' : pending ? 'Die Partie hält an – du entscheidest.' : turn === mySide ? 'Du bist am Zug.' : '' }}{{ free ? ` Du spielst ${mySide === 'white' ? 'Weiß' : 'Schwarz'}.` : '' }}</p>
          <TeacherCard
            v-if="showCard" :figur="teacher.figur" :name="teacherName" :gefuehl="cardView.gefuehl" :headline="cardView.headline" :severity="cardView.severity" :tip="cardView.tip"
            :text="cardView.text" :note="cardView.note" :reveal="revealText" :blocked="!!pending" :hinted="!!pending?.hinted" :later="later" :repertoire-offer="repertoireOffer"
            :lock-figur="true" :quip="quip" :quips="teacher.quips" :speak="teacher.speak" :audio="audioAvailable"
            @hint="hint" @best="showBest" @later="showLate" @repertoire="showRepertoire" @quips="setTeacher({ quips: $event })" @speak="setTeacher({ speak: $event })"
          />
          <p v-if="message" class="verdict" role="status">{{ message }}</p>
          <div v-if="phase === 'over'" class="expl">
            <p class="verdict" role="status">{{ result }}</p>
            <label v-if="shownPly > 0" class="note">Eigene Notiz zu Zug {{ formatLine([moveSans[shownPly - 1]!], startPly + shownPly - 1) }}
              <textarea v-model="noteDraft" rows="2" maxlength="500" @input="onNoteInput"></textarea>
              <span class="status" role="status">
                <template v-if="noteStatus?.kind === 'saving'">speichert …</template>
                <template v-else-if="noteStatus?.kind === 'saved'">gespeichert ✓</template>
                <template v-else-if="noteStatus?.kind === 'error'"><span class="err">{{ noteStatus.message }}</span></template>
              </span>
            </label>
            <div v-if="withTeacher" class="bilanz">
              <h3>Lehrer-Bilanz</h3>
              <p>Rücknahmen: <b>{{ retracted.length }}</b><template v-if="retracted.length"> – {{ retracted.map((e) => `${SEVERITY[e.severity]} ${formatLine([e.san], startPlyOf(e))}`).join(', ') }}</template></p>
              <p>Hilfen: Hinweise <b>{{ helps.hints }}</b>, Beste Züge <b>{{ helps.bests }}</b>, Repertoirezüge <b>{{ helps.repertoire }}</b><template v-if="helps.engine"> · Engine-Anzeige eingeschaltet</template></p>
              <p v-if="retracted.length" class="muted">Zurückgenommene Fehler gehen trotzdem ins Training.</p>
              <button v-if="retracted.length && !rv && untrained.length" @click="toTraining">Zurückgenommene Fehler ins Training</button>
            </div>
            <div v-if="!rv && !analysing && ucis.length"><button class="primary" @click="analyseGame">Analysieren</button></div>
            <div v-if="analysing">
              <progress :max="total" :value="done"></progress> <span class="muted">Stellung {{ done }} von {{ total }} (Tiefe {{ REVIEW_DEPTH }})</span>
              <button @click="cancelAnalysis">Abbrechen</button>
            </div>
            <div v-if="rv">
              <h3>Auswertung</h3>
              <p v-if="rv.exit !== null" class="muted">Buchausstieg bei Zug {{ formatLine([moveSans[rv.exit]!], startPly + rv.exit) }}.</p>
              <p v-else class="muted">Die ganze Partie blieb im Buch.</p>
              <p v-if="rv.errors.length === 0">Keine Ungenauigkeiten gefunden. Stark gespielt.</p>
              <ul v-else class="errors">
                <li v-for="e in rv.errors" :key="e.ply">
                  <button :class="{ on: view === e.ply }" @click="view = e.ply">
                    <b>{{ SEVERITY[e.severity] }}</b> {{ formatLine([e.san], startPly + e.ply) }} (−{{ (e.lossCp / 100).toFixed(1) }}) · besser: {{ toGermanSan(e.betterSan) }}
                  </button>
                </li>
              </ul>
              <AnalysisSummary v-if="summary" :summary="summary" :white="mySide === 'white' ? 'Ich' : 'Stockfish'" :black="mySide === 'white' ? 'Stockfish' : 'Ich'" />
              <p v-if="shownComment" class="said">{{ shownComment }}</p>
              <button v-if="untrained.length" class="primary" @click="toTraining">Fehler ins Training</button>
              <p v-if="trained" class="muted" role="status">{{ trained }} Karten angelegt (Herkunft: Partie). <a class="linkbtn" :href="hrefPartien()">Jetzt üben</a></p>
              <p v-if="view !== null" class="muted"><button @click="view = null">Zur Endstellung</button></p>
            </div>
          </div>
        </template>
      </div>
      <CoachPanel
        v-if="phase !== 'setup' && acc.coachPanel" :fen="shownFen" :own-side="mySide" mode-key="anwenden" :prev-fen="coachPrev" :last-uci="coachUci"
        :book-status="coachBook" :engine-enabled="coachEngine" @shapes="coachShapes = $event"
      />
    </template>
    <template #board>
      <EvalBar :view="ev" :orientation="boardSide" />
      <Board :fen="shownFen" :orientation="boardSide" :movable="movable" :layer-lock="acc.layersLocked ? 'all' : false" :arrows="phase === 'play' && view !== null ? ev.arrows : [...arrows, ...ev.arrows]" :highlight="phase === 'play' && view !== null ? [] : bestFrom" :shapes="shapesShown" :last-move="shownLast" @move="onMove" />
    </template>
    <template #hold>
      <HoldBar :status="status" :notice="notice" :held="pending ? (pending.j.rating === 'patzer' ? 'patzer' : 'fehler') : null" @keep="keepMove" @undo="undoMove" @best="takeBest" />
    </template>
    <template #controls>
      <button aria-label="Brett drehen (F)" title="Brett drehen (F)" @click="flipBoard"><Icon name="flip" /></button>
      <template v-if="phase === 'play'">
        <template v-if="withTeacher">
          <button :disabled="!canAsk" title="Markiert die Figur des besten Zuges (Taste H)" @click="askHelp('hint')"><Icon name="hint" /><span class="lbl"> Hinweis</span> <kbd class="lbl">H</kbd></button>
          <button :disabled="!canAsk" title="Zeigt den besten Zug mit Begründung" @click="askHelp('best')"><Icon name="target" /><span class="lbl"> Bester Zug</span></button>
        </template>
        <button :disabled="thinking || judging || !!pending || turn !== mySide" @click="offerDraw"><Icon name="draw" /><span class="lbl"> Remis</span></button>
        <button class="danger" @click="resign"><Icon name="flag" /><span class="lbl"> Aufgeben</span></button>
      </template>
      <button v-else-if="phase === 'over'" class="pri" @click="toSetup">Neue Partie</button>
      <span v-else-if="free && !props.startFen" class="muted">Zieh auf dem Brett, um zu beginnen.</span>
      <span v-else class="muted">Wähle links den Start.</span>
    </template>
    <template #right>
      <EnginePanel :fen="shownFen" :orientation="mySide" :lock="engineLock" :unlockable="withTeacher && phase === 'play'" :locked-text="phase === 'play' && !withTeacher ? 'Wertungspartie: gesperrt bis zum Partieende.' : ''" @unlock="unlockEngine" @view="ev = $event" />
      <MoveList :sans="moveSans" :current="shownPly" :start-ply="startPly" :selectable="ucis.length > 0" :marks="marks" :titles="titles" :nags="labels.nags" :cats="labels.cats" @select="goto" />
      <AnalysisGraph v-if="fullAnalysis" class="graphbox" :positions="fullAnalysis.positions" :marks="graphMarkList" :current="shownPly" @select="goto" />
    </template>
  </BoardLayout>
</template>

<style scoped>
.note { display: grid; gap: 4px; margin: 0.4rem 0; font-size: var(--fs-small, 0.85rem); color: var(--muted); }
.note textarea { background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.5rem; font: inherit; resize: vertical; }
.graphbox { flex: none; margin-top: 8px; }
.said { border-left: 3px solid var(--acc); padding-left: 0.5rem; }
.rated { margin: 0.2rem 0 0.8rem; font-size: var(--fs-small, 0.85rem); }
.mode { display: flex; gap: 6px; margin: 0.3rem 0 0.6rem; }
.mode button { flex: 1; }
.sel { border-color: var(--acc); }
.sech.sub2 { margin-top: 12px; }
.statusline.halt { color: var(--q-mistake); font-weight: 800; }
.ctl kbd { font: 600 var(--fs-label)/1 var(--mono); padding: 2px 5px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
.eloline { display: block; margin: 0.4rem 0; }
.eloline input { width: 100%; }
.errors { list-style: none; padding: 0; margin: 0.4rem 0; display: grid; gap: 4px; }
.errors button { width: 100%; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; font: inherit; text-align: left; }
.errors button.on { border-color: var(--acc); }
progress { width: 100%; }
</style>
