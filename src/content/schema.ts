import { BUNDLE_SCHEMA } from './types.ts'
import type { ContentBundle } from './types.ts'

/** Refuses bundles of an older format (single `nodes` map) instead of crashing later. */
export function checkBundle(data: unknown): ContentBundle {
  if (typeof data !== 'object' || data === null || (data as { schemaVersion?: unknown }).schemaVersion !== BUNDLE_SCHEMA) {
    throw new Error('Die Inhalte haben ein veraltetes Format. Bitte Inhalte neu bauen (npm run build:content).')
  }
  return data as ContentBundle
}
