export type NoteStatus = { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }
export interface NoteKey { id: string; ply: number }

export interface NoteSaverOptions {
  delayMs: number
  save: (id: string, ply: number, text: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onStatus: (s: NoteStatus) => void
  /** timer functions are parameters so tests can run on a manual clock */
  schedule: (fn: () => void, ms: number) => unknown
  cancel: (handle: unknown) => void
}

/**
 * Saves the note of a move automatically: debounced while typing, at once when the note belongs to another move or game, on demand
 * (leaving the page). A text is always saved under the id and move it was typed for, never under what is shown at save time.
 * Saves run one after the other.
 */
export function createNoteSaver(o: NoteSaverOptions) {
  let pending: { key: NoteKey; text: string } | null = null
  let timer: unknown = null
  let chain: Promise<void> = Promise.resolve()
  const lastSaved = new Map<string, string>()
  const idOf = (k: NoteKey) => `${k.id}#${k.ply}`

  function flush(): Promise<void> {
    if (timer !== null) { o.cancel(timer); timer = null }
    const job = pending
    pending = null
    if (!job) return chain
    chain = chain.then(async () => {
      if (lastSaved.get(idOf(job.key)) === job.text) return
      o.onStatus({ kind: 'saving' })
      const r = await o.save(job.key.id, job.key.ply, job.text)
      if (r.ok) { lastSaved.set(idOf(job.key), job.text); o.onStatus({ kind: 'saved' }) } else o.onStatus({ kind: 'error', message: r.message })
    })
    return chain
  }

  return {
    change(key: NoteKey, text: string) {
      if (pending && idOf(pending.key) !== idOf(key)) void flush()
      pending = { key, text }
      if (timer !== null) o.cancel(timer)
      timer = o.schedule(() => { timer = null; void flush() }, o.delayMs)
    },
    flush,
    /** resolves when every save started so far is finished */
    idle: () => chain,
  }
}

/**
 * Save function for a game whose database id is not known yet (a finished game is stored a moment after its end):
 * `idOf(key)` resolves to the stored id, or null if the game could not be stored.
 */
export function deferredNoteSave(
  idOf: (key: string) => Promise<string | null>,
  write: (id: string, ply: number, text: string) => Promise<{ ok: true } | { ok: false; message: string }>,
): NoteSaverOptions['save'] {
  return async (key, ply, text) => {
    const id = await idOf(key)
    if (!id) return { ok: false, message: 'Die Partie ist nicht gespeichert, die Notiz kann nicht abgelegt werden.' }
    return write(id, ply, text)
  }
}
