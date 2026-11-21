<script setup lang="ts">
import { computed } from 'vue'
import { openStates, setOpen } from './compact.ts'

/** Collapsible block (closed by default); the state is remembered per id. */
const props = defineProps<{ id: string; title: string }>()
const open = computed(() => openStates.value[props.id] ?? false)
</script>

<template>
  <div class="disc">
    <button type="button" class="dhead" :aria-expanded="open" @click="setOpen(id, !open)">
      <span class="car" :class="{ open }" aria-hidden="true">▸</span>{{ title }}
    </button>
    <div v-if="open" class="dbody"><slot /></div>
  </div>
</template>

<style scoped>
.disc { margin: 0.35rem 0; }
.dhead { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 2px; border: 0; background: none; color: var(--muted); font: inherit; font-size: var(--fs-small, 0.85rem); font-weight: 600; cursor: pointer; text-align: left; }
.dhead:hover, .dhead:focus-visible { color: var(--text); }
.car { display: inline-block; transition: transform var(--t-fast); }
.car.open { transform: rotate(90deg); }
.dbody { padding: 2px 0 4px; }
</style>
