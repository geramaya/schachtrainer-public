<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MaiaStatus } from '../maia/client.ts'
import { loadingText, maiaStatusMode, READY_SHOWN_MS } from '../maia/status-text.ts'

/**
 * State of Maia. While loading, checking or failed: a block of fixed height (text line, bar row, button row), so the
 * changing text never shifts the layout. "Ready" is one short line for a few seconds, then the room is free again.
 */
const props = defineProps<{ status: MaiaStatus; /** the page may offer "preload" (before a game) */ preload: boolean }>()
const emit = defineEmits<{ load: [] }>()
const readyExpired = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.status.state, (state) => {
  clearTimeout(timer)
  readyExpired.value = false
  if (state === 'ready') timer = setTimeout(() => { readyExpired.value = true }, READY_SHOWN_MS)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
const mode = computed(() => maiaStatusMode(props.status, { setup: props.preload, readyShownMs: readyExpired.value ? READY_SHOWN_MS : 0 }))
const pct = computed(() => (props.status.state === 'loading' ? (props.status.phase === 'verify' ? 100 : Math.min(100, Math.floor((props.status.loaded / (props.status.total || 1)) * 100))) : props.status.state === 'ready' ? 100 : 0))
const detail = computed(() => (props.status.state === 'error' ? props.status.message : ''))
</script>

<template>
  <p v-if="mode === 'line'" class="maialine" role="status" aria-live="polite">{{ loadingText(status) }}</p>
  <div v-else-if="mode === 'full'" class="maiastat" :class="status.state" role="status" aria-live="polite">
    <p class="line" :title="detail">{{ loadingText(status) }}</p>
    <progress class="bar" max="100" :value="pct" :aria-label="'Ladefortschritt Maia'" />
    <div class="act">
      <button v-if="status.state === 'error'" type="button" @click="emit('load')">Erneut versuchen</button>
      <button v-else-if="status.state === 'idle' && preload" type="button" @click="emit('load')">Maia vorab laden</button>
    </div>
  </div>
</template>

<style scoped>
.maiastat { box-sizing: border-box; height: 7rem; margin: 0.4rem 0; display: grid; grid-template-rows: 2.8rem 0.6rem 2rem; gap: 0.3rem; align-content: start; }
.maialine { margin: 0.2rem 0; font-size: var(--fs-small, 0.85rem); color: var(--ok-text); }
.line { margin: 0; font-size: var(--fs-small, 0.85rem); line-height: 1.4; overflow: hidden; }
.error .line { color: var(--err-text); font-weight: 600; }
.ready .line { color: var(--ok-text); }
.bar { width: 100%; height: 0.6rem; }
.idle .bar, .error .bar { visibility: hidden; }
.act { min-height: 2rem; }
</style>
