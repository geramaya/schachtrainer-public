import type { Engine } from '../../src/engine/service.ts'
import type { Explanation, TreeNode, Trees } from '../../src/content/types.ts'
import { checkClaims, ClaimCheckError } from './check-claims.ts'

/**
 * The only way an explanation becomes `engine-geprüft`: every explanation with claims is run through
 * checkClaims; status and `verified` of the input are discarded. `human-ok` (signed off by the owner) and
 * claim-free explanations pass unchanged. Collects all failures, then throws one ClaimCheckError.
 */
export async function verifyExplanations(
  explanations: Explanation[], nodes: Record<string, TreeNode>, engine: Engine, depth = 18,
): Promise<Explanation[]> {
  const out: Explanation[] = []
  const failures: string[] = []
  for (const e of explanations) {
    if (e.claims.length === 0 || e.status === 'human-ok') {
      out.push(e)
      continue
    }
    const node = nodes[e.key]
    if (!node) {
      failures.push(`${e.id}: missing key ${e.key}`)
      continue
    }
    const fresh: Explanation = { ...e, status: 'entwurf', claims: e.claims.map(({ kind, uci }) => ({ kind, uci })) }
    try {
      out.push(await checkClaims(fresh, node.fen, engine, depth))
    } catch (err) {
      if (!(err instanceof ClaimCheckError)) throw err
      failures.push(...err.failures.map((f) => `${e.id}: ${f}`))
    }
  }
  if (failures.length > 0) throw new ClaimCheckError('Inhalt', failures)
  return out
}

/**
 * Verifies each explanation against the tree of its own opening (ids start with "<opening id>/"): the same
 * position key lives in several trees, and only the tree of its opening is the one the explanation is about.
 * An explanation of an unknown opening fails the build. Order of the input is kept.
 */
export async function verifyByOpening(
  explanations: Explanation[], openings: { id: string }[], trees: Trees, engine: Engine, depth = 18,
): Promise<Explanation[]> {
  const orphans = explanations.filter((e) => !openings.some((o) => e.id.startsWith(`${o.id}/`)))
  if (orphans.length > 0) throw new Error(`Erklärung ohne bekannte Eröffnung: ${orphans.map((e) => e.id).join(', ')}`)
  const out = new Map<string, Explanation>()
  for (const o of openings) {
    const mine = explanations.filter((e) => e.id.startsWith(`${o.id}/`))
    for (const e of await verifyExplanations(mine, trees[o.id] ?? {}, engine, depth)) out.set(e.id, e)
  }
  return explanations.flatMap((e) => out.get(e.id) ?? [])
}
