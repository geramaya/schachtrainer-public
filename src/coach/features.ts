import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { Side } from '../content/types.ts'
import { VALUE, motifText } from './texts.ts'
import type { MotifFacts, PieceType } from './texts.ts'

export interface SideFeatures {
  side: Side
  /** minor pieces off their start squares */
  development: number
  /** king on a castled square (FEN has no history: g1/h1/c1/b1, mirrored for black) */
  castled: boolean
  /** own pawns directly in front of the king (0-3, king file and both neighbours, within three ranks) */
  kingShelter: number
  openFiles: string[]
  halfOpenFiles: string[]
  isolated: string[]
  doubled: string[]
  passed: string[]
  bishopPair: boolean
  outposts: string[]
  /** of d4 e4 d5 e5: squares held by an own pawn or attacked by an own piece */
  centerControl: number
}

/** `side` is the side that profits from the motif; `squares` as documented per kind (first = acting piece). */
export type MotifKind = 'haengend' | 'gabel' | 'fesselung' | 'spiess' | 'abzug' | 'koenigsziel'
export interface Motif { kind: MotifKind; side: Side; squares: string[]; text: string }

const FILES = 'abcdefgh'
const COLOR: Record<Side, Color> = { white: 'w', black: 'b' }
const SIDES: Side[] = ['white', 'black']
const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5']
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTHO: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const RAYS: Partial<Record<PieceSymbol, [number, number][]>> = { b: DIAG, r: ORTHO, q: [...DIAG, ...ORTHO] }

interface Pc { sq: Square; type: PieceType; color: Color }

function pieces(chess: Chess): Pc[] {
  return chess.board().flat().flatMap((p) => (p ? [{ sq: p.square, type: p.type as PieceType, color: p.color }] : []))
}
const file = (sq: string) => FILES.indexOf(sq[0]!)
const rank = (sq: string) => Number(sq[1])
const at = (f: number, r: number): Square | null => (f < 0 || f > 7 || r < 1 || r > 8 ? null : (`${FILES[f]}${r}` as Square))
const sideOf = (c: Color): Side => (c === 'w' ? 'white' : 'black')

function pawnFeatures(ps: Pc[], c: Color) {
  const own = ps.filter((p) => p.type === 'p' && p.color === c)
  const foe = ps.filter((p) => p.type === 'p' && p.color !== c)
  const fileSet = (list: Pc[]) => new Set(list.map((p) => file(p.sq)))
  const ownFiles = fileSet(own)
  const foeFiles = fileSet(foe)
  const letters = (set: Iterable<number>) => [...set].sort((a, b) => a - b).map((f) => FILES[f]!)
  const ahead = (r: number, q: number) => (c === 'w' ? q > r : q < r)
  return {
    isolated: letters([...ownFiles].filter((f) => !ownFiles.has(f - 1) && !ownFiles.has(f + 1))),
    doubled: letters([...ownFiles].filter((f) => own.filter((p) => file(p.sq) === f).length > 1)),
    passed: letters(new Set(own.filter((p) => !foe.some((e) => Math.abs(file(e.sq) - file(p.sq)) <= 1 && ahead(rank(p.sq), rank(e.sq)))).map((p) => file(p.sq)))),
    halfOpen: letters([...Array(8).keys()].filter((f) => !ownFiles.has(f) && foeFiles.has(f))),
    own, foe,
  }
}

const START_MINORS: Record<Color, Square[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] }

function outposts(chess: Chess, ps: Pc[], c: Color, own: Pc[], foe: Pc[]): string[] {
  return ps.filter((p) => p.color === c && p.type === 'n').filter((n) => {
    const r = rank(n.sq)
    const rel = c === 'w' ? r : 9 - r
    if (rel < 4 || rel > 6) return false
    const back = c === 'w' ? r - 1 : r + 1
    const supported = own.some((p) => Math.abs(file(p.sq) - file(n.sq)) === 1 && rank(p.sq) === back)
    const attackable = foe.some((p) => Math.abs(file(p.sq) - file(n.sq)) === 1 && (c === 'w' ? rank(p.sq) > r : rank(p.sq) < r))
    return supported && !attackable
  }).map((n) => n.sq)
}

export function features(fen: string): SideFeatures[] {
  const chess = new Chess(fen)
  const ps = pieces(chess)
  const allPawnFiles = new Set(ps.filter((p) => p.type === 'p').map((p) => file(p.sq)))
  return SIDES.map((side) => {
    const c = COLOR[side]
    const pf = pawnFeatures(ps, c)
    const king = ps.find((p) => p.type === 'k' && p.color === c)
    const homeRank = c === 'w' ? 1 : 8
    const shelter = king
      ? [-1, 0, 1].filter((d) => pf.own.some((p) => file(p.sq) === file(king.sq) + d && (c === 'w' ? rank(p.sq) - rank(king.sq) : rank(king.sq) - rank(p.sq)) >= 1 && Math.abs(rank(p.sq) - rank(king.sq)) <= 3)).length
      : 0
    return {
      side,
      development: ps.filter((p) => p.color === c && (p.type === 'n' || p.type === 'b') && !START_MINORS[c].includes(p.sq)).length,
      castled: !!king && king.sq[1] === String(homeRank) && ['g', 'h', 'c', 'b'].includes(king.sq[0]!),
      kingShelter: shelter,
      openFiles: [...Array(8).keys()].filter((f) => !allPawnFiles.has(f)).map((f) => FILES[f]!),
      halfOpenFiles: pf.halfOpen,
      isolated: pf.isolated, doubled: pf.doubled, passed: pf.passed,
      bishopPair: ps.filter((p) => p.color === c && p.type === 'b').length >= 2,
      outposts: outposts(chess, ps, c, pf.own, pf.foe),
      centerControl: CENTER.filter((sq) => chess.get(sq)?.type === 'p' && chess.get(sq)?.color === c || chess.attackers(sq, c).length > 0).length,
    }
  })
}

