import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

// 1. 先將持久化套件掛載到 pinia 實體上
pinia.use(piniaPluginPersistedstate)

// 2. 依序把設定好的 pinia 和 router 掛載到 app 上
app.use(pinia)
app.use(router)

// 3. 確保所有設定都完成後，最後一步才是將 app 渲染 (mount) 到畫面上
app.mount('#app')
