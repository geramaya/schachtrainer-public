<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import TeacherAvatar from './TeacherAvatar.vue'
import { FIGUREN } from '../teacher/avatar.ts'
import type { FigurId } from '../teacher/avatar.ts'

/**
 * Head line of every teacher card: small avatar button with a menu for the four teachers, optional on/off switch,
 * and the two quip switches as small icons (sayings, read aloud; the latter only where audio exists).
 */
/** `on` stays undefined when the view has no switch (Vue would otherwise turn an absent boolean into false). */
const props = withDefaults(defineProps<{ figur: FigurId; name: string; quips: boolean; speak: boolean; audio: boolean; on?: boolean; lockFigur?: boolean }>(), { on: undefined, lockFigur: false })
const emit = defineEmits<{ figur: [FigurId]; on: [boolean]; quips: [boolean]; speak: [boolean] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const away = (e: Event) => { if (!root.value?.contains(e.target as Node)) open.value = false }
watch(open, (v) => { if (v) document.addEventListener('pointerdown', away); else document.removeEventListener('pointerdown', away) })
onBeforeUnmount(() => document.removeEventListener('pointerdown', away))
function choose(id: FigurId) { open.value = false; if (id !== props.figur) emit('figur', id) }
</script>

<template>
  <div ref="root" class="thead" @keydown.escape="open = false">
    <div class="pickwrap">
      <button type="button" class="avbtn" :disabled="lockFigur" aria-haspopup="menu" :aria-expanded="open" :title="lockFigur ? name : 'Lehrer wählen'" @click="open = !open">
        <TeacherAvatar :figur="figur" gefuehl="neutral" :size="30" />
        <span class="nm">{{ name }}</span>
        <span v-if="!lockFigur" class="car" aria-hidden="true">▾</span>
      </button>
      <ul v-if="open" class="menu" role="menu" aria-label="Lehrer wählen">
        <li v-for="f in FIGUREN" :key="f.id" role="none">
          <button type="button" role="menuitemradio" :aria-checked="f.id === figur" :class="{ sel: f.id === figur }" @click="choose(f.id)">
            <TeacherAvatar :figur="f.id" gefuehl="neutral" :size="28" /> {{ f.name }}
          </button>
        </li>
      </ul>
    </div>
    <span class="sp"></span>
    <button v-if="on !== undefined" type="button" class="sw" role="switch" :aria-checked="on" :title="on ? 'Lehrer ausschalten' : 'Lehrer einschalten'" @click="emit('on', !on)">
      <span class="knob" aria-hidden="true"></span><b>Lehrer</b>
    </button>
    <button type="button" class="ic" :class="{ act: quips }" :aria-pressed="quips" aria-label="Sprüche" title="Sprüche (spitze Bemerkungen)" @click="emit('quips', !quips)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H10l-4 4v-4H4z" /></svg>
    </button>
    <button v-if="audio" type="button" class="ic" :class="{ act: speak && quips }" :aria-pressed="speak" :disabled="!quips" aria-label="Sprüche vorlesen" title="Sprüche vorlesen" @click="emit('speak', !speak)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6" /></svg>
    </button>
  </div>
</template>

<style scoped>
.thead { display: flex; align-items: center; gap: 6px; min-width: 0; }
.sp { flex: 1; }
.pickwrap { position: relative; min-width: 0; }
.avbtn { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px 2px 3px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); color: var(--text); font: inherit; font-size: var(--fs-small, 0.85rem); font-weight: 600; cursor: pointer; }
.avbtn:disabled { cursor: default; border-color: transparent; background: none; }
.avbtn:not(:disabled):hover, .avbtn:focus-visible { border-color: var(--acc); }
.car { color: var(--muted); font-size: 0.7rem; }
.menu { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; list-style: none; margin: 0; padding: 4px; min-width: 11rem; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }
.menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 3px 8px 3px 4px; border: 1px solid transparent; border-radius: 8px; background: none; color: var(--text); font: inherit; cursor: pointer; text-align: left; }
.menu button:hover, .menu button:focus-visible { background: var(--panel-2); }
.menu button.sel { border-color: var(--acc); }
.sw { display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; border: 0; border-radius: 8px; background: none; color: var(--text); font: inherit; font-size: var(--fs-small, 0.85rem); cursor: pointer; }
.knob { position: relative; width: 30px; height: 17px; border-radius: 9px; background: var(--line); transition: background var(--t-fast); flex: none; }
.knob::after { content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--text); transition: transform var(--t-fast); }
.sw[aria-checked='true'] .knob { background: var(--acc); }
.sw[aria-checked='true'] .knob::after { transform: translateX(13px); background: var(--ink, #111); }
.ic { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: 8px; background: none; color: var(--muted); cursor: pointer; }
.ic:hover:not(:disabled), .ic:focus-visible { color: var(--text); border-color: var(--line); }
.ic.act { color: var(--acc); }
.ic:disabled { opacity: 0.4; cursor: default; }
</style>
