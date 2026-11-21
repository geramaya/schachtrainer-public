import { Chess } from 'chess.js'
import { positionKey } from '../../src/chess/position.ts'
import type { Analysis, Engine } from '../../src/engine/service.ts'
import type { Candidate, Source, TreeNode, Variation } from '../../src/content/types.ts'
import type { OpeningSpec, OwnChoice } from '../../content-src/openings.ts'
import { NAMES_DE } from '../../content-src/names-de.ts'
import { analyseSafe, applyUci, score } from './check-claims.ts'
import type { OpeningLine } from './sources.ts'

export interface TreeOptions {
  /** Plies (half moves) from the start position beyond which no line is followed. */
  ownPlies: number
  /** Own moves an engine principal variation may add behind a line that ends on an opponent move. */
  branchExtraOwnMoves: number
  /** Theory move losing more than this against the engine best move is replaced by it. */
  vetoCp: number
  /** Engine depth (plan value 18). */
  depth?: number
  /** Deepening (spec "Nachtrag Tiefe"): every variation line is continued to at least this many plies (0 = off). */
  minPlies?: number
  /** Upper bound while the own side is still behind in material ("Angriff angekommen" otherwise). */
  maxPlies?: number
  /** At the first 3 opponent moves behind the named line: up to `branchMoves` further answers within `branchWithinCp`, each to `branchPlies`. */
  branchMoves?: number
  branchWithinCp?: number
  branchPlies?: number
  /** Opponent moves by frequency (Lichess explorer); null = unavailable. Moves with fewer than 20 games are ignored. */
  explorer?: (fen: string) => Promise<{ uci: string; games: number }[] | null>
  /** Budget for the alternatives only; main lines are always deepened to minPlies. */
  nodeBudget?: number
}

export interface Veto { key: string; theoryUci: string; bestUci: string; lossCp: number }
export interface DocWarning { key: string; uci: string; lossCp: number }
export interface DroppedLine { name: string; reason: string }

interface Step { key: string; fen: string; ownMove: boolean; uci: string; san: string }
interface Walked { line: OpeningLine; steps: Step[]; end: { key: string; fen: string; ownMove: boolean } }

const DEFAULT_DEPTH = 18

