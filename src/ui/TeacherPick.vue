<script setup lang="ts">
import TeacherHead from './TeacherHead.vue'
import Icon from './Icon.vue'
import TeacherAvatar from './TeacherAvatar.vue'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'

/** Game start: free game or with teacher, and which of the four teachers. */
withDefaults(defineProps<{ on: boolean; figur: FigurId; quips: boolean; speak: boolean; audio: boolean; labels?: { on: string; off: string } }>(), { labels: () => ({ on: 'Mit Lehrer', off: 'Freie Partie' }) })
const emit = defineEmits<{ on: [boolean]; figur: [FigurId]; quips: [boolean]; speak: [boolean] }>()
</script>

<template>
  <div class="pick">
    <div class="segs wide" role="group" aria-label="Partieart">
      <button type="button" class="seg" :aria-pressed="on" @click="emit('on', true)"><Icon name="teacher" /> {{ labels.on }}</button>
      <button type="button" class="seg" :aria-pressed="!on" @click="emit('on', false)"><Icon name="free" /> {{ labels.off }}</button>
    </div>
    <!-- folds in and out softly (grid rows 0fr/1fr): the page below does not jump -->
    <div class="fold" :class="{ off: !on }" :inert="!on">
      <div class="inner">
        <div class="segs figs" role="group" aria-label="Lehrer wählen">
          <button v-for="f in FIGUREN" :key="f.id" type="button" class="seg fig" :aria-pressed="f.id === figur" @click="emit('figur', f.id)">
            <TeacherAvatar :figur="f.id" gefuehl="neutral" :size="68" />
            <span class="nm">{{ f.name }}</span>
            <span class="ton">{{ f.ton }}</span>
          </button>
        </div>
        <TeacherHead :figur="figur" :name="FIGUREN.find((f) => f.id === figur)!.name" no-pick :quips="quips" :speak="speak" :audio="audio" @figur="emit('figur', $event)" @quips="emit('quips', $event)" @speak="emit('speak', $event)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pick { margin: 0; }
.segs { margin-bottom: 0.5rem; }
.fold { display: grid; grid-template-rows: 1fr; transition: grid-template-rows var(--t-base) var(--ease-out); }
.fold.off { grid-template-rows: 0fr; }
.inner { overflow: hidden; min-height: 0; }
.inner > .figs { margin-top: 2px; }
@media (prefers-reduced-motion: reduce) { .fold { transition: none; } }
</style>
