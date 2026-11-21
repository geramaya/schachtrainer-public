<script lang="ts">
/** The bars grow only on the first render per page load, not when coming back from another view. */
let barsAnimated = false
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ContentBundle } from '../content/types.ts'
import { CATALOG } from '../content/catalog.ts'
import { BASE } from '../ui/assetBase.ts'
import { courseRows, heroCta, STAGE_NAME } from '../train/course.ts'
import { trainingPlanFor } from '../train/plan-adapter.ts'
import { formatDuration } from '../train/training-result.ts'
import { gamesWonSince, heroBubble, heroImage, heroPose, successSince } from '../train/hero.ts'
import { gameStore } from '../games/idb.ts'
import { listGames } from '../games/library.ts'
import { identityOf } from '../games/identity.ts'
import { treeFor } from '../content/tree.ts'
import { formatLine, toGermanSan } from '../chess/notation.ts'
import { hrefKurse, hrefOpening, hrefPartien, hrefSpielen, hrefTraining, hrefVariation } from '../router.ts'
import { cardId, dueCards, newCards, trainableCards } from '../train/srs.ts'
import { partieQueue } from '../train/partien.ts'
import { variationScopes } from '../train/scope.ts'
import { earliestFuture, openingProgress, variationStages } from '../train/pipeline.ts'
import type { StageId } from '../train/pipeline.ts'
import { daysSinceLast, nextDueLabel, recentDays, streakDays } from '../train/streak.ts'
import { shouldHandleKey } from '../ui/keys.ts'
import { progress, recordVisit } from '../store/state.ts'

const props = defineProps<{ bundle: ContentBundle }>()
const STAGE_LABEL: [StageId, string][] = [['lernen', 'Lernen'], ['verstehen', 'Verstehen'], ['festigen', 'Festigen'], ['anwenden', 'Anwenden']]
const animate = !barsAnimated
barsAnimated = true
/** Reactive clock: refreshed every minute and when the tab becomes visible again, so a tab left open over midnight stays correct. */
const clock = ref(Date.now())
const tick = () => { clock.value = Date.now() }
let timer: ReturnType<typeof setInterval> | undefined

const trainable = computed(() => trainableCards(Object.values(progress.value.cards)))
const due = computed(() => dueCards(trainable.value, clock.value))
const fresh = computed(() => newCards(trainable.value))
const partien = computed(() => partieQueue(Object.values(progress.value.cards), clock.value))
const scopes = computed(() => variationScopes(props.bundle, progress.value.overlays))

const rows = computed(() => courseRows(props.bundle, progress.value, clock.value))
const tiles = computed(() => rows.value.filter((r) => r.group === 'main').map((r, i) => ({ ...r, delay: i * 40 })))

/** Hero: what Ferro says and shows depends on the situation; what happened since the last visit comes from the snapshot taken when the page was left. */
const previousVisit = progress.value.settings.visit
const stagesDone = computed(() => rows.value.reduce((n, r) => n + STAGE_LABEL.reduce((m, [id]) => m + r.bars[id].done, 0), 0))
const wins = ref(0)
const success = computed(() => successSince(previousVisit, { stagesDone: stagesDone.value, streak: streak.value, wins: wins.value }))
const situation = computed(() => ({ due: due.value.length, success: success.value, firstVisit: !previousVisit }))
const pose = computed(() => heroPose(situation.value))
const image = computed(() => heroImage(pose.value))
const bubble = computed(() => heroBubble({ ...situation.value, streak: streak.value }))
const cta = computed(() => {
  const firstOpening = rows.value.filter((r) => r.available).map((r) => props.bundle.openings.find((o) => o.id === r.id)).find((o) => o?.variations.length)
  const c = heroCta({
    last: progress.value.settings.lastCourse,
    stagesOf: (id) => (props.bundle.openings.some((o) => o.variations.some((v) => v.id === id)) ? variationStages(props.bundle, progress.value, id, clock.value) : null),
    startVariationId: firstOpening?.variations[0]?.id ?? '',
  })
  const o = props.bundle.openings.find((x) => x.variations.some((v) => v.id === c.variationId))
  const row = rows.value.find((r) => r.id === o?.id)
  return { ...c, href: c.variationId ? hrefVariation(c.variationId, c.stage) : hrefKurse(), acc: row?.acc ?? 'var(--acc)', detail: row ? `${row.code} · ${STAGE_NAME[c.stage]}` : '' }
})
const saveVisit = () => recordVisit({ at: Date.now(), stagesDone: stagesDone.value, streak: streak.value })

