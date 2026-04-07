<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'

// 檢查通知權限狀態，決定是否顯示自訂彈窗

const route = useRoute()
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
</template>

<style scoped>
/* 👇 自訂彈窗的樣式 👇 */
.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.custom-modal-content {
  background: #1e1e2e;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 30px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
  animation: popIn 0.3s ease-out;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.modal-title {
  color: #f1f5f9;
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.modal-desc {
  color: #94a3b8;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 25px;
}

.modal-actions {
  display: flex;
  gap: 15px;
}

.modal-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #2d3047;
  color: #94a3b8;
  border: 1px solid #3f425b;
}

.btn-cancel:hover {
  background: #3f425b;
  color: #fff;
}

.btn-confirm {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.btn-confirm:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

/* 👇 下面保留你原本的 CSS 👇 */
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

<style>
/* 手機版登入頁優化 (保留你寫的) */
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
  #app > *:not(header) {
    width: 100% !important;
    max-width: 400px !important;
    margin: 0 auto !important;
  }
}
</style>
