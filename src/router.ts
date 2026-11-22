import { ref } from 'vue'

export const STAGES = ['lernen', 'verstehen', 'festigen', 'anwenden'] as const
export type Stage = (typeof STAGES)[number]

export type Route =
  | { name: 'home' }
  | { name: 'opening'; openingId: string }
  | { name: 'variation'; variationId: string; stage: Stage; fen?: string }
  | { name: 'about' }
  | { name: 'courses' }
  | { name: 'lehrgang'; id: string }
  | { name: 'lehrgang-system'; id: string; systemId: string }
  /** kind s = the main line of a system (itemId = system id); a model game of a system has the item id "<system>/<game>". `modus` = the step the page starts in. */
  | { name: 'lehrgang-ueben'; id: string; kind: 'v' | 'f' | 'm' | 's'; itemId: string; modus?: 'gefuehrt' | 'kopf' }
  | { name: 'training' }
  | { name: 'partien' }
  | { name: 'analyse'; fen?: string }
  | { name: 'spielen'; fen?: string }
  | { name: 'meinepartien'; id?: string }
  | { name: 'notfound' }

/** Parses a location hash ("#/o/scotch") into a route. */
export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.split('?', 2)
  let parts: string[]
  try {
    parts = path.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return { name: 'notfound' } // malformed percent escape in a hand-edited URL
  }
  if (parts.length === 0) return { name: 'home' }
  if (parts[0] === 'o' && parts.length === 2) return { name: 'opening', openingId: parts[1]! }
  if (parts[0] === 'v' && parts.length >= 2) {
    const stage = (parts[2] ?? 'lernen') as Stage
    if (STAGES.includes(stage)) {
      const fen = new URLSearchParams(query).get('fen')
      return fen ? { name: 'variation', variationId: parts[1]!, stage, fen } : { name: 'variation', variationId: parts[1]!, stage }
    }
  }
  if (parts[0] === 'ueber' && parts.length === 1) return { name: 'about' }
  if (parts[0] === 'kurse' && parts.length === 1) return { name: 'courses' }
  if (parts[0] === 'lehrgang' && parts.length === 2) return { name: 'lehrgang', id: parts[1]! }
  if (parts[0] === 'lehrgang' && parts.length === 4 && parts[2] === 'system') return { name: 'lehrgang-system', id: parts[1]!, systemId: parts[3]! }
  if (parts[0] === 'lehrgang' && parts.length === 4 && (parts[2] === 'v' || parts[2] === 'f' || parts[2] === 'm' || parts[2] === 's')) return { name: 'lehrgang-ueben', id: parts[1]!, kind: parts[2], itemId: parts[3]! }
  if (parts[0] === 'lehrgang' && parts.length === 5 && parts[2] === 's' && (parts[4] === 'gefuehrt' || parts[4] === 'kopf')) return { name: 'lehrgang-ueben', id: parts[1]!, kind: 's', itemId: parts[3]!, modus: parts[4] }
  if (parts[0] === 'training' && parts.length === 1) return { name: 'training' }
  if (parts[0] === 'partien' && parts.length === 1) return { name: 'partien' }
  if (parts[0] === 'analyse' && parts.length === 1) {
    const fen = new URLSearchParams(query).get('fen')
    return fen ? { name: 'analyse', fen } : { name: 'analyse' }
  }
  if (parts[0] === 'spielen' && parts.length === 1) {
    const fen = new URLSearchParams(query).get('fen')
    return fen ? { name: 'spielen', fen } : { name: 'spielen' }
  }
  if (parts[0] === 'meine-partien' && parts.length <= 2) return parts[1] ? { name: 'meinepartien', id: parts[1] } : { name: 'meinepartien' }
  return { name: 'notfound' }
}

export const route = ref<Route>(typeof location === 'undefined' ? { name: 'home' } : parseRoute(location.hash))
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => { route.value = parseRoute(location.hash) })

export const hrefHome = () => '#/'
export const hrefOpening = (id: string) => `#/o/${encodeURIComponent(id)}`
export const hrefVariation = (id: string, stage: Stage = 'lernen', fen?: string) =>
  `#/v/${encodeURIComponent(id)}/${stage}${fen ? `?fen=${encodeURIComponent(fen)}` : ''}`
export const hrefAbout = () => '#/ueber'
export const hrefPartien = () => '#/partien'
export const hrefAnalyse = (fen?: string) => `#/analyse${fen ? `?fen=${encodeURIComponent(fen)}` : ''}`
export const hrefSpielen = (fen?: string) => '#/spielen' + (fen ? '?fen=' + encodeURIComponent(fen) : '')
export const hrefMeinePartien = (id?: string) => '#/meine-partien' + (id ? '/' + encodeURIComponent(id) : '')
export const hrefKurse = () => '#/kurse'
export const hrefLehrgang = (id: string) => `#/lehrgang/${encodeURIComponent(id)}`
export const hrefLehrgangUeben = (id: string, kind: 'v' | 'f' | 'm' | 's', itemId: string, modus?: 'gefuehrt' | 'kopf') => `#/lehrgang/${encodeURIComponent(id)}/${kind}/${encodeURIComponent(itemId)}${modus ? `/${modus}` : ''}`
export const hrefLehrgangSystem = (id: string, systemId: string) => `#/lehrgang/${encodeURIComponent(id)}/system/${encodeURIComponent(systemId)}`
export const hrefTraining = () => '#/training'

export type NavId = 'start' | 'kurse' | 'spielen' | 'partien' | 'analyse' | 'ueber'

/** Which navigation item a route belongs to: openings and variations are part of the courses, the game library of "Meine Partien". */
export function navItemOf(r: Route): NavId | null {
  switch (r.name) {
    case 'home': return 'start'
    case 'courses': case 'opening': case 'variation': case 'lehrgang': case 'lehrgang-system': case 'lehrgang-ueben': return 'kurse'
    case 'spielen': return 'spielen'
    case 'meinepartien': return 'partien'
    case 'analyse': return 'analyse'
    case 'about': return 'ueber'
    default: return null
  }
}
