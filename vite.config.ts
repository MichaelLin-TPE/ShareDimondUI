import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // 打包的時間,塔防的診斷訊息會帶著它,看截圖就知道玩家跑的是哪一版
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')) },
  base: '/', // 確保在自定義域名下，資源路徑指向根目錄
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
