import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'

/* --- 導入 FontAwesome 核心 --- */
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

/* --- 導入你需要的特定圖示 --- */
// far 代表 Regular (線條型)，如果要實心的請裝 free-solid-svg-icons 並用 fas
import { faCircleQuestion } from '@fortawesome/free-regular-svg-icons'

/* --- 將圖示加入圖庫 --- */
library.add(faCircleQuestion)

const app = createApp(App)
const pinia = createPinia()

// 1. 先將持久化套件掛載到 pinia 實體上
pinia.use(piniaPluginPersistedstate)

// 2. 依序把設定好的 pinia、router 和 FontAwesome 元件掛載到 app 上
app.use(pinia)
app.use(router)

// 註冊全域組件，這樣你在任何 .vue 檔案都能直接用 <font-awesome-icon>
app.component('font-awesome-icon', FontAwesomeIcon)

// 3. 確保所有設定都完成後，最後一步才是將 app 渲染 (mount) 到畫面上
app.mount('#app')