/** The ten-minute mix is the daily task: the same plan the training page builds, so the button only shows what it can deliver. */
const trainPlan = computed(() => trainingPlanFor(props.bundle, progress.value, clock.value))
const practiceHref = computed(() => (trainPlan.value.tasks.length ? hrefTraining() : ''))

const owner = (vid: string) => props.bundle.openings.find((o) => o.variations.some((v) => v.id === vid))
const queue = computed(() =>
  due.value.slice(0, 3).map((c) => {
    const code = CATALOG.find((x) => x.id === owner(c.variationId)?.id)
    const san = treeFor(props.bundle, c.openingId)[c.key]?.candidates.find((m) => m.uci === c.expectedUci)?.san
    return { key: cardId(c), code: code?.code ?? '', acc: code?.acc ?? 'var(--muted)', text: san ? toGermanSan(san) : '' }
  }),
)
const minutes = computed(() => Math.max(1, Math.round(trainPlan.value.estimatedSec / 60)))
const bars = computed(() => {
  const days = recentDays(progress.value.days, clock.value, 14)
  const max = Math.max(1, ...days.map((d) => d.count))
  return days.map((d) => ({ ...d, h: d.count ? 6 + Math.round((d.count / max) * 22) : 4 }))
})
const streak = computed(() => streakDays(progress.value.days, clock.value))
const since = computed(() => daysSinceLast(progress.value.days, clock.value))
const nextLabel = computed(() => nextDueLabel(earliestFuture(Object.values(progress.value.cards), clock.value), clock.value))
/** First variation whose lesson stage is still empty: the "learn something new" target. */
const learnHref = computed(() => {
  const v = props.bundle.openings.flatMap((o) => o.variations).find((x) => variationStages(props.bundle, progress.value, x.id, clock.value).lernen === 'leer')
  return v ? hrefVariation(v.id, 'lernen') : ''
})

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  const mods = { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }
  if (e.key !== ' ' || !practiceHref.value || !shouldHandleKey(e.key, t?.tagName ?? '', !!t?.isContentEditable, mods)) return
  e.preventDefault()
  location.hash = practiceHref.value.replace(/^[^#]*/, '')
}
const onVisible = () => { if (!document.hidden) tick() }
onMounted(() => {
  if (previousVisit) listGames(gameStore).then((g) => { wins.value = gamesWonSince(g, identityOf(progress.value.settings), previousVisit.at) }).catch(() => undefined)
  window.addEventListener('pagehide', saveVisit)
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisible)
  timer = setInterval(tick, 60_000)
})
onBeforeUnmount(() => {
  saveVisit()
  window.removeEventListener('pagehide', saveVisit)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisible)
  clearInterval(timer)
})
</script>

