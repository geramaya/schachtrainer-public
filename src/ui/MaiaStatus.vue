<script setup lang="ts">
import { computed } from 'vue'
import type { MaiaStatus } from '../maia/client.ts'
import { loadingText } from '../maia/status-text.ts'

/**
 * State of Maia (loading bar, check, ready, error). The block has a fixed height in every state (text line, bar row, button row),
 * so loading or an error never shifts the layout around it.
 */
const props = defineProps<{ status: MaiaStatus; /** the page may offer "preload" (before a game) */ preload: boolean }>()
const emit = defineEmits<{ load: [] }>()
const pct = computed(() => (props.status.state === 'loading' ? (props.status.phase === 'verify' ? 100 : Math.min(100, Math.floor((props.status.loaded / (props.status.total || 1)) * 100))) : props.status.state === 'ready' ? 100 : 0))
const detail = computed(() => (props.status.state === 'error' ? props.status.message : ''))
</script>

<template>
  <div class="maiastat" :class="status.state" role="status" aria-live="polite">
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
.line { margin: 0; font-size: var(--fs-small, 0.85rem); line-height: 1.4; overflow: hidden; }
.error .line { color: var(--err-text); font-weight: 600; }
.ready .line { color: var(--ok-text); }
.bar { width: 100%; height: 0.6rem; }
.idle .bar, .error .bar { visibility: hidden; }
.act { min-height: 2rem; }
</style>
