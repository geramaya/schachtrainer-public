import type { Side } from '../content/types.ts'
import type { LayerId } from '../ui/layerSettings.ts'
import { controlMap, pieceStats, reachSquares } from './layers.ts'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'

export interface LayerModel {
  /** hanging pieces; `own` = a piece of the side at the bottom of the board */
  rings: { square: string; own: boolean }[]
  badges: { square: string; attackers: number; defenders: number }[]
  /** controlled squares: `own` = the bottom side controls more; level 1-3 = size of the difference */
  tints: { square: string; own: boolean; level: number }[]
  reach: { square: string; occupied: boolean }[]
}

/** What the overlay of the board draws for a position (the threat arrows come from the engine and are added by the board). */
export function layerModel(fen: string, orientation: Side, active: Set<LayerId>, hover?: string | null): LayerModel {
  const mine = orientation === 'white' ? 'w' : 'b'
  const out: LayerModel = { rings: [], badges: [], tints: [], reach: [] }
  if (active.has('hanging') || active.has('counts')) {
    for (const p of pieceStats(fen)) {
      if (active.has('hanging') && p.hanging) out.rings.push({ square: p.square, own: p.color === mine })
      if (active.has('counts') && p.attackers.length + p.defenders.length > 0) out.badges.push({ square: p.square, attackers: p.attackers.length, defenders: p.defenders.length })
    }
  }
  if (active.has('control')) {
    for (const [square, c] of Object.entries(controlMap(fen))) {
      const diff = (orientation === 'white' ? 1 : -1) * (c.white - c.black)
      if (diff !== 0) out.tints.push({ square, own: diff > 0, level: Math.min(3, Math.abs(diff)) })
    }
  }
  if (active.has('reach') && hover) {
    const chess = new Chess(fen)
    out.reach = reachSquares(fen, hover).map((square) => ({ square, occupied: !!chess.get(square as Square) }))
  }
  return out
}

export interface ThreatShape { orig: string; dest: string; brush: 'own' | 'opp'; label?: { text: string } }

/** Arrows of the null-move threats: the side that is not to move would play them; seen from the bottom side red (opponent) or blue (own). */
export function threatShapes(fen: string, orientation: Side, threats: { uci: string; mateIn?: number }[]): ThreatShape[] {
  const toMove: Side = fen.split(' ')[1] === 'b' ? 'black' : 'white'
  const threatening: Side = toMove === 'white' ? 'black' : 'white'
  const brush = threatening === orientation ? 'own' : 'opp'
  return threats.map((t) => ({ orig: t.uci.slice(0, 2), dest: t.uci.slice(2, 4), brush, ...(t.mateIn ? { label: { text: `#${t.mateIn}` } } : {}) }))
}
