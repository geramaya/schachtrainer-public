<script setup lang="ts">
import { syncConfig } from './boardSync.ts'
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Key } from '@lichess-org/chessground/types'
import type { Arrow, Side } from '../content/types.ts'
import { isCheck, legalDests, needsPromotion, toUci } from '../chess/game.ts'
import type { PromotionPiece } from '../chess/game.ts'
import { squarePercent } from '../chess/squarePosition.ts'
import PromotionDialog from './PromotionDialog.vue'
import type { CoachShape } from '../coach/explain.ts'
import type { Marke } from '../lehrgang/marks.ts'
import { boardShapes } from '../coach/boardShapes.ts'
import BoardLayers from './BoardLayers.vue'
import { layerModel, threatShapes } from '../chess/layerModel.ts'
import type { ThreatShape } from '../chess/layerModel.ts'
import { activeLayers } from './layerSettings.ts'
import { layerSettings, layersLocked } from './layerState.ts'
import { COACH_DEPTH, cachedEngine, sharedCoachCache } from '../coach/explain.ts'
import { threatsByNullMove } from '../coach/threats.ts'
import { CancelledError, EngineError } from '../engine/service.ts'
import { engineEpoch, getCoachEngine, resetEngine } from '../engine/instance.ts'
import { soundOnPositionChange } from './sound.ts'


const props = defineProps<{
  fen: string
  orientation: Side
  movable: boolean
  arrows: Arrow[]
  lastMove?: [string, string]
  highlight?: string[]
  /** Coach arrows and circles: blue = own chance, red = opponent idea, yellow = weak square; dim = not hovered. */
  shapes?: CoachShape[]
  /** Info marks of a lesson sentence (Lichess colours): arrow with `dest`, circle without; own right-click marks stay untouched. */
  marks?: Marke[]
  /** Frame on the target square of the last answer: green = right, red = wrong (colour plus the verdict line elsewhere). */
  flash?: { square: string; kind: 'ok' | 'err' } | null
  /** Squares kept in a red frame (start and target of a wrong move) until the parent clears them. */
  errSquares?: string[]
  /** Shakes the board frame once when it turns true (wrong answer). */
  wobble?: boolean
  /** An open exercise is on the board: the layers that would give the answer away stay off until it is solved. */
  layerLock?: boolean | 'all'
}>()
const emit = defineEmits<{ move: [uci: string] }>()

const el = ref<HTMLElement>()
const wrap = ref<HTMLElement>()
const pending = ref<{ from: string; to: string } | null>(null)
let api: Api | undefined

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const flashStyle = computed(() => {
  if (!props.flash) return null
  const { left, top } = squarePercent(props.flash.square, props.orientation)
  return { left: `${left}%`, top: `${top}%` }
})

const errStyles = computed(() => (props.errSquares ?? []).map((sq) => { const { left, top } = squarePercent(sq, props.orientation); return { left: `${left}%`, top: `${top}%` } }))

const turnColor = (): Side => (props.fen.split(' ')[1] === 'b' ? 'black' : 'white')

const brush = (key: string, color: string, opacity: number, lineWidth = 12) => ({ key, color, opacity, lineWidth })
/** chessground defaults (arrows of the lessons) plus the coach brushes; "Dim" = a hovered list entry highlights the other one. */
const BRUSHES = {
  green: brush('g', '#15781B', 0.88, 10), red: brush('r', '#882020', 0.88, 10), blue: brush('b', '#003088', 1, 10), yellow: brush('y', '#e68f00', 1, 10),
  own: brush('co', '#1f6fe0', 0.88), opp: brush('cp', '#c62f2f', 0.88), weak: brush('cw', '#e09a00', 0.88),
  ceval: brush('ce', '#8b5cf6', 0.85, 12), cevalPale: brush('cep', '#8b5cf6', 0.38, 9),
  ownDim: brush('cod', '#1f6fe0', 0.3), oppDim: brush('cpd', '#c62f2f', 0.3), weakDim: brush('cwd', '#e09a00', 0.3),
}

