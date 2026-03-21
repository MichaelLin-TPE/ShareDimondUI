<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { onMounted } from 'vue'
import { useAuthInit } from '@/composables/useAuthInit.ts'

const route = useRoute()

onMounted(() => {
  useAuthInit()
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
</template>

<style scoped>
/* 👇 這裡 100% 恢復你最初始的 CSS，保證不動到你原本的一般頁面排版 👇 */
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
/* 👇 登入頁專屬手機版優化：隱藏左側 Logo，完美置中登入卡片 👇 */
@media (max-width: 768px) {
  /* 1. 直接隱藏 App.vue 產生的左半部 Logo 與文字 */
  header {
    display: none !important;
  }

  /* 2. 強制讓 Vue 的最外層根目錄變成「彈性置中」 */
  #app {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important; /* 垂直置中 */
    align-items: center !important; /* 水平置中 */
    min-height: 100vh !important; /* 撐滿全螢幕高度 */
    padding: 20px !important;
    box-sizing: border-box !important;
  }

  /* 3. 讓剩下的 RouterView (登入卡片) 釋放寬度並置中 */
  #app > *:not(header) {
    width: 100% !important;
    max-width: 400px !important; /* 限制寬度，維持卡片的精緻比例 */
    margin: 0 auto !important;
  }
}
</style>
