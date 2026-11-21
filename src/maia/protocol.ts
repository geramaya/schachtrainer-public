/** Messages between the page and the Maia worker (src/maia/worker.ts). */
export type ToWorker =
  | { type: 'load'; url: string }
  | { type: 'run'; id: number; boards: Float32Array; eloSelf: number; eloOppo: number }

export type FromWorker =
  | { type: 'progress'; phase: 'download'; loaded: number; total: number }
  | { type: 'progress'; phase: 'verify' }
  | { type: 'ready' }
  | { type: 'loadError'; message: string }
  | { type: 'result'; id: number; logits: Float32Array }
  | { type: 'runError'; id: number; message: string }

/** What the client needs of a Worker (a fake in the tests). */
export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void
  onmessage: ((e: { data: FromWorker }) => void) | null
  onerror: ((e: { message?: string }) => void) | null
  terminate(): void
}
