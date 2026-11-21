<script setup lang="ts">
import { publicUrl } from './ui/assetBase.ts'
import SoundToggle from './ui/SoundToggle.vue'
import { computed, onMounted, ref, watch } from 'vue'
import type { ContentBundle } from './content/types.ts'
import { loadBundle } from './content/load.ts'
import { syncBundleCards } from './store/state.ts'
import { navItemOf, route, hrefHome, hrefKurse, hrefAbout, hrefAnalyse, hrefSpielen, hrefMeinePartien } from './router.ts'
import Home from './views/Home.vue'
import Courses from './views/Courses.vue'
import Training from './views/Training.vue'
import Opening from './views/Opening.vue'
import Variation from './views/Variation.vue'
import About from './views/About.vue'
import Partien from './views/Partien.vue'
import Analyse from './views/Analyse.vue'
import Spielen from './views/Spielen.vue'
import MeinePartien from './views/MeinePartien.vue'
import PartieAnsicht from './views/PartieAnsicht.vue'

const bundle = ref<ContentBundle | null>(null)
const error = ref('')
let started = false
/** Loads the content bundle once (3.7 MB: fetching, parsing and matching the cards keep the page busy for a while). */
async function ensureBundle() {
  if (started) return
  started = true
  try { const b = await loadBundle(); syncBundleCards(b); bundle.value = b } catch (e) { error.value = (e as Error).message }
}
function retryBundle() { error.value = ''; started = false; void ensureBundle() }
const r = computed(() => route.value)
const nav = [
  { id: 'start', label: 'Start', href: hrefHome() }, { id: 'kurse', label: 'Kurse', href: hrefKurse() }, { id: 'spielen', label: 'Spielen', href: hrefSpielen() },
  { id: 'partien', label: 'Meine Partien', href: hrefMeinePartien() }, { id: 'analyse', label: 'Analyse', href: hrefAnalyse() }, { id: 'ueber', label: 'Über', href: hrefAbout() },
]
const active = computed(() => navItemOf(r.value))
/** The list of saved games does not need the content: it shows first, the bundle follows a moment later (measured: the list took 1.1-1.6 s with the bundle loading beside it, 0.2-0.6 s without). */
const LIST_FIRST_MS = 1500
onMounted(() => {
  if (r.value.name === 'meinepartien' && !r.value.id) setTimeout(() => void ensureBundle(), LIST_FIRST_MS)
  else void ensureBundle()
})
watch(r, (now) => { if (!(now.name === 'meinepartien' && !now.id)) void ensureBundle() })
/** Board pages use the whole window (three columns, no page scroll); the loading and error states keep the normal frame. */
const wide = computed(() => r.value.name === 'analyse' || (r.value.name === 'meinepartien' && !!r.value.id) || (r.value.name === 'spielen' && !!bundle.value) || ((r.value.name === 'variation' || r.value.name === 'partien' || r.value.name === 'training') && !!bundle.value))
</script>

<template>
  <header class="top">
    <a class="brand" :href="hrefHome()"><img class="logo" :src="publicUrl('brand/logo-mark.svg')" alt="" width="28" height="28" /><span class="brandname">Schachtrainer</span></a>
    <nav aria-label="Hauptnavigation">
      <a v-for="n in nav" :key="n.id" :href="n.href" :class="{ on: n.id === active }" :aria-current="n.id === active ? 'page' : undefined" :aria-label="n.label"><template v-if="n.label.startsWith('Meine ')"><span class="pre">Meine </span>{{ n.label.slice(6) }}</template><template v-else>{{ n.label }}</template></a>
    </nav>
    <SoundToggle />
  </header>
  <main :class="{ wide }">
    <About v-if="r.name === 'about'" :bundle="bundle" />
    <Analyse v-else-if="r.name === 'analyse'" :fen="r.fen" />
    <PartieAnsicht v-else-if="r.name === 'meinepartien' && r.id" :id="r.id" :bundle="bundle" />
    <MeinePartien v-else-if="r.name === 'meinepartien'" />
    <Spielen v-else-if="r.name === 'spielen' && bundle" :bundle="bundle" :fen="r.fen" />
    <Partien v-else-if="r.name === 'partien' && bundle" />
    <p v-else-if="error" class="err" role="alert">{{ error }} <button type="button" @click="retryBundle">Erneut versuchen</button></p>
    <p v-else-if="!bundle" class="muted">Lade Inhalte …</p>
    <Training v-else-if="r.name === 'training'" :bundle="bundle" />
    <Courses v-else-if="r.name === 'courses'" :bundle="bundle" />
    <Home v-else-if="r.name === 'home'" :bundle="bundle" />
    <Opening v-else-if="r.name === 'opening'" :bundle="bundle" :opening-id="r.openingId" />
    <Variation v-else-if="r.name === 'variation'" :bundle="bundle" :variation-id="r.variationId" :stage="r.stage" :anchor-fen="r.fen" />
    <p v-else class="muted">Seite nicht gefunden. <a :href="hrefHome()">Zur Startseite</a></p>
  </main>
</template>
