interface KeyEventLike { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: unknown }

/** "H" asks for a hint, unless the user is typing somewhere or uses a shortcut. */
export function hintKeyApplies(e: KeyEventLike): boolean {
  if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) return false
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null
  const tag = t?.tagName
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable)
}

/** Engine lock in the drill: closed for the whole task (also after a miss or hint) until the solution is shown. */
export const drillEngineLock = (s: { myTurn: boolean; solutionShown: boolean }): 'task' | null => (s.myTurn && !s.solutionShown ? 'task' : null)
