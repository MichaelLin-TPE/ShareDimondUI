<script setup lang="ts">
import SideBar from '@/components/SideBar.vue'
import NotifierHub from '@/components/NotifierHub.vue'
</script>

<template>
  <div class="layout">
    <SideBar />
    <main class="content">
      <router-view />
    </main>
    <NotifierHub />
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

/* 漢堡按鈕浮在 top:15 left:15 (40x40)。各頁標題列保留左側 48px,
   讓 ICON 跟標題視覺上同處一排,不再吃掉整個頂部 */
.content :deep(.page-title-row),
.content :deep(.page-header),
.content :deep(.km-header),
.content :deep(.cs-header),
.content :deep(.g-header),
.content :deep(.header-content) {
  padding-left: 48px;
}
</style>
