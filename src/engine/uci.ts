export interface InfoLine {
  depth: number
  cp: number | null
  mate: number | null
  pv: string[]
  multipv: number
}

/** Parses a UCI `info` line; null unless it carries depth, a score and a pv. */
export function parseInfo(line: string): InfoLine | null {
  const t = line.trim().split(/\s+/)
  if (t[0] !== 'info') return null
  let depth: number | null = null
  let cp: number | null = null
  let mate: number | null = null
  let multipv = 1
  let pv: string[] = []
  for (let i = 1; i < t.length; i++) {
    const w = t[i]
    if (w === 'depth') depth = Number(t[++i])
    else if (w === 'multipv') multipv = Number(t[++i])
    else if (w === 'score') {
      const kind = t[++i]
      const v = Number(t[++i])
      if (kind === 'cp') cp = v
      else if (kind === 'mate') mate = v
      if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null // not exact
    } else if (w === 'pv') {
      pv = t.slice(i + 1)
      break
    }
  }
  if (depth === null || Number.isNaN(depth) || (cp === null && mate === null) || pv.length === 0) return null
  return { depth, cp, mate, pv, multipv }
}

/** Returns the move of a `bestmove` line, or null (also for `bestmove (none)`). */
export function parseBestMove(line: string): string | null {
  const m = /^bestmove\s+(\S+)/.exec(line.trim())
  return m && m[1] !== '(none)' ? m[1] : null
}
