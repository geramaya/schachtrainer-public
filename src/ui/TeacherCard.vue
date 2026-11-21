<script setup lang="ts">
import TeacherAvatar from './TeacherAvatar.vue'
import TeacherHead from './TeacherHead.vue'
import Icon from './Icon.vue'
import type { FigurId, Gefuehl } from '../teacher/avatar.ts'

/** The teacher's speech bubble: verdict, sentence, repertoire note; with the four buttons while a Fehler/Patzer waits for a decision. */
const props = withDefaults(defineProps<{
  figur: FigurId
  name: string
  gefuehl: Gefuehl
  /** "?? Patzer" etc.; empty for pure notes */
  headline?: string
  severity?: string
  /** tooltip of the verdict badge: what the category means for this move */
  tip?: string
  text: string
  note?: string
  /** shown after "Besten Zug zeigen" */
  reveal?: string
  /** a Fehler/Patzer is waiting: show the decision buttons */
  blocked: boolean
  hinted: boolean
  /** the teacher's quip (speech bubble at the avatar, shown briefly) */
  quip?: string
  /** an inaccurate (ungenau) move: the better move can be asked for */
  later?: boolean
  /** a repertoire deviation: the planned move can be asked for */
  repertoireOffer?: boolean
  quips: boolean
  speak: boolean
  audio: boolean
  /** on/off switch in the head (views where the teacher can be switched); undefined = no switch */
  on?: boolean
  /** the teacher cannot be changed here (a running game) */
  lockFigur?: boolean
}>(), { on: undefined, lockFigur: false })
const emit = defineEmits<{ hint: []; best: []; later: []; repertoire: []; quips: [boolean]; speak: [boolean]; figur: [FigurId]; on: [boolean] }>()
</script>

<template>
  <section class="teacher" :class="[severity, { held: blocked }]" aria-label="Lehrer">
    <p v-if="blocked" class="ask" role="alert">Rückfrage vom Trainer</p>
    <TeacherHead :figur="figur" :name="name" :on="on" :lock-figur="lockFigur" :quips="quips" :speak="speak" :audio="audio" @figur="emit('figur', $event)" @on="emit('on', $event)" @quips="emit('quips', $event)" @speak="emit('speak', $event)" />
    <template v-if="on !== false">
      <div class="main">
        <TeacherAvatar :figur="figur" :gefuehl="gefuehl" />
        <div class="bubble" role="status">
          <p v-if="headline" class="who"><span class="badge" :class="severity" :title="tip" tabindex="0">{{ headline }}</span></p>
          <p v-if="text" class="said">{{ text }}</p>
          <p v-if="note" class="note">{{ note }}</p>
          <button v-if="repertoireOffer" type="button" class="later" @click="emit('repertoire')">Repertoirezug zeigen</button>
          <p v-if="reveal" class="reveal">{{ reveal }}</p>
          <button v-else-if="later" type="button" class="later" @click="emit('later')"><Icon name="target" :size="16" /> Warum? Besseren Zug zeigen</button>
        </div>
      </div>
      <p v-if="quips" class="quip" :class="{ empty: !quip }" role="status" data-testid="quip" :aria-hidden="!quip">{{ quip }}</p>
      <div v-if="blocked" class="decide">
        <button type="button" :disabled="hinted" title="Markiert die Figur des besten Zuges (Taste H)" @click="emit('hint')"><Icon name="hint" /> Hinweis</button>
        <button type="button" :disabled="!!reveal" title="Zeigt den besten Zug als Pfeil" @click="emit('best')"><Icon name="target" /> Bester Zug</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.teacher { min-width: 0; display: grid; gap: 0.5rem; align-items: start; margin: 0.6rem 0; padding: 0.6rem; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
.main { display: grid; grid-template-columns: auto 1fr; gap: 0.7rem; align-items: start; }
.bubble { min-width: 0; min-height: 8em; } /* the text is never cut: the card grows with it (the board does not move) */
.bubble p { margin: 0.15rem 0; }
.who { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 1.05rem; font-weight: 800; line-height: 1.3; white-space: nowrap; color: var(--ink); background: var(--q-best); cursor: help; }
.badge.ungenau { background: var(--q-inaccuracy); }
.badge.fehler { background: var(--q-mistake); }
.badge.patzer { background: var(--q-blunder); }
.said { font-size: var(--fs-body, 1rem); }
.note { color: var(--muted); }
.reveal { border-left: 3px solid var(--acc); padding-left: 0.5rem; }
.quip { grid-column: 1 / -1; position: relative; height: 3.4em; overflow-y: auto; box-sizing: border-box; margin: 0.35rem 0 0.2rem; padding: 0.45rem 0.7rem; border: 1px solid var(--acc); border-radius: 12px; background: var(--panel); font-style: italic; animation: quip-in 0.25s ease-out; }
.quip::before { content: ''; position: absolute; top: -7px; left: 22px; width: 12px; height: 12px; background: var(--panel); border-left: 1px solid var(--acc); border-top: 1px solid var(--acc); transform: rotate(45deg); }
.quip.empty { visibility: hidden; animation: none; }
@keyframes quip-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .quip { animation: none; } }
.decide { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.decide button { display: inline-flex; white-space: nowrap; align-items: center; justify-content: center; gap: 6px; min-height: 42px; min-width: 0; padding-inline: 0.4rem; border-radius: 8px; border: 1px solid var(--line); background: var(--panel); color: var(--text); font: inherit; font-weight: 600; cursor: pointer; }
.decide button:disabled { color: var(--muted); border-style: dashed; cursor: default; }
.decide button:not(:disabled):hover { filter: brightness(1.15); }
.decide kbd { font: 700 11px/1 var(--mono); padding: 2px 5px; border: 1px solid currentColor; border-radius: 4px; opacity: 0.75; }
.ask { margin: 0; font-weight: 800; font-size: 1.05rem; color: var(--text); }
.teacher.held { border-width: 2px; background: color-mix(in srgb, var(--q-mistake) 16%, var(--panel-2)); }
.teacher.held.patzer { background: color-mix(in srgb, var(--q-blunder) 18%, var(--panel-2)); }
.teacher.best, .teacher.excellent, .teacher.gut { border-color: var(--q-best); }
.teacher.ungenau { border-color: var(--q-inaccuracy); }
.teacher.fehler { border-color: var(--q-mistake); }
.teacher.patzer { border-color: var(--q-blunder); }
</style>
