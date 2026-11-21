// Writes tools/.cache/audio-texts.json for tools/gen-audio.py (npm run audio:texts): explanation texts and teacher quips.
import { mkdirSync, writeFileSync } from 'node:fs'
import { audioTexts } from '../content-src/audio/index.ts'
import { QUIP_LANGUAGE, QUIP_MODEL, QUIP_TAGS, QUIP_VOICES } from '../content-src/audio/quip-voices.ts'
import { quipAudioTexts } from '../src/audio/quip-audio.ts'
import { QUIPS } from '../src/teacher/quips-data.ts'

const out = new URL('./.cache/audio-texts.json', import.meta.url)
mkdirSync(new URL('./.cache/', import.meta.url), { recursive: true })
// model and language travel with every quip text: the generator picks the provider per text (explanations stay with HeyGen)
const quips = quipAudioTexts(QUIPS, QUIP_VOICES, QUIP_TAGS).map((q) => ({ ...q, model: QUIP_MODEL, ...(QUIP_LANGUAGE ? { language: QUIP_LANGUAGE } : {}) }))
writeFileSync(out, JSON.stringify([...audioTexts, ...quips], null, 2) + '\n')
console.log(`audio-texts.json: ${audioTexts.length} texts, ${quips.length} quips`)
const silent = Object.entries(QUIP_VOICES).filter(([, v]) => !v).map(([k]) => k)
if (silent.length) console.log(`quips without voice (no audio): ${silent.join(', ')} - set in content-src/audio/quip-voices.ts`)
