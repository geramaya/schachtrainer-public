<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { PromotionPiece } from '../chess/game.ts'
defineProps<{ color: 'white' | 'black' }>()
const emit = defineEmits<{ pick: [piece: PromotionPiece]; cancel: [] }>()
const pieces: { id: PromotionPiece; role: string; label: string }[] = [
  { id: 'q', role: 'queen', label: 'Dame' },
  { id: 'r', role: 'rook', label: 'Turm' },
  { id: 'b', role: 'bishop', label: 'Läufer' },
  { id: 'n', role: 'knight', label: 'Springer' },
]

function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('cancel') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="promo-backdrop" @click.self="emit('cancel')">
    <div class="promo cg-wrap" role="dialog" aria-modal="true" aria-label="Umwandlung wählen">
      <button v-for="p in pieces" :key="p.id" class="promo-btn" :title="p.label" :aria-label="p.label" @click="emit('pick', p.id)">
        <piece :class="[p.role, color]"></piece>
      </button>
    </div>
  </div>
</template>

<style scoped>
.promo-backdrop { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(0, 0, 0, 0.55); }
.promo { display: flex; gap: 6px; padding: 8px; background: var(--panel); border-radius: 10px; }
.promo-btn { width: 72px; height: 72px; padding: 0; background: #b58863; border: 2px solid transparent; border-radius: 8px; cursor: pointer; position: relative; }
.promo-btn:hover { border-color: var(--acc); }
/* chessground's `.cg-wrap piece` sizes pieces to 12.5% of the board; inside a button the piece fills the button. */
.promo-btn piece { position: absolute; inset: 0; width: 100%; height: 100%; transform: none; display: block; background-size: cover; }
</style>
