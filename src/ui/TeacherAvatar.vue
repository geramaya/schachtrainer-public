<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { avatarChain } from '../teacher/avatar.ts'
import type { FigurId, Gefuehl } from '../teacher/avatar.ts'
import { BASE } from './assetBase.ts'

/** Round teacher picture; a missing feeling falls back to the neutral picture, a missing picture shows nothing. */
const props = withDefaults(defineProps<{ figur: FigurId; gefuehl: Gefuehl; size?: number }>(), { size: 72 })
const chain = computed(() => avatarChain(props.figur, props.gefuehl, BASE))
const tried = ref(0)
watch(chain, () => { tried.value = 0 })
const src = computed(() => chain.value[tried.value])
</script>

<template>
  <img v-if="src" class="avatar" :src="src" alt="" :width="size" :height="size" :style="{ width: size + 'px', height: size + 'px' }" @error="tried++" />
</template>

<style scoped>
.avatar { border-radius: 50%; object-fit: cover; flex: none; border: 2px solid var(--line); background: #1d2430; }
</style>
