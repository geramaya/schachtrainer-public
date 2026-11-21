export type Verdict = 'passt' | 'stimmt-nicht'
export type Feedback = Record<string, { verdict: Verdict; note?: string; contentVersion: string }>

export const NOTE_MAX = 500

export function rate(fb: Feedback, id: string, verdict: Verdict, note: string | undefined, contentVersion: string): Feedback {
  const entry: Feedback[string] = { verdict, contentVersion }
  if (note) entry.note = note.slice(0, NOTE_MAX)
  return { ...fb, [id]: entry }
}

/** Parses stored feedback; anything malformed gives an empty state, never throws. */
export function parseFeedback(raw: string | null): Feedback {
  if (!raw) return {}
  let data: unknown
  try { data = JSON.parse(raw) } catch { return {} }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}
  const out: Feedback = {}
  for (const [id, v] of Object.entries(data)) {
    const e = v as { verdict?: unknown; note?: unknown; contentVersion?: unknown }
    if ((e?.verdict !== 'passt' && e?.verdict !== 'stimmt-nicht') || typeof e.contentVersion !== 'string') continue
    out[id] = { verdict: e.verdict, contentVersion: e.contentVersion }
    if (typeof e.note === 'string') out[id]!.note = e.note.slice(0, NOTE_MAX)
  }
  return out
}
