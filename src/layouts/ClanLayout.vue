<script setup lang="ts">
import SideBar from '@/components/SideBar.vue'
</script>

<template>
  <div class="layout">
    <SideBar />
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  width: 100vw;
  min-height: 100vh;
}

.content {
  flex: 1;
  min-width: 0; /* ⭐⭐⭐ 關鍵救命行 */
  background: #0e0f13;
  min-height: 100vh;
}
</style>