function config() {
  return {
    fen: props.fen,
    orientation: props.orientation,
    animation: { enabled: !reduceMotion },
    turnColor: turnColor(),
    lastMove: props.lastMove as Key[] | undefined,
    check: isCheck(props.fen),
    movable: {
      free: false,
      color: props.movable ? turnColor() : undefined,
      dests: props.movable ? (legalDests(props.fen) as Map<Key, Key[]>) : new Map<Key, Key[]>(),
      showDests: true,
      events: { after: onAfter },
    },
    draggable: { enabled: props.movable },
    selectable: { enabled: props.movable },
    drawable: {
      // Own analysis marks like Lichess: right-drag = arrow, right-click = circle; Shift red, Alt blue, Shift+Alt yellow.
      enabled: true,
      visible: true,
      eraseOnClick: true,
      brushes: BRUSHES,
      autoShapes: [
        ...boardShapes(props.shapes ?? []).map((c) => ({ ...c, orig: c.orig as Key, dest: c.dest as Key | undefined })),
        ...(props.marks ?? []).map((m) => ({ orig: m.orig as Key, dest: m.dest as Key | undefined, brush: m.brush })),
        ...props.arrows.map((a) => ({ orig: a.orig as Key, dest: a.dest as Key, brush: a.brush })),
        ...tintShapes.value,
        ...threats.value.map((t) => ({ orig: t.orig as Key, dest: t.dest as Key, brush: t.brush, ...(t.label ? { label: t.label } : {}) })),
        ...(props.highlight ?? []).map((sq) => ({ orig: sq as Key, brush: 'yellow' })),
      ],
    },
  }
}

let syncedFen: string | null = null
function resync() { api?.set(syncConfig(config(), syncedFen)); syncedFen = props.fen }

// ----- optional layers (hanging pieces, counts, control, threats, reach of a piece), all off by default -----
const active = computed(() => activeLayers(layerSettings.value, props.layerLock ?? false))
watch(() => props.layerLock, (v) => { layersLocked.value = v ?? false }, { immediate: true })
onBeforeUnmount(() => { layersLocked.value = false })
const hovered = ref<string | null>(null)
const pinned = ref<string | null>(null)
const focusSquare = computed(() => (active.value.has('reach') ? (hovered.value ?? pinned.value) : null))
const model = computed(() => layerModel(props.fen, props.orientation, active.value, focusSquare.value))
watch(() => props.fen, (next, prev) => { soundOnPositionChange(prev, next) })
watch(() => props.fen, () => { pinned.value = null; hovered.value = null; api?.setShapes([]) }) // own marks belong to one position
/** Control tints are drawn in chessground's layer below the pieces, so the Staunton pieces keep their colours. */
const TINT = { own: [31, 111, 224], opp: [198, 47, 47] } as const
const tintShapes = computed(() => model.value.tints.map((t) => {
  const [r, g, b] = t.own ? TINT.own : TINT.opp
  const alpha = [0, 0.14, 0.24, 0.34][t.level]
  return { orig: t.square as Key, below: true, customSvg: { html: `<rect width="100" height="100" fill="rgba(${r},${g},${b},${alpha})"/>` } }
}))

function squareAt(e: MouseEvent): string | null {
  const r = wrap.value?.getBoundingClientRect()
  if (!r || !r.width) return null
  const fx = Math.floor(((e.clientX - r.left) / r.width) * 8)
  const fy = Math.floor(((e.clientY - r.top) / r.height) * 8)
  if (fx < 0 || fx > 7 || fy < 0 || fy > 7) return null
  const white = props.orientation === 'white'
  return `${'abcdefgh'[white ? fx : 7 - fx]}${white ? 8 - fy : fy + 1}`
}
const onHover = (e: MouseEvent) => { if (active.value.has('reach')) hovered.value = squareAt(e) }
const onTap = (e: MouseEvent) => { if (active.value.has('reach')) { const s = squareAt(e); pinned.value = pinned.value === s ? null : s } }

