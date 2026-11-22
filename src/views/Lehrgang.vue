<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { formatLine } from '../chess/notation.ts'
import { hrefKurse, hrefLehrgangSystem, hrefLehrgangUeben } from '../router.ts'
import { ensureLehrgaenge, lehrgaenge, lehrgangFehler, lehrgangState } from '../lehrgang/state.ts'
import { stufeFortschritt } from '../lehrgang/store.ts'
import { isTodo } from '../lehrgang/types.ts'
import { variantTitles } from '../lehrgang/title.ts'
import { CATALOG } from '../content/catalog.ts'
import type { Stufe, Variante } from '../lehrgang/types.ts'
import Disclosure from '../ui/Disclosure.vue'
import SatzAudio from '../ui/SatzAudio.vue'
import { stopQuip } from '../audio/play-quip.ts'

const props = defineProps<{ id: string }>()
onMounted(() => void ensureLehrgaenge())
onBeforeUnmount(stopQuip)
const lg = computed(() => lehrgaenge.value?.find((l) => l.id === props.id))
const by = (s: Stufe) => (lg.value?.varianten ?? []).filter((v) => v.stufe === s)
const fort = (s: Stufe) => (lg.value ? stufeFortschritt(lehrgangState.value, lg.value, s) : { done: 0, total: 0 })
const titles = computed(() => (lg.value ? variantTitles(lg.value.varianten, lg.value.entry) : new Map<string, string>()))
const title = (v: Variante) => titles.value.get(v.id) ?? v.name
const steps = (v: Variante) => { const s = lehrgangState.value.varianten[`${props.id}/${v.id}`] ?? {}; return [{ k: 'Vorführen', on: !!s.vorfuehren }, { k: 'Nachspielen', on: !!s.gefuehrt }, { k: 'Aus dem Kopf', on: !!s.kopf }] }
const fallenDone = (id: string) => !!lehrgangState.value.fallen[`${props.id}/${id}`]
</script>

