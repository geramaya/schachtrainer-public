import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { IntroEntry } from './intro-check.ts'
import type { FactsFile } from './intro-facts.ts'

const DEFAULT_DIR = fileURLToPath(new URL('../../content-src/', import.meta.url))

/**
 * Authored intro texts of one opening: content-src/intros/<openingId>.ts exports `INTROS: Record<variationId, { text, belege }>`.
 * No file = no authored texts (empty record).
 */
export async function loadAuthoredIntros(openingId: string, dir = DEFAULT_DIR): Promise<Record<string, IntroEntry>> {
  const file = `${dir}/intros/${openingId}.ts`
  if (!existsSync(file)) return {}
  const mod = (await import(pathToFileURL(file).href)) as { INTROS?: Record<string, IntroEntry> }
  if (!mod.INTROS) throw new Error(`${file}: Export INTROS fehlt`)
  return mod.INTROS
}

/** Fact sheets of one opening (tools/intro-facts.ts), or null when none were generated. */
export function loadFacts(openingId: string, dir = DEFAULT_DIR): FactsFile | null {
  const file = `${dir}/intro-facts/${openingId}.json`
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as FactsFile) : null
}
