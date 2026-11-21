import { createApp } from 'vue'
import '@lichess-org/chessground/assets/chessground.base.css'
import '@lichess-org/chessground/assets/chessground.brown.css'
import '@lichess-org/chessground/assets/chessground.cburnett.css'
import './styles.css'
import App from './App.vue'

import { installQuipUnlock } from './audio/play-quip.ts'

installQuipUnlock()
createApp(App).mount('#app')
