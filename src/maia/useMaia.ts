import { ref } from 'vue'
import type { MaiaStatus } from './client.ts'
import { maia } from './instance.ts'

/** The state of Maia as a Vue ref (one client per page, so one shared ref). */
export const maiaStatus = ref<MaiaStatus>(maia.status())
maia.subscribe((s) => { maiaStatus.value = s })
export { maia }
