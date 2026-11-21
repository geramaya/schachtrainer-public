import { createEngine, browserEngineIO } from './service.ts'
import { createRegistry } from './registry.ts'

const registry = createRegistry(() => createEngine(browserEngineIO()))

export const { getEngine, getCoachEngine, engineEpoch, resetEngine, cancelEngine } = registry
