<script setup lang="ts">
import { STAGES, hrefVariation } from '../router.ts'
import type { Stage } from '../router.ts'
import type { VariationStages } from '../train/pipeline.ts'

defineProps<{ variationId: string; stage: Stage; states: VariationStages; partial?: string }>()
const LABEL: Record<Stage, string> = { lernen: 'Lernen', verstehen: 'Verstehen', festigen: 'Festigen', anwenden: 'Anwenden' }
</script>

<template>
  <nav class="stepper" aria-label="Stufen">
    <template v-for="(s, i) in STAGES" :key="s">
      <span v-if="i > 0" class="link" :class="{ fill: states[STAGES[i - 1]!] === 'fertig' }"></span>
      <a class="step" :class="[states[s], { on: s === stage }]" :href="hrefVariation(variationId, s)" :aria-current="s === stage ? 'step' : undefined">
        <span class="num" aria-hidden="true">{{ states[s] === 'fertig' ? '✓' : i + 1 }}</span>
        {{ LABEL[s] }}
        <span v-if="states[s] === 'fertig'" class="sr">(fertig)</span>
        <span v-else-if="states[s] === 'begonnen'" class="sr">(begonnen)</span>
        <span v-if="s === stage && partial" class="part">{{ partial }}</span>
      </a>
    </template>
  </nav>
</template>

<style scoped>
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.step { position: relative; }
</style>
