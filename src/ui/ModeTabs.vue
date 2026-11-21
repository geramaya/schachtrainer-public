<script setup lang="ts">
defineProps<{ modes: { id: string; label: string }[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
</script>

<template>
  <nav class="modetabs" aria-label="Anwenden: Übungsart">
    <a v-for="m in modes" :key="m.id" href="" :class="{ on: m.id === modelValue }" :aria-current="m.id === modelValue ? 'true' : undefined" @click.prevent="emit('update:modelValue', m.id)">{{ m.label }}</a>
  </nav>
</template>