function walk(ucis: string[]): { steps: Step[]; end: Walked['end'] } {
  const g = new Chess()
  const steps: Step[] = []
  for (const uci of ucis) {
    const fen = g.fen()
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    steps.push({ key: positionKey(fen), fen, ownMove: false, uci, san: m.san })
  }
  return { steps, end: { key: positionKey(g.fen()), fen: g.fen(), ownMove: false } }
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** First opponent position behind a variation's name: moves of other named lines that continue from the same end are blocked there. */
interface Redirect { name: string; from: number; blocked: Map<string, Set<string>>; used: boolean }

/** Why a game is over, or null while it runs (only mate and stalemate are decisive; the draws are named as such). */
export function endReason(g: Chess): string | null {
  if (g.isCheckmate()) return 'Matt'
  if (g.isStalemate()) return 'Patt'
  if (g.isThreefoldRepetition()) return 'Remis durch Wiederholung'
  if (g.isDrawByFiftyMoves()) return 'Remis (50 Züge)'
  if (g.isInsufficientMaterial()) return 'Remis (Material)'
  return null
}

export async function buildTree(
  spec: OpeningSpec, lines: OpeningLine[], engine: Engine, opts: TreeOptions,
): Promise<{
  redirects: { variation: string; uci: string; san: string; share: number | null; games: number; source: 'explorer' | 'stockfish' }[]
  ends: { id: string; plies: number; reason: string | null }[]
  nodes: Record<string, TreeNode>; variations: Variation[]; vetoes: Veto[]; docWarnings: DocWarning[]; dropped: DroppedLine[]
}> {
  const depth = opts.depth ?? DEFAULT_DEPTH
  const ownColor = spec.side === 'white' ? 'w' : 'b'
  const nodes: Record<string, TreeNode> = {}
  const vetoes: Veto[] = []
  const docWarnings: DocWarning[] = []
  const dropped: DroppedLine[] = []
  /** `key|uci` of the own moves that get a subtree; other candidates are inactive alternatives. */
  const branch = new Set<string>()
  // document choices are written as move sequences but looked up by position, so transpositions hit them
  const docChoices = new Map<string, OwnChoice[]>()
  for (const [path, choices] of Object.entries(spec.ownChoices)) {
    const g = new Chess()
    for (const san of path.split(' ').filter(Boolean)) g.move(san)
    docChoices.set(positionKey(g.fen()), choices)
  }
  const docSource: Source = { kind: 'dokument', ref: spec.docRef }
  const engineSource: Source = { kind: 'stockfish', ref: `depth ${depth}` }

  const cache = new Map<string, Promise<Analysis>>()
  const analyse = (fen: string): Promise<Analysis> => {
    let p = cache.get(fen)
    if (!p) cache.set(fen, (p = analyseSafe(engine, fen, { depth, multipv: 1 })))
    return p
  }
  /** Own-side evaluation after playing uci in fen. */
  const evalMove = async (fen: string, uci: string): Promise<{ cp: number; best: number }> => {
    const a = await analyse(fen)
    const best = score(a.lines[0]!)
    if (a.lines[0]!.uci === uci) return { cp: best, best }
    const g = new Chess(fen)
    applyUci(g, uci)
    return { cp: -score((await analyse(g.fen())).lines[0]!), best }
  }
  const candidate = (fen: string, uci: string, source: Source, evalCp: number | null, label?: string, note?: string): Candidate => {
    const m = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return { uci, san: m.san, evalCp, source, ...(label ? { label } : {}), ...(note ? { note } : {}) }
  }
  const nodeAt = (key: string, fen: string): TreeNode =>
    (nodes[key] ??= { key, fen, ownMove: new Chess(fen).turn() === ownColor, candidates: [], active: 0, replies: [] })
  const addReply = (n: TreeNode, uci: string, source: Source) => {
    if (!n.replies.some((r) => r.uci === uci)) n.replies.push(candidate(n.fen, uci, source, null))
  }

  // lines of this opening, shortest first (deterministic), plus the document entry as a pseudo line
  const mine = lines
    .filter((l) => spec.variationNames.some((p) => l.name.startsWith(p)))
    .sort((a, b) => a.uci.length - b.uci.length || a.name.localeCompare(b.name))
  const handLines = (spec.extraVariations ?? []).map((v) => v.line)
  const entryWalks = [spec.entry, ...(spec.extraEntries ?? []), ...handLines].map((sans) => {
    const g = new Chess()
    return walk(sans.map((san) => {
      const m = g.move(san)
      return m.from + m.to + (m.promotion ?? '')
    }))
  })
  const walked: Walked[] = mine.map((line) => ({ line, ...walk(line.uci) }))
  for (const w of [...entryWalks, ...walked]) {
    for (const s of w.steps) s.ownMove = new Chess(s.fen).turn() === ownColor
  }

  // how many lines use which own move at a position: the most used theory move wins
  const theory = new Map<string, Map<string, { count: number; ref: string }>>()
  for (const w of walked) {
    for (const s of w.steps) {
      if (!s.ownMove) continue
      const m = theory.get(s.key) ?? new Map()
      const e = m.get(s.uci) ?? { count: 0, ref: w.line.name }
      e.count++
      m.set(s.uci, e)
      theory.set(s.key, m)
    }
  }

  const uciOfSan = (fen: string, san: string): string => {
    const m = new Chess(fen).move(san)
    return m.from + m.to + (m.promotion ?? '')
  }

  /** Active/subtree candidates first (document, theory or engine), then the other theory moves as inactive ones. */
  async function chooseOwn(n: TreeNode, s: Step | null, isEntry: boolean): Promise<void> {
    if (n.candidates.length > 0) return
    const ranked = [...(theory.get(n.key) ?? [])].sort((a, b) => b[1].count - a[1].count)
    const docs = docChoices.get(n.key)
    let vetoed: string | null = null
    if (docs || (isEntry && s)) {
      for (const c of docs ?? [{ san: s!.san }]) {
        const uci = uciOfSan(n.fen, c.san)
        const e = await evalMove(n.fen, uci)
        if (e.best - e.cp > opts.vetoCp) docWarnings.push({ key: n.key, uci, lossCp: e.best - e.cp })
        n.candidates.push(candidate(n.fen, uci, docSource, e.cp, c.label))
        branch.add(`${n.key}|${uci}`)
      }
    } else {
      const a = await analyse(n.fen)
      const top = ranked[0]
      let chosen = false
      if (top) {
        const e = await evalMove(n.fen, top[0])
        if (e.best - e.cp <= opts.vetoCp) {
          n.candidates.push(candidate(n.fen, top[0], { kind: 'chess-openings', ref: top[1].ref }, e.cp))
          branch.add(`${n.key}|${top[0]}`)
          chosen = true
        } else {
          vetoed = top[0]
          vetoes.push({ key: n.key, theoryUci: top[0], bestUci: a.bestUci, lossCp: e.best - e.cp })
        }
      }
      if (!chosen) {
        n.candidates.push(candidate(n.fen, a.bestUci, engineSource, score(a.lines[0]!)))
        branch.add(`${n.key}|${a.bestUci}`)
      }
    }
    for (const [uci, info] of ranked) {
      if (n.candidates.some((c) => c.uci === uci)) continue
      const e = await evalMove(n.fen, uci)
      const note = uci === vetoed ? 'Theoriezug, vom Veto verworfen' : undefined
      n.candidates.push(candidate(n.fen, uci, { kind: 'chess-openings', ref: info.ref }, e.cp, undefined, note))
    }
  }

  /** Follows an engine principal variation behind a leaf: opponent reply, own move, ... */
  function extend(n: TreeNode, pv: string[], plyOfNode: number): void {
    const g = new Chess(n.fen)
    if (!applyUci(g, pv[0] ?? '')) return
    let ply = plyOfNode + 1
    for (let i = 1; i <= opts.branchExtraOwnMoves; i++) {
      const [reply, own] = [pv[2 * i - 1], pv[2 * i]]
      if (!reply || !own || ply + 2 > opts.ownPlies) return
      const oppKey = positionKey(g.fen())
      if (nodes[oppKey]) return
      const opp = nodeAt(oppKey, g.fen())
      if (!applyUci(g, reply)) return
      opp.replies.push(candidate(opp.fen, reply, engineSource, null))
      const ownKey = positionKey(g.fen())
      if (nodes[ownKey]) return
      const mine = nodeAt(ownKey, g.fen())
      const m = new Chess(mine.fen)
      if (!applyUci(m, own)) return
      mine.candidates.push(candidate(mine.fen, own, engineSource, null))
      g.move({ from: own.slice(0, 2), to: own.slice(2, 4), promotion: own[4] })
      ply += 2
    }
  }

  const completed: Walked[] = []
  const leaves: { key: string; fen: string; ply: number }[] = []

  /** null = the whole line lies inside the tree; otherwise why it was cut. */
  async function follow(steps: Step[], source: (s: Step) => Source, isEntry: boolean): Promise<string | null> {
    for (const [ply, s] of steps.entries()) {
      if (ply >= opts.ownPlies) return `tiefer als ownPlies (${opts.ownPlies})`
      const n = nodeAt(s.key, s.fen)
      if (s.ownMove) {
        await chooseOwn(n, s, isEntry)
        if (!branch.has(`${s.key}|${s.uci}`)) return `Alternativzug ${s.san} im Zug ${Math.floor(ply / 2) + 1} (nur inaktiver Kandidat)`
      } else addReply(n, s.uci, source(s))
    }
    return null
  }

  for (const ew of entryWalks) await follow(ew.steps, () => docSource, true)
  for (const w of walked) {
    const cut = await follow(w.steps, () => ({ kind: 'chess-openings', ref: w.line.name }), false)
    if (cut) {
      dropped.push({ name: w.line.name, reason: cut })
      continue
    }
    completed.push(w)
    const end = nodeAt(w.end.key, w.end.fen)
    if (end.ownMove && end.candidates.length === 0 && new Chess(end.fen).moves().length > 0) leaves.push({ key: end.key, fen: end.fen, ply: w.steps.length })
  }
  // leaves only after all theory is placed, so a theory move through the same node always wins over the engine
  for (const l of leaves) {
    const n = nodes[l.key]!
    if (n.candidates.length > 0) continue
    await chooseOwn(n, null, false)
    extend(n, (await analyse(n.fen)).lines[0]!.pv, l.ply)
  }

  // deepening: own move document > theory > engine, opponent move = engine best answer (Explorer not available)
  const minPlies = opts.minPlies ?? 0
  const lineOf = new Map<Walked, { sans: string[]; endKey: string }>()
  const materialBehind = (g: Chess): boolean => {
    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
    let own = 0
    let opp = 0
    for (const row of g.board()) for (const sq of row) if (sq) (sq.color === ownColor ? (own += val[sq.type]!) : (opp += val[sq.type]!))
    return own < opp
  }
  /** Plays on from `g` (mutated) until `minTo`, or `maxTo` while the own side is behind; returns the SANs played. */
  async function playOn(g: Chess, ply: number, minTo: number, maxTo: number, branchFrom: number | null, budgeted = false, redirect?: Redirect): Promise<string[]> {
    const played: string[] = []
    let opponentMoves = 0
    while (!g.isGameOver() && !(budgeted && Object.keys(nodes).length >= (opts.nodeBudget ?? 600))) {
      if (ply >= minTo && !(ply < maxTo && materialBehind(g))) break
      const fen = g.fen()
      const n = nodeAt(positionKey(fen), fen)
      let uci: string
      if (n.ownMove) {
        await chooseOwn(n, null, false)
        uci = n.candidates[n.active]!.uci
        branch.add(`${n.key}|${uci}`)
      } else {
        const a = await analyse(fen)
        const rd = redirect && !redirect.used && ply >= redirect.from ? redirect : undefined
        if (rd) rd.used = true
        const blockedAll = rd?.blocked.get(n.key)
        const explorerAll = (await opts.explorer?.(fen)) ?? []
        const explorerMoves = explorerAll.filter((m) => m.games >= 20 && applyUci(new Chess(fen), m.uci))
        const explorerSource: Source = { kind: 'lichess-explorer', ref: '1400-1800' }
        // redirect: only to a move that is common (>= 10 % of the explorer games here, >= 50 games); without explorer data the
        // second best engine move counts when it is at most 50 cp behind the best; otherwise the variation runs on and becomes a stage (partOf)
        let steered: { uci: string; source: Source } | undefined
        if (rd && blockedAll) {
          const total = explorerAll.reduce((sum, m) => sum + m.games, 0)
          const alt = explorerMoves.find((m) => !blockedAll.has(m.uci) && m.games >= 50 && m.games / total >= 0.1)
          if (alt) {
            steered = { uci: alt.uci, source: explorerSource }
            redirects.push({ variation: rd.name, uci: alt.uci, san: new Chess(fen).move({ from: alt.uci.slice(0, 2), to: alt.uci.slice(2, 4), promotion: alt.uci[4] }).san, share: alt.games / total, games: alt.games, source: 'explorer' })
          } else if (explorerAll.length === 0) {
            const lines = (await analyseSafe(engine, fen, { depth, multipv: 2 })).lines
            const second = lines.slice(1).find((l) => !blockedAll.has(l.uci) && score(lines[0]!) - score(l) <= 50)
            if (second) {
              steered = { uci: second.uci, source: engineSource }
              redirects.push({ variation: rd.name, uci: second.uci, san: new Chess(fen).move({ from: second.uci.slice(0, 2), to: second.uci.slice(2, 4), promotion: second.uci[4] }).san, share: null, games: 0, source: 'stockfish' })
            }
          }
        }
        const cands: { uci: string; source: Source }[] = steered ? [steered] : [
          ...explorerMoves.map((m) => ({ uci: m.uci, source: explorerSource })),
          { uci: a.bestUci, source: engineSource },
        ]
        const repeats = (uci: string): boolean => {
          g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
          const r = g.isThreefoldRepetition()
          g.undo()
          return r
        }
        const first = cands[0]!
        let pick = first
        if (repeats(first.uci)) {
          // a repetition is skipped for a sound alternative (<= 150 cp worse)
          let found: (typeof cands)[number] | undefined
          for (const c of cands) {
            if (c === first || repeats(c.uci)) continue
            const e = await evalMove(fen, c.uci)
            if (e.best - e.cp > 150) continue
            found = c
            break
          }
          pick = found ?? first
        }
        uci = pick.uci
        addReply(n, uci, pick.source)
        if (branchFrom !== null && ply >= branchFrom && opponentMoves++ < 3) pendingBranches.push({ fen, ply, best: a })
      }
      const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      played.push(m.san)
      ply++
    }
    const end = nodeAt(positionKey(g.fen()), g.fen())
    if (end.ownMove && end.candidates.length === 0 && !g.isGameOver()) await chooseOwn(end, null, false)
    return played
  }
  /** Alternatives found while deepening the main lines; played only after all main lines, within the node budget. */
  const redirects: { variation: string; uci: string; san: string; share: number | null; games: number; source: 'explorer' | 'stockfish' }[] = []
  const pendingBranches: { fen: string; ply: number; best: Analysis }[] = []
  /** Further opponent answers within branchWithinCp of the best one, each continued to branchPlies. */
  async function branchAt(fen: string, ply: number, best: Analysis): Promise<void> {
    const limit = opts.branchMoves ?? 2
    const multi = await analyseSafe(engine, fen, { depth, multipv: limit + 1 })
    const top = score(multi.lines[0]!)
    const alts = multi.lines.slice(1).filter((l) => l.uci !== best.bestUci && top - score(l) <= (opts.branchWithinCp ?? 60)).slice(0, limit)
    for (const l of alts) {
      const h = new Chess(fen)
      addReply(nodes[positionKey(fen)]!, l.uci, engineSource)
      h.move({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), promotion: l.uci[4] })
      await playOn(h, ply + 1, opts.branchPlies ?? 24, opts.branchPlies ?? 24, null, true)
    }
  }
  if (minPlies > 0) {
    for (const w of completed) {
      const g = new Chess()
      for (const st of w.steps) g.move(st.san)
      const sans = w.steps.map((st) => st.san)
      const blocked = new Map<string, Set<string>>()
      for (const o of completed) {
        if (o === w || !o.steps.some((st) => st.key === w.end.key)) continue
        for (const st of o.steps) if (!st.ownMove) (blocked.get(st.key) ?? blocked.set(st.key, new Set()).get(st.key)!).add(st.uci)
      }
      const more = await playOn(g, sans.length, minPlies, opts.maxPlies ?? 36, sans.length, false, { name: w.line.name, from: sans.length, blocked, used: false })
      lineOf.set(w, { sans: [...sans, ...more], endKey: positionKey(g.fen()) })
    }
  }

  const variations: Variation[] = []
  const usedIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const w of completed) {
    if (seenNames.has(w.line.name)) continue
    seenNames.add(w.line.name)
    const base = slug(w.line.name)
    let id = base
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`
    usedIds.add(id)
    variations.push({
      id,
      name: NAMES_DE[w.line.name] ?? w.line.name,
      nameEn: w.line.name,
      line: lineOf.get(w)?.sans ?? w.steps.map((s) => s.san),
      keyPositions: [lineOf.get(w)?.endKey ?? w.end.key],
      fromDocument: w.steps.some((s) => s.ownMove && docChoices.get(s.key)?.some((c) => c.label && c.san === s.san)),
    })
  }
  const handWalks = entryWalks.slice(entryWalks.length - handLines.length)
  for (const [i, v] of (spec.extraVariations ?? []).entries()) {
    const base = slug(v.nameEn)
    let id = base
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`
    usedIds.add(id)
    const hw = handWalks[i]!
    const g = new Chess()
    const sans = hw.steps.map((s) => s.san)
    for (const san of sans) g.move(san)
    // the last position is always a node; a game-over end (mate, stalemate) stays as it is and never reaches the engine
    nodeAt(hw.end.key, hw.end.fen)
    let endKey = hw.end.key
    if (!g.isGameOver()) {
      sans.push(...(await playOn(g, sans.length, minPlies, opts.maxPlies ?? 36, null)))
      endKey = positionKey(g.fen())
    }
    variations.push({ id, name: v.name, nameEn: v.nameEn, line: sans, keyPositions: [endKey], fromDocument: true })
  }
  // a variation that is identical to, or only the first part of, a more specific one becomes a stage of it (no twins)
  const specificity = (v: Variation) => v.line.length * 1000 + v.nameEn.length
  for (const a of variations) {
    const parents = variations.filter((b) => b !== a && b.line.length >= a.line.length && a.line.every((m, i) => m === b.line[i]) &&
      (b.line.length > a.line.length || b.nameEn.length > a.nameEn.length ||
        (b.nameEn.length === a.nameEn.length && variations.indexOf(b) < variations.indexOf(a))))
    const best = parents.sort((x, y) => specificity(y) - specificity(x))[0]
    if (best) a.partOf = best.id
  }
  for (const a of variations) {
    for (let guard = 0; a.partOf && guard < variations.length; guard++) {
      const up = variations.find((v) => v.id === a.partOf)?.partOf
      if (!up || up === a.id) break
      a.partOf = up
    }
  }
  const ends = variations.map((v) => {
    const g = new Chess()
    for (const m of v.line) g.move(m)
    return { id: v.id, plies: v.line.length, reason: endReason(g) }
  })
  for (const b of pendingBranches) {
    if (Object.keys(nodes).length >= (opts.nodeBudget ?? 600)) break
    await branchAt(b.fen, b.ply, b.best)
  }
  return { redirects, ends, nodes, variations, vetoes, docWarnings, dropped }
}
