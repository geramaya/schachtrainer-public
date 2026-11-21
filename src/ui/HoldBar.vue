<script setup lang="ts">
import Icon from './Icon.vue'
import type { EngineStatusKind } from './history.ts'

/**
 * The strip at the board (fixed height, so nothing shifts): the opponent status in one line, the notice while an earlier position is shown,
 * and, while the teacher holds the game, the question to the player with the decision buttons.
 */
defineProps<{
  status: { kind: EngineStatusKind; text: string }
  /** "Ansicht Zug n – …" while browsing, else empty */
  notice: string
  /** the held verdict ("Fehler" / "Patzer"), null = nothing held */
  held: 'fehler' | 'patzer' | null
}>()
const emit = defineEmits<{ keep: []; undo: []; best: [] }>()
</script>

<template>
  <div class="hold" :class="[held ? `held ${held}` : '', status.kind]">
    <template v-if="held">
      <div class="q" role="alert">
        <b class="h">Rückfrage vom Trainer</b>
        <span>Dein Zug war {{ held === 'patzer' ? 'ein Patzer' : 'ein Fehler' }} – zurücknehmen oder weiterspielen?</span>
      </div>
      <div class="btns">
        <button type="button" class="go" title="Weiterspielen (Leertaste)" @click="emit('keep')"><Icon name="play" /> Weiterspielen <kbd>␣</kbd></button>
        <button type="button" title="Zug zurücknehmen" @click="emit('undo')"><Icon name="undo" /> Zurücknehmen</button>
        <button type="button" title="Besten Zug übernehmen (Taste B)" @click="emit('best')"><Icon name="take" /> Besten übernehmen <kbd>B</kbd></button>
      </div>
    </template>
    <template v-else>
      <span class="st" role="status"><i class="dot" aria-hidden="true"></i>{{ status.text }}</span>
      <span v-if="notice" class="notice" role="status">{{ notice }}</span>
    </template>
  </div>
</template>

<style scoped>
.hold { box-sizing: border-box; height: var(--hold, 92px); display: flex; align-items: center; gap: 12px; padding: 0 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--text); font-size: var(--fs-small, 0.85rem); overflow: hidden; }
.st { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); }
.thinking .dot { background: var(--acc); animation: pulse 1s ease-in-out infinite; }
.ready .dot { background: var(--ok); }
.notice { margin-left: auto; color: var(--hint); font-weight: 600; text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.held { flex-direction: column; align-items: stretch; justify-content: center; gap: 6px; border-width: 2px; background: color-mix(in srgb, var(--q-mistake) 22%, var(--panel)); border-color: var(--q-mistake); animation: slide-in 0.25s ease-out; }
.held.patzer { background: color-mix(in srgb, var(--q-blunder) 24%, var(--panel)); border-color: var(--q-blunder); }
.q { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 8px; min-width: 0; line-height: 1.25; }
.h { font-size: 1.05rem; }
.btns { display: flex; gap: 6px; flex: none; justify-content: flex-end; }
.btns button { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btns button.go { background: var(--acc); color: var(--ink); border-color: var(--acc); font-size: 1rem; height: 44px; padding: 0 16px; }
.btns button:hover { filter: brightness(1.12); }
.btns button:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
kbd { font: 700 11px/1 var(--mono); padding: 2px 5px; border: 1px solid currentColor; border-radius: 4px; opacity: 0.8; }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes slide-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .held, .thinking .dot { animation: none; } }
@container (max-width: 560px) { .btns button { padding: 0 8px; } .btns kbd { display: none; } }
</style>
