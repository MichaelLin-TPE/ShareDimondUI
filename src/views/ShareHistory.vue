<script setup lang="ts">
import { useAuction } from '@/composables/shareHistory'
import { computed } from 'vue'

const { auctions, roleTextMap, formatEventTime } = useAuction()

const sortedAuctions = computed(() => {
  return [...auctions.value].sort((a, b) => {
    return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  })
})
</script>

<template>
  <div class="event-container">
    <div class="event-grid">
      <div v-for="item in sortedAuctions" :key="item.createTime" class="event-card">
        <div class="event-role">
          {{ roleTextMap[item.role] }}
        </div>

        <div class="event-content">
          {{ item.eventContent }}
        </div>

        <div class="event-time">
          {{ formatEventTime(item.createTime) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 外層留白（重點） ===== */
.event-container {
  padding: 16px; /* 👈 不再黏邊 */
}

/* ===== 兩個一行 ===== */
.event-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 👈 一行兩個 */
  gap: 14px;
}

/* ===== 卡片 ===== */
.event-card {
  background: linear-gradient(180deg, #161822, #0f111a);
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
}

/* ===== ROLE ===== */
.event-role {
  font-size: 13px;
  font-weight: 600;
  color: #ffd166;
  margin-bottom: 6px;
}

/* ===== 內容 ===== */
.event-content {
  font-size: 15px;
  color: #ffffff;
  margin-bottom: 6px;
  line-height: 1.4;
}
.event-content {
  white-space: pre-line;
}

/* ===== 時間 ===== */
.event-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

/* ===== 手機自動變一行一個 ===== */
@media (max-width: 600px) {
  .event-grid {
    grid-template-columns: 1fr;
  }
}
</style>
