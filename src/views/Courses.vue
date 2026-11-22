<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { ContentBundle } from '../content/types.ts'
import { courseCta, courseRows, STAGE_NAME } from '../train/course.ts'
import { hrefHome, hrefLehrgang, hrefOpening } from '../router.ts'
import { ensureLehrgaenge, lehrgaenge, lehrgangFehler, lehrgangState } from '../lehrgang/state.ts'
import { stufeFortschritt } from '../lehrgang/store.ts'
import { STAGES } from '../router.ts'
import { progress } from '../store/state.ts'

const props = defineProps<{ bundle: ContentBundle }>()
onMounted(() => void ensureLehrgaenge())
const kern = (l: NonNullable<typeof lehrgaenge.value>[number]) => stufeFortschritt(lehrgangState.value, l, 'kern')
const rows = computed(() => courseRows(props.bundle, progress.value, Date.now()))
const GROUPS = [{ id: 'main', title: 'Main Stack' }, { id: 'alt', title: 'Alternativen & Phase 2' }] as const
const groups = computed(() => GROUPS.map((g) => ({ ...g, rows: rows.value.filter((r) => r.group === g.id) })))
const pct = (r: (typeof rows.value)[number], s: (typeof STAGES)[number]) => (r.bars[s].total ? Math.round((100 * r.bars[s].done) / r.bars[s].total) : 0)
const cls = (r: (typeof rows.value)[number], s: (typeof STAGES)[number]) => (r.bars[s].total && r.bars[s].done >= r.bars[s].total ? 'done' : r.bars[s].done > 0 ? 'part' : '')
</script>

<template>
  <p class="crumbs"><a :href="hrefHome()">Start</a> › Kurse</p>
  <header class="cphead">
    <h1>Kurse</h1>
    <p class="muted">Deine zehn Eröffnungen als Lehrgänge, Stufe für Stufe vom Lernen bis zum Anwenden.</p>
  </header>
  <section aria-labelledby="lg-h">
    <div class="group"><h2 id="lg-h">Lehrgänge (1200–1600)</h2><span class="muted">neu: nach Häufigkeit auf deiner Stärke geordnet</span></div>
    <p v-if="lehrgangFehler" class="err" role="alert">{{ lehrgangFehler }}</p>
    <div class="courses lgs">
      <a v-for="l in lehrgaenge ?? []" :key="l.id" class="course lgc" :href="hrefLehrgang(l.id)">
        <div class="c-id"><span class="muted small"><span class="side-dot" :class="l.side"></span>{{ l.side === 'white' ? 'Weiß' : 'Schwarz' }}</span></div>
        <div class="c-main"><h3>{{ l.name }}</h3><p class="muted">Spielplan, Kern-Varianten, Fallen</p></div>
        <p class="muted c-steps">Kern: {{ kern(l).done }} von {{ kern(l).total }} aus dem Kopf<template v-if="l.offen"> · {{ l.offen }} Texte folgen</template></p>
        <div class="c-end"><span class="c-cta">Lehrgang öffnen ▸</span></div>
      </a>
    </div>
  </section>
  <section aria-labelledby="rep-h"><div class="group"><h2 id="rep-h">Repertoire-Kurse</h2><span class="muted">bestehend, alle Varianten, dein Lernstand</span></div></section>
  <template v-for="g in groups" :key="g.id">
    <div class="group"><h3 class="gsub">{{ g.title }}</h3><span class="muted">{{ g.rows.length }} Lehrgänge</span></div>
    <div class="courses">
      <component :is="r.available ? 'a' : 'div'" v-for="r in g.rows" :key="r.id" class="course" :class="{ soon: !r.available }" :style="{ '--acc': r.acc }" :href="r.available ? hrefOpening(r.id) : undefined">
        <div class="c-id"><span class="code">{{ r.code }}</span><span class="muted small"><span class="side-dot" :class="r.side"></span>{{ r.side === 'white' ? 'Weiß' : 'Schwarz' }}</span></div>
        <div class="c-main"><h3>{{ r.name }}</h3><p class="muted">{{ r.role }}</p><p class="mono">{{ r.entryText }}</p></div>
        <ol v-if="r.available" class="c-steps" aria-label="Fortschritt je Stufe">
          <li v-for="(s, i) in STAGES" :key="s" :class="cls(r, s)">
            <span class="pbar"><i :style="{ width: pct(r, s) + '%' }"></i></span>
            <span>{{ i + 1 }} {{ STAGE_NAME[s] }}</span>
          </li>
        </ol>
        <p v-else class="muted c-steps">In Vorbereitung: Linie wird gebaut.</p>
        <div v-if="r.available" class="c-end">
          <b class="big">{{ r.pct }} %</b>
          <span class="small">{{ r.count }} Varianten<template v-if="r.due"> · <span class="pill">{{ r.due }} fällig</span></template></span>
          <span class="c-cta">{{ courseCta(r.step) }}</span>
        </div>
      </component>
    </div>
  </template>
</template>

<style scoped>
.lgc { grid-template-columns: 88px minmax(0, 1.3fr) minmax(0, 1.6fr) 200px; min-height: 5.2rem; }
.gsub { margin: 0; font-size: 1.05rem; }
.lgc .c-steps { display: block; }
</style>