<template>
  <section class="hero" aria-label="Willkommen">
    <div>
      <p class="label eyebrow">Dein Eröffnungstrainer</p>
      <h1>Dein Repertoire. Meine Fährte.</h1>
      <p class="intro">Zehn Eröffnungen aus deinem Dokument, jede in vier Stufen: Lernen, Verstehen, Festigen, Anwenden. Mit vier Lehrern, Stockfish-Analyse, freiem Spiel und deinen eigenen Partien.</p>
      <ol class="pipe" aria-label="Vier Stufen"><template v-for="([id, label], i) in STAGE_LABEL" :key="id"><li><b>{{ i + 1 }}</b>{{ label }}</li><li v-if="i < 3" class="sep" aria-hidden="true"></li></template></ol>
      <p class="with"><span>Jonas, Mira, Aldo, Ferro</span><span>Stockfish schaut mit</span><span>Eigene Partien</span></p>
      <div class="ctas">
        <a class="hbtn pri" :href="cta.href" :style="{ '--acc': cta.acc }">{{ cta.label }} ▸<small v-if="cta.detail">{{ cta.detail }}</small></a>
        <a class="hbtn sec" :href="hrefSpielen()">Partie spielen</a>
      </div>
    </div>
    <div class="hstage" :data-pose="pose">
      <div class="hframe">
        <div class="hgrid" aria-hidden="true"></div>
        <img :key="pose" :src="BASE + image.src" :alt="image.alt" width="960" height="640" />
        <p class="hbubble" role="status"><b>Ferro</b>{{ bubble }}</p>
      </div>
    </div>
  </section>

  <section class="duehero" aria-label="Heute fällig">
    <div class="dueinfo">
      <template v-if="due.length">
        <h2>{{ due.length }} {{ due.length === 1 ? 'Karte' : 'Karten' }} fällig</h2>
        <p class="muted">Ca. {{ minutes }} {{ minutes === 1 ? 'Minute' : 'Minuten' }}. Neu: {{ fresh.length }}.</p>
      </template>
      <template v-else>
        <h2>Nichts fällig. Pipeline grün.</h2>
        <p class="muted"><span v-if="nextLabel">Nächste Karte: {{ nextLabel }}. </span>Neu: {{ fresh.length }}.</p>
      </template>
    </div>
    <div class="duemid">
      <div v-if="due.length" class="queue">
        <span v-for="q in queue" :key="q.key" class="code" :style="{ '--acc': q.acc }">{{ q.code }} {{ q.text }}</span>
      </div>
      <div v-if="since !== null" class="streak">
        <div class="bars" aria-hidden="true"><i v-for="d in bars" :key="d.day" :class="{ on: d.count }" :style="{ height: d.h + 'px' }" :title="`${d.day}: ${d.count}`"></i></div>
        <b v-if="streak">{{ streak }} {{ streak === 1 ? 'Tag' : 'Tage' }} in Folge</b>
        <span v-else class="muted">Letztes Training: {{ since === 0 ? 'heute' : since === 1 ? 'gestern' : `vor ${since} Tagen` }}</span>
      </div>
    </div>
    <div class="actions">
      <a v-if="practiceHref && due.length" class="startbtn" :href="practiceHref">10 Minuten trainieren ▸<small>ca. {{ formatDuration(trainPlan.estimatedSec) }} min · Leertaste</small></a>
      <a v-else-if="practiceHref" class="startbtn second" :href="practiceHref">10 Minuten trainieren<small>Neues üben, ca. {{ formatDuration(trainPlan.estimatedSec) }} min</small></a>
      <a v-else-if="learnHref && learnHref !== cta.href" class="startbtn second" :href="learnHref">Neue Variante lernen</a>
      <p v-if="partien.length"><a class="linkbtn" :href="hrefPartien()">Aus Partien üben ({{ partien.length }})</a></p>
    </div>
  </section>

  <div class="sechead">
    <h2>Deine Kurse <span class="muted">Main Stack · {{ tiles.length }} von {{ rows.length }}</span></h2>
    <a :href="hrefKurse()">Alle {{ rows.length }} Kurse ansehen ▸</a>
  </div>
  <div class="tiles" :class="{ animate }">
    <component
      :is="t.available ? 'a' : 'div'"
      v-for="t in tiles"
      :key="t.id"
      class="tile"
      :class="[t.side, { soon: !t.available }]"
      :style="{ '--acc': t.acc, '--delay': t.delay + 'ms' }"
      :href="t.available ? hrefOpening(t.id) : undefined"
    >
      <span class="tag"><span class="code">{{ t.code }}</span><span><span class="side-dot" :class="t.side"></span>{{ t.side === 'white' ? 'Weiß' : 'Schwarz' }}</span></span>
      <h3>{{ t.name }}</h3>
      <p class="muted">{{ t.role }}</p>
      <p class="entry">{{ t.entryText }}</p>
      <div v-if="t.available" class="stages-bars">
        <div v-for="[id, label] in STAGE_LABEL" :key="id">
          <span class="pbar"><i :style="{ width: (t.bars[id].total ? (100 * t.bars[id].done) / t.bars[id].total : 0) + '%' }"></i></span>
          <span>{{ label }} <b v-if="t.bars[id].total">{{ t.bars[id].done }}/{{ t.bars[id].total }}</b><b v-else class="muted" title="Keine Inhalte in dieser Stufe">–</b></span>
        </div>
      </div>
      <p class="foot">
        <span v-if="t.available"><b>{{ t.count }}</b> Varianten</span>
        <span v-else>In Vorbereitung: Linie wird gebaut.</span>
        <span v-if="t.available && t.due" class="pill">{{ t.due }} fällig</span>
      </p>
    </component>
  </div>
  <p class="legend">
    <span>Balken = Anteil der Varianten je Stufe</span>
    <span><span class="pill">n fällig</span> Wiederholung heute</span>
  </p>
</template>
