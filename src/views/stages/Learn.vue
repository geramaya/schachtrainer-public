<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Explanation } from '../../content/types.ts'
import { badgeLabel } from '../../train/lesson.ts'
import { NOTE_MAX, rate } from '../../train/feedback.ts'
import { progress, update } from '../../store/state.ts'
import type { Verdict } from '../../train/feedback.ts'

const props = defineProps<{ explanation?: Explanation; hasLesson: boolean; contentVersion: string; festigenHref: string }>()

const feedback = computed(() => progress.value.feedback)
const note = ref('')
const current = computed(() => (props.explanation ? feedback.value[props.explanation.id] : undefined))

function store(id: string, verdict: Verdict, text: string) {
  update((p) => ({ ...p, feedback: rate(p.feedback, id, verdict, text.trim() || undefined, props.contentVersion) }))
}

/** Saves the note of the explanation we are leaving (only if it was already rated). */
function saveNote(id: string | undefined) {
  const fb = id ? feedback.value[id] : undefined
  if (id && fb && (fb.note ?? '') !== note.value.trim()) store(id, fb.verdict, note.value)
}
watch(() => props.explanation?.id, (now, before) => { saveNote(before); note.value = (now ? feedback.value[now]?.note : '') ?? '' }, { immediate: true })
onBeforeUnmount(() => saveNote(props.explanation?.id))

const noteOpen = ref(false)
watch(() => props.explanation?.id, () => { noteOpen.value = false })
const showNote = computed(() => noteOpen.value || note.value !== '' || current.value?.verdict === 'stimmt-nicht')

const outdated = computed(() => !!current.value && current.value.contentVersion !== props.contentVersion)

function send(verdict: Verdict) {
  if (props.explanation) store(props.explanation.id, verdict, note.value)
  if (verdict === 'stimmt-nicht') noteOpen.value = true
}
</script>

<template>
  <div v-if="!hasLesson" class="empty-card">
    <p>Für diese Variante gibt es noch keine Lektion. Du kannst sie trotzdem festigen.</p>
    <p><a class="primary linkbtn" :href="festigenHref">Festigen</a></p>
  </div>
  <template v-else>
    <article v-if="explanation" :key="explanation.id" class="expl">
      <div class="lhead">
        <span class="badge" :class="explanation.status">{{ badgeLabel(explanation.status) }}</span>
        <span class="rate" role="group" aria-label="Passt die Erklärung?">
          <button :class="{ on: current?.verdict === 'passt' }" :aria-pressed="current?.verdict === 'passt'" title="passt" aria-label="passt" @click="send('passt')">✓</button>
          <button :class="{ on: current?.verdict === 'stimmt-nicht' }" :aria-pressed="current?.verdict === 'stimmt-nicht'" title="stimmt nicht" aria-label="stimmt nicht" @click="send('stimmt-nicht')">✗</button>
          <button :aria-pressed="showNote" title="Notiz zur Erklärung" aria-label="Notiz" @click="noteOpen = !noteOpen">✎</button>
        </span>
      </div>
      <h3>{{ explanation.title }}</h3>
      <p>{{ explanation.text }}</p>
      <textarea v-if="showNote" v-model="note" :maxlength="NOTE_MAX" rows="2" placeholder="Notiz (optional, höchstens 500 Zeichen)" aria-label="Notiz zur Erklärung" @blur="saveNote(explanation?.id)"></textarea>
      <p v-if="current" class="muted">Gespeichert: {{ current.verdict === 'passt' ? 'passt' : 'stimmt nicht' }}<span v-if="outdated"> (zu älterer Fassung)</span></p>
    </article>
    <p v-else class="muted">Zu dieser Stellung gibt es keine Erklärung. Springe über die Rauten der Zeitleiste zu einer Schlüsselstellung.</p>
  </template>
</template>

<style scoped>
.lhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rate { display: flex; gap: 4px; flex-wrap: nowrap; }
.rate button { min-height: 28px; height: 28px; min-width: 32px; padding: 0 8px; text-align: center; }
</style>