/** Threats: what the side that is not to move would play after a pass (null move, Stockfish at coach depth; shares the coach cache). */
const threats = ref<ThreatShape[]>([])
let threatToken = 0
let threatTimer: ReturnType<typeof setTimeout> | undefined
async function runThreats(fen: string, tries = 0) {
  const mine = ++threatToken
  clearTimeout(threatTimer)
  threats.value = []
  if (!active.value.has('threats')) return
  const epoch = engineEpoch()
  try {
    const found = await threatsByNullMove(fen, cachedEngine(getCoachEngine(), sharedCoachCache), COACH_DEPTH)
    if (mine === threatToken) threats.value = threatShapes(fen, props.orientation, found)
  } catch (e) {
    if (mine !== threatToken) return
    if (e instanceof CancelledError) { if (tries < 12) threatTimer = setTimeout(() => void runThreats(fen, tries + 1), 600); return } // another coach job or a game move had the engine
    if (e instanceof EngineError) resetEngine('coach', epoch)
  }
}
watch(() => [props.fen, props.orientation, active.value.has('threats')] as const, () => void runThreats(props.fen), { immediate: true })
onBeforeUnmount(() => { threatToken++; clearTimeout(threatTimer) })

/** The parent rejects a move by leaving the fen prop alone: then the piece has to go back, which only a config with the fen does (resync drops an unchanged fen). */
function putBackIfRejected() {
  if (props.fen === syncedFen) api?.set(config())
  else resync()
}

function onAfter(from: Key, to: Key) {
  if (needsPromotion(props.fen, from, to)) {
    pending.value = { from, to }
    return
  }
  emit('move', toUci(from, to))
  void nextTick(putBackIfRejected)
}

function pick(piece: PromotionPiece) {
  const p = pending.value
  pending.value = null
  if (!p) return
  emit('move', toUci(p.from, p.to, piece))
  void nextTick(putBackIfRejected)
}

function cancelPromotion() {
  pending.value = null
  resync()
}

onMounted(() => { api = Chessground(el.value!, config()); syncedFen = props.fen })
onBeforeUnmount(() => api?.destroy())
watch(() => [props.fen, props.orientation, props.movable, props.arrows, props.marks, props.lastMove, props.highlight, props.errSquares, props.shapes, threats.value, tintShapes.value], resync, { deep: true })
</script>

<template>
  <div class="board-box" :class="{ wobble }">
    <div ref="wrap" class="board-wrap" @mousemove="onHover" @mouseleave="hovered = null" @click="onTap">
      <div ref="el" class="board"></div>
      <BoardLayers :model="model" :orientation="orientation" :hovered="focusSquare" />
      <div v-for="(st, i) in errStyles" :key="i" class="flash err" :style="st" aria-hidden="true"></div>
      <div v-if="flash && flashStyle" class="flash" :class="flash.kind" :style="flashStyle" aria-hidden="true"></div>
    </div>
    <PromotionDialog v-if="pending" :color="turnColor()" @pick="pick" @cancel="cancelPromotion" />
  </div>
</template>

<style scoped>
.board-box { flex: none; width: var(--bs, min(632px, 100%)); padding: 6px; background: var(--acc); border-radius: 6px; }
.board-wrap { position: relative; width: 100%; aspect-ratio: 1; }
.board { width: 100%; height: 100%; }
.flash { position: absolute; width: 12.5%; height: 12.5%; border: 4px solid; pointer-events: none; animation: fadein var(--t-fast) var(--ease-out); }
.flash.ok { border-color: var(--sq-ok); }
.flash.err { border-color: var(--sq-err); }
@keyframes fadein { from { opacity: 0; } }
.board-box.wobble { animation: wobble 240ms ease-in-out; }
@keyframes wobble { 0%, 100% { transform: translateX(0); } 17% { transform: translateX(-3px); } 33% { transform: translateX(3px); } 50% { transform: translateX(-3px); } 67% { transform: translateX(3px); } 83% { transform: translateX(-3px); } }
@media (prefers-reduced-motion: reduce) { .board-box.wobble { animation: none; } }
</style>
