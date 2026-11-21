import { publicUrl } from '../ui/assetBase.ts'
import { createMaiaClient } from './client.ts'
import type { WorkerLike } from './protocol.ts'

/** The one Maia client of the page: the model URL is fixed (M7: no other model, no parameter). */
export const maia = createMaiaClient(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
  publicUrl('maia2/maia_rapid.onnx'),
)