<template>
  <p class="crumbs"><a href="#/">Start</a> › <a :href="hrefKurse()">Kurse</a> › {{ lg?.name ?? 'Lehrgang' }}</p>
  <p v-if="lehrgangFehler" class="err" role="alert">{{ lehrgangFehler }}</p>
  <p v-else-if="!lehrgaenge" class="muted">Lade Lehrgang …</p>
  <p v-else-if="!lg" class="muted">Diesen Lehrgang gibt es nicht. <a :href="hrefKurse()">Zu den Kursen</a></p>
  <div v-else class="lg" :style="{ '--acc': CATALOG.find((c) => c.id === lg!.id)?.acc ?? 'var(--muted)' }">
    <header class="cphead">
      <h1>{{ lg.name }} <span class="muted small">Lehrgang {{ lg.band }}</span></h1>
      <p class="muted"><span class="side-dot" :class="lg.side"></span>{{ lg.side === 'white' ? 'Weiß' : 'Schwarz' }} · Einstieg <span class="vline">{{ formatLine(lg.entry) }}</span></p>
      <p v-if="lg.offen" class="muted small">{{ lg.offen }} Texte sind noch nicht geschrieben (Platzhalter „Text folgt“).</p>
    </header>

    <section class="plan" aria-label="Spielplan">
      <h2>Spielplan</h2>
      <article v-for="s in lg.spielplan" :key="s.titel"><h3>{{ s.titel }}<SatzAudio v-if="!isTodo(s.text)" :text="s.text" /></h3><p :class="{ muted: isTodo(s.text) }">{{ isTodo(s.text) ? 'Text folgt.' : s.text }}</p></article>
    </section>

    <section v-for="sys in lg.systeme ?? []" :key="sys.id" aria-label="System">
      <h2>System: {{ isTodo(sys.titel) ? formatLine(sys.zuege) : sys.titel }} <span class="muted small">{{ formatLine(sys.zuege) }}</span></h2>
      <p class="muted small">Idee, Hauptlinie mit Abzweigen, Motive mit Rätseln, Musterpartien und Üben.</p>
      <ul class="varlist">
        <li class="vcard">
          <a class="vname" :href="hrefLehrgangSystem(lg.id, sys.id)">System lernen</a>
          <span class="pill">{{ sys.hauptlinie.aeste.length }} Abzweige · {{ sys.motive.length }} Motive</span>
          <span></span>
        </li>
      </ul>
    </section>

    <section aria-label="Lernpfad">
      <h2>Lernpfad: Kern <span class="muted small">{{ fort('kern').done }} von {{ fort('kern').total }} aus dem Kopf</span></h2>
      <p v-if="!lg.abruf" class="muted small">Häufigkeiten folgen, sobald die Daten abgerufen sind (vorläufige Auswahl).</p>
      <p v-else class="muted small">Häufigkeit in Partien von 1200 bis 1600 Elo, Lichess-Datenbank, abgerufen am {{ lg.abruf }}.</p>
      <ul class="varlist">
        <li v-for="v in by('kern')" :key="v.id" class="vcard">
          <a class="vname" :href="hrefLehrgangUeben(lg.id, 'v', v.id)">{{ title(v) }}</a>
          <span class="pill">{{ v.haeufigkeit ? 'kommt ' + v.haeufigkeit : 'Häufigkeit folgt' }}</span>
          <span class="dots"><span v-for="s in steps(v)" :key="s.k" :class="{ on: s.on }" :title="s.k + (s.on ? ' geschafft' : '')">{{ s.on ? '●' : '○' }}</span></span>
        </li>
      </ul>
      <Disclosure v-for="s in (['erweiterung', 'nachschlagen'] as const)" :id="`lg-${lg.id}-${s}`" :key="s" :title="`${s === 'erweiterung' ? 'Erweiterung' : 'Nachschlagen'} (${by(s).length})`">
        <ul class="varlist">
          <li v-for="v in by(s)" :key="v.id" class="vcard">
            <a class="vname" :href="hrefLehrgangUeben(lg.id, 'v', v.id)">{{ title(v) }}</a>
            <span class="pill">{{ v.haeufigkeit ? 'kommt ' + v.haeufigkeit : 'Häufigkeit folgt' }}</span>
          </li>
          <li v-if="!by(s).length" class="muted">Noch keine Varianten (kommen mit den Daten).</li>
        </ul>
      </Disclosure>
    </section>

    <section v-if="lg.musterpartien?.length" aria-label="Musterpartie">
      <h2>Musterpartie</h2>
      <p class="muted small">Eine echte Partie Zug für Zug, der Lehrer kommentiert die Wendepunkte.</p>
      <ul class="varlist">
        <li v-for="m in lg.musterpartien" :key="m.id" class="vcard">
          <a class="vname" :href="hrefLehrgangUeben(lg.id, 'm', m.id)">{{ isTodo(m.titel) ? 'Musterpartie (Titel folgt)' : m.titel }}</a>
          <span v-if="m.platzhalter" class="pill">Platzhalter</span><span v-else></span>
          <span></span>
        </li>
      </ul>
    </section>

    <section aria-label="Fallen">
      <h2>Fallen als Rätsel</h2>
      <ul class="varlist">
        <li v-for="f in lg.fallen" :key="f.id" class="vcard">
          <a class="vname" :href="hrefLehrgangUeben(lg.id, 'f', f.id)">{{ isTodo(f.titel) ? 'Rätsel (Titel folgt)' : f.titel }}</a>
          <span v-if="f.platzhalter" class="pill">Platzhalter</span>
          <span class="dots"><span :class="{ on: fallenDone(f.id) }">{{ fallenDone(f.id) ? '●' : '○' }}</span></span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.lg { max-width: 60rem; }
.plan article { margin: .4rem 0 .8rem; }
.plan h2, section > h2 { margin: 1.4rem 0 .4rem; }
.plan h3 { margin: .8rem 0 .2rem; }
.plan article p { margin: 0; }
.varlist { list-style: none; padding: 0; margin: .4rem 0; display: grid; gap: 6px; }
.vcard { display: grid; grid-template-columns: minmax(0, 1fr) 11rem 4.5rem; gap: .8rem; align-items: center; padding: 8px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; min-height: 2.6rem; }
.vname { font-weight: 600; overflow-wrap: anywhere; }
.pill { justify-self: start; }
.dots { display: flex; gap: 4px; justify-content: end; color: var(--muted); }
.dots .on { color: var(--acc, var(--text)); }
</style>