// ---------- tactical motifs (pure chess.js) ----------

/** Pieces and the two first pieces met along each slider ray (used for pins, skewers and discovered attacks). */
function rayPairs(ps: Pc[]): { slider: Pc; first: Pc; second: Pc; straight: boolean }[] {
  const out: { slider: Pc; first: Pc; second: Pc; straight: boolean }[] = []
  for (const s of ps.filter((p) => RAYS[p.type])) {
    for (const [df, dr] of RAYS[s.type]!) {
      const seen: Pc[] = []
      for (let f = file(s.sq) + df, r = rank(s.sq) + dr; seen.length < 2; f += df, r += dr) {
        const sq = at(f, r)
        if (!sq) break
        const p = ps.find((x) => x.sq === sq)
        if (p) seen.push(p)
      }
      if (seen.length === 2) out.push({ slider: s, first: seen[0]!, second: seen[1]!, straight: df === 0 || dr === 0 })
    }
  }
  return out
}

export function tacticalMotifs(fen: string): Motif[] {
  const chess = new Chess(fen)
  const ps = pieces(chess)
  const rays = rayPairs(ps)
  // absolutely pinned pieces (shielding their own king from a slider): they neither fork, pin, skewer nor count as attackers
  const pinned = new Set(rays.filter((r) => r.first.color !== r.slider.color && r.second.color === r.first.color && r.second.type === 'k').map((r) => r.first.sq))
  const byType = (sq: string) => ps.find((p) => p.sq === sq)!
  const out: Motif[] = []
  const add = (kind: MotifKind, c: Color, squares: string[], facts: Omit<MotifFacts, 'squares'>) =>
    out.push({ kind, side: sideOf(c), squares, text: motifText(kind, { ...facts, squares }) })

  for (const c of ['w', 'b'] as Color[]) {
    const foeColor: Color = c === 'w' ? 'b' : 'w'
    const mine = ps.filter((p) => p.color === c)
    const theirs = ps.filter((p) => p.color === foeColor)

    // hanging: attacked and undefended, or attacked by a cheaper piece
    for (const t of theirs.filter((p) => p.type !== 'k')) {
      const att = chess.attackers(t.sq, c).filter((x) => !pinned.has(x))
      if (!att.length) continue
      const undefended = chess.attackers(t.sq, foeColor).length === 0
      const cheaper = t.type !== 'p' && Math.min(...att.map((a) => VALUE[byType(a).type])) < VALUE[t.type]
      if (undefended || cheaper) add('haengend', c, [t.sq], { piece: t.type, undefended, owner: sideOf(foeColor) })
    }

    // fork: a piece attacks two or more worthwhile targets (king, or a piece worth more than the forker / undefended)
    const targets = new Map<string, Pc[]>()
    for (const t of theirs.filter((p) => p.type !== 'p')) {
      for (const a of chess.attackers(t.sq, c)) {
        const forker = byType(a)
        if (forker.type === 'k' || pinned.has(a)) continue
        const worth = t.type === 'k' || VALUE[t.type] > VALUE[forker.type] || chess.attackers(t.sq, foeColor).length === 0
        if (worth) targets.set(a, [...(targets.get(a) ?? []), t])
      }
    }
    for (const [a, list] of targets) {
      const forker = byType(a)
      const hit = chess.attackers(a as Square, foeColor)
      if (list.length < 2) continue
      const safe = !hit.length || (chess.attackers(a as Square, c).length > 0 && Math.min(...hit.map((h) => VALUE[byType(h).type])) >= VALUE[forker.type])
      if (!safe) continue
      add('gabel', c, [a, ...list.map((t) => t.sq).sort()], { piece: forker.type })
    }

    // pin / skewer / discovered attack along rays of own sliders
    for (const { slider: s, first, second, straight } of rays.filter((r) => r.slider.color === c && !pinned.has(r.slider.sq))) {
      const sqs = [s.sq, first.sq, second.sq]
      const facts = { piece: s.type, target: first.type, behind: second.type }
      // the front piece may take the slider if that costs the slider at most what the front piece is worth
      const frontTakes = chess.attackers(s.sq, foeColor).includes(first.sq) && VALUE[first.type] <= VALUE[s.type]
      if (first.color !== c && second.color !== c) {
        if (first.type !== 'k' && VALUE[second.type] > VALUE[first.type] && !frontTakes) add('fesselung', c, sqs, facts)
        else if (second.type !== 'k' && VALUE[second.type] >= 3 && VALUE[first.type] > VALUE[second.type] && !frontTakes) {
          add('spiess', c, sqs, facts)
        }
      } else if (first.color === c && second.color !== c && !pinned.has(first.sq) && !(first.type === 'p' && straight)) {
        // the blocker can step aside and uncovers the slider onto the king or a piece worth more than the slider
        if (second.type === 'k' || VALUE[second.type] > VALUE[s.type]) add('abzug', c, sqs, facts)
      }
    }

    // king target: a defended-by-king piece next to the enemy king that we attack more often than it is defended
    const king = theirs.find((p) => p.type === 'k')
    if (king) {
      for (const t of theirs.filter((p) => p.type !== 'k' && Math.abs(file(p.sq) - file(king.sq)) <= 1 && Math.abs(rank(p.sq) - rank(king.sq)) <= 1)) {
        const attackers = chess.attackers(t.sq, c).length
        const defenders = chess.attackers(t.sq, foeColor).length
        if (attackers >= 2 && attackers > defenders) add('koenigsziel', c, [t.sq], { piece: t.type, attackers, defenders })
      }
    }
  }
  return out
}

