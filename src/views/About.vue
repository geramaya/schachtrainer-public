<script setup lang="ts">
import { ref } from 'vue'
import { exportProgress, tryImport } from '../store/progress.ts'
import type { ContentBundle } from '../content/types.ts'
import { progress, storageAvailable, syncBundleCards } from '../store/state.ts'
import { backupInfo, restoreBackup } from '../store/backup.ts'
import { playSound, setSoundSettings, soundSettings } from '../ui/sound.ts'

const props = defineProps<{ bundle: ContentBundle | null }>()

const status = ref('')
const backup = ref(((s) => (s ? backupInfo(s) : null))(storageAvailable()))
const backupDate = (t: number) => new Date(t).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
/** The state before the last migration comes back as it was (cards the migration dropped included); export it, then the next start migrates again. */
function restore() {
  const storage = storageAvailable()
  const r = storage ? restoreBackup(storage) : { ok: false as const, error: 'der Browser erlaubt hier keinen Speicher.' }
  failed.value = !r.ok
  if (r.ok) { progress.value = r.progress; status.value = `Sicherung wiederhergestellt: ${Object.keys(r.progress.cards).length} Karten. Exportiere den Stand jetzt, ein Neuladen ordnet die Karten wieder neu zu.` }
  else status.value = `Wiederherstellen nicht möglich: ${r.error}`
}
const failed = ref(false)

function download() {
  const url = URL.createObjectURL(new Blob([exportProgress(progress.value)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `schachtrainer-fortschritt-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const storage = storageAvailable()
  if (!storage) {
    failed.value = true
    status.value = 'Import nicht möglich: der Browser erlaubt hier keinen Speicher.'
  } else {
    const r = tryImport(storage, await file.text())
    failed.value = !r.ok
    if (r.ok) {
      progress.value = r.progress
      if (props.bundle) syncBundleCards(props.bundle) // imported cards are matched against the current content
      status.value = `Import erfolgreich: ${Object.keys(r.progress.cards).length} Karten.`
    } else {
      status.value = `Import fehlgeschlagen, dein Stand bleibt unverändert: ${r.error}`
    }
  }
  input.value = ''
}
</script>

<template>
  <h1>Über und Lizenzen</h1>
  <section class="card">
    <h2>Figuren</h2>
    <p>Figurensatz „cburnett“ von Colin M. L. Burnett (Staunton-Stil), Namensnennung nach der Lizenz des Satzes.</p>
  </section>
  <section class="card">
    <h2>Töne</h2>
    <p>
      <label><input type="checkbox" :checked="soundSettings.on" @change="setSoundSettings({ on: ($event.target as HTMLInputElement).checked })" /> Töne an</label>
    </p>
    <p>
      <label>Lautstärke <input type="range" min="0" max="1" step="0.05" :value="soundSettings.volume" :disabled="!soundSettings.on" @input="setSoundSettings({ volume: Number(($event.target as HTMLInputElement).value) })" @change="playSound('capture')" /></label>
    </p>
    <p class="muted">Töne: eigene Synthese (<code>tools/gen-sounds.py</code>), keine fremden Aufnahmen.</p>
  </section>
  <section class="card">
    <h2>Software und Daten</h2>
    <ul>
      <li>Brett: <b>chessground</b> (Lichess), GPL-3.0</li>
      <li>Engine: <b>Stockfish</b>, GPL-3.0</li>
      <li>Zugregeln: <b>chess.js</b>, BSD-2-Clause</li>
      <li>Rätsel und Eröffnungsdaten: Lichess-Datenbanken, CC0</li>
    </ul>
    <p class="muted">Die App fragt keine fremden Server ab; alles läuft lokal im Browser.</p>
  </section>
  <section class="card">
    <h2>Fortschritt sichern</h2>
    <p class="muted">Der Lernstand liegt nur in diesem Browser. Sichere ihn als Datei.</p>
    <p>
      <button class="primary" @click="download">Fortschritt exportieren</button>
      <label class="linkbtn">Importieren <input type="file" accept="application/json,.json" hidden @change="upload" /></label>
    </p>
    <p v-if="backup" class="muted">
      Vor der letzten Umstellung des Speicherformats wurde automatisch gesichert ({{ backupDate(backup.savedAt) }}, {{ backup.cards }} Karten).
      <button type="button" @click="restore">Sicherung wiederherstellen</button>
    </p>
    <p v-if="status" :class="failed ? 'err' : 'muted'" role="status">{{ status }}</p>
  </section>
</template>
