<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'

const route = useRoute()

// 控制圖片彈窗顯示狀態的變數
const showUsageImage = ref(false)
// 新增：控制 LINE QR Code 彈窗顯示狀態的變數
const showLineQR = ref(false)

const isLoginPage = computed(() => {
  return route.name === 'login' // 對應你 router 裡的 name: 'login'
})
</script>

<template>
  <div v-if="route.meta.fullscreen" id="app" :class="{ fullscreen: route.meta.fullscreen }">
    <RouterView />
  </div>

  <template v-else>
    <header>
      <img
        alt="Vue logo"
        class="logo"
        src="@/assets/share_diamond_logo.png"
        width="200"
        height="200"
      />
      <div class="wrapper">
        <HelloWorld msg="Diamond Core" />
      </div>
    </header>
    <RouterView />
  </template>

  <footer v-if="isLoginPage" class="bottom-nav">
    <button class="nav-link" @click="showUsageImage = true">核心用法</button>
    <div class="divider"></div>
    <button class="nav-link" @click="showLineQR = true">聯絡我們</button>
    <div class="divider"></div>
    <button class="nav-link">收費方式</button>
  </footer>

  <div
    v-if="isLoginPage && showUsageImage"
    class="image-modal-overlay"
    @click="showUsageImage = false"
  >
    <div class="image-modal-container" @click.stop>
      <button class="close-btn" @click="showUsageImage = false">✕</button>
      <img src="@/assets/core_logic_pic.png" alt="核心用法教學" class="usage-image" />
    </div>
  </div>

  <div v-if="isLoginPage && showLineQR" class="image-modal-overlay" @click="showLineQR = false">
    <div class="image-modal-container" @click.stop>
      <img
        src="https://qr-official.line.me/gs/M_920wuugp_GW.png?oat_content=qr"
        alt="加入 LINE 聯絡我們"
        class="usage-image"
        style="background-color: white; padding: 15px"
      />
    </div>
  </div>
</template>

<style scoped>
/* --- 圖片彈窗樣式 --- */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); /* 半透明黑底 */
  backdrop-filter: blur(5px); /* 背景模糊化，增加質感 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000; /* 確保在最上層，蓋過導覽列 */
}

.image-modal-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease-out;
}

.usage-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain; /* 確保圖片不變形 */
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.close-btn {
  position: absolute;
  top: -40px; /* 放在圖片右上角外面 */
  right: 0;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 2rem;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* --- 底部固定導覽樣式 --- */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 25px 0;
  width: auto;
  z-index: 9999;
  background: transparent;
}

.nav-link {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  padding: 5px 10px;
}

.nav-link:hover {
  color: #6366f1;
  text-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.divider {
  margin-top: 25px;
  width: 1px;
  height: 12px;
  background-color: #334155;
}

/* --- 基本佈局樣式 --- */
header {
  line-height: 1.5;
  max-height: 100vh;
}
.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }
  .logo {
    margin: 0 2rem 0 0;
  }
  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

<style>
/* 手機版全局優化 */
@media (max-width: 768px) {
  header {
    display: none !important;
  }
  #app {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 100vh !important;
    padding: 20px !important;
    box-sizing: border-box !important;
  }
}
</style>
