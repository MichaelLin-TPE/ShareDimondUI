<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { onMounted, ref } from 'vue'
import { useAuthInit } from '@/composables/useAuthInit.ts'

const route = useRoute()

// 建立一個響應式變數來記錄是否為行動裝置
const isMobile = ref(false)

onMounted(() => {
  useAuthInit()

  // 判斷是否為非 PC 瀏覽器 (行動裝置)
  const userAgentInfo = navigator.userAgent.toLowerCase()
  const mobileAgents = ['android', 'iphone', 'symbianos', 'windows phone', 'ipad', 'ipod']
  isMobile.value = mobileAgents.some((agent) => userAgentInfo.includes(agent))

  // 如果是手機，跳出系統原生的警告彈窗
  if (isMobile.value) {
    alert('目前系統尚未支援手機瀏覽器，為確保功能正常運作，請改用 PC 瀏覽器！')
  }
})
</script>

<template>
  <div v-if="isMobile" class="mobile-blocker">
    <div class="blocker-content">
      <h2>⚠️ 設備不支援</h2>
      <p>目前 Diamond Core 系統尚未支援手機瀏覽器<br />請改用 PC 瀏覽器以獲得最佳體驗！</p>
    </div>
  </div>

  <template v-else>
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
      <div>
        <RouterView />
      </div>
    </template>
  </template>
</template>

<style scoped>

/* ===== 新增：手機版遮罩樣式 ===== */
.mobile-blocker {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); /* 半透明黑底 */
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  text-align: center;
}

.blocker-content {
  background: #222;
  padding: 2rem 3rem;
  border-radius: 12px;
  border: 1px solid #444;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.blocker-content h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #ff4d4f; /* 警告用的紅色 */
}
/* ================================ */

/* 以下為你原本的 CSS 保持不變 */
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
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

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
