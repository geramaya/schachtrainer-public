<script setup lang="ts">
import { computed } from 'vue'
import type { ContentBundle } from '../content/types.ts'
import { formatLine } from '../chess/notation.ts'
import { hrefHome, hrefVariation } from '../router.ts'
import { dueCards, newCards } from '../train/srs.ts'
import { variationScopes } from '../train/scope.ts'
import { progress } from '../store/state.ts'
import { CATALOG } from '../content/catalog.ts'
import { openingProgress, variationStages } from '../train/pipeline.ts'
import type { StageId, StageState } from '../train/pipeline.ts'
import AudioButton from '../ui/AudioButton.vue'
import { branchLabel } from '../content/intro.ts'
import { groupVariations } from '../content/groups.ts'
import { badgeLabel } from '../train/lesson.ts'

const props = defineProps<{ bundle: ContentBundle; openingId: string }>()
const opening = computed(() => props.bundle.openings.find((o) => o.id === props.openingId))
/** All variations (stages included): progress and counts cover every one of them. */
const variations = computed(() => opening.value?.variations ?? [])
/** The list shows main variations; a stage (partOf) hangs under its main one instead of getting a card of its own. */
const groups = computed(() => groupVariations(variations.value))
const scopes = computed(() => variationScopes(props.bundle, progress.value.overlays))
const cat = computed(() => CATALOG.find((c) => c.id === props.openingId))
const stagesOf = computed(() => new Map(variations.value.map((v) => [v.id, variationStages(props.bundle, progress.value, v.id)])))
const total = computed(() => {
  const p = openingProgress([...stagesOf.value.values()])
  const done = Object.values(p).reduce((n, x) => n + x.done, 0)
  const all = Object.values(p).reduce((n, x) => n + x.total, 0)
  return { done, all, pct: all ? (100 * done) / all : 0 }
})
const STAGE_IDS: StageId[] = ['lernen', 'verstehen', 'festigen', 'anwenden']
const MARK: Record<StageState, string> = { keine: '–', leer: '○', begonnen: '◐', fertig: '●' }
const WORD: Record<StageState, string> = { keine: 'nicht vorhanden', leer: 'leer', begonnen: 'begonnen', fertig: 'fertig' }
const dots = (id: string) => STAGE_IDS.map((s) => ({ s, mark: MARK[stagesOf.value.get(id)![s]], word: `${s} ${WORD[stagesOf.value.get(id)![s]]}` }))
const counts = (id: string) => {
  const cards = Object.values(progress.value.cards)
  const scope = scopes.value.get(id)
  return { due: dueCards(cards, Date.now(), scope).length, fresh: newCards(cards, scope).length }
}
</script>

<template>
  <div v-if="!opening" class="empty-card">
    <p>Diese Eröffnung ist noch nicht gebaut.</p>
    <p><a class="linkbtn" :href="hrefHome()">Zur Startseite</a></p>
  </div>
  <div v-else :style="{ '--acc': cat?.acc ?? 'var(--muted)' }">
    <p class="crumbs"><a :href="hrefHome()">Start</a> › {{ opening.name }}</p>
    <header class="ohead">
      <h1><span class="code">{{ cat?.code }}</span>{{ opening.name }}</h1>
      <p class="muted"><span class="side-dot" :class="opening.side"></span>{{ opening.side === 'white' ? 'Weiß' : 'Schwarz' }} · {{ opening.role }} · Einstieg <span class="vline">{{ formatLine(opening.entry) }}</span></p>
      <div class="pbar" role="img" :aria-label="`Gesamtfortschritt ${total.done} von ${total.all} Stufen`"><i :style="{ width: total.pct + '%' }"></i></div>
      <p class="muted">{{ total.done }} von {{ total.all }} Stufen geschafft</p>
      <AudioButton :audio-id="opening.id" label="Hintergrund anhören" />
    </header>
    <ul class="varlist">
      <li v-for="{ main: v, stages } in groups" :key="v.id" class="vcard">
        <div class="vtop">
          <a class="vname" :href="hrefVariation(v.id)">{{ v.name }}</a>
          <span v-if="v.fromDocument" class="mark">Dok</span>
          <span class="dots4"><span v-for="d in dots(v.id)" :key="d.s" :title="d.word" :aria-label="d.word">{{ d.mark }}</span></span>
          <span class="vcount"><span v-if="counts(v.id).due" class="pill">{{ counts(v.id).due }} fällig</span><span v-else class="muted">{{ counts(v.id).fresh }} neu</span></span>
        </div>
        <p v-if="v.intro" class="vintro"><span v-if="v.intro.draft" class="badge entwurf" title="Text aus der Zugfolge erzeugt, noch nicht freigegeben">{{ badgeLabel('entwurf') }}</span> {{ v.intro.text }}</p>
        <div class="vfoot">
          <span v-if="branchLabel(opening.entry, v.line)" class="vbranch">{{ branchLabel(opening.entry, v.line) }}</span>
          <details class="vmoves"><summary>Zugfolge</summary><span class="vline">{{ formatLine(v.line) }}</span></details>
        </div>
        <details v-if="stages.length" class="vstages">
          <summary>{{ stages.length === 1 ? 'Gleiche Linie unter weiterem Namen' : `Gleiche Linie unter ${stages.length} weiteren Namen` }}</summary>
          <ul>
            <li v-for="st in stages" :key="st.id">
              <a :href="hrefVariation(st.id)">{{ st.name }}</a>
              <span class="dots4"><span v-for="d in dots(st.id)" :key="d.s" :title="d.word" :aria-label="d.word">{{ d.mark }}</span></span>
              <span v-if="counts(st.id).due" class="pill">{{ counts(st.id).due }} fällig</span>
            </li>
          </ul>
        </details>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.vstages { position: relative; z-index: 1; margin-top: 0.5rem; padding-left: 1rem; border-left: 2px solid var(--line, currentColor); font-size: var(--fs-small); color: var(--muted); }
.vstages summary { cursor: pointer; }
.vstages ul { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.25rem; }
.vstages li { display: flex; align-items: baseline; gap: 0.7rem; flex-wrap: wrap; }
</style>
