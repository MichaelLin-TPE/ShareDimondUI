<script setup lang="ts">

import { useAuction } from '@/composables/clanNotice.ts'

const { announcement, noticeItemList } = useAuction()
</script>

<template>
  <div class="notice-container">
    <div class="marquee-box">
      <div class="marquee-title">最新動態</div>
      <div class="marquee-content">
        <div class="marquee-track">
          <span v-for="(item, index) in noticeItemList" :key="index">
            {{ item }} &nbsp;&nbsp;&nbsp;&nbsp;
          </span>
          <span v-for="(item, index) in noticeItemList" :key="'repeat-' + index">
            {{ item }} &nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        </div>
      </div>
    </div>

    <div class="board-box">
      <h3>📢 血盟碎碎念</h3>
      <p>{{ announcement }}</p>
    </div>
  </div>
</template>

<style scoped>
.notice-container {
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.2); /* 金色邊框點綴 */
  overflow: hidden;
}

/* 跑馬燈樣式 */
.marquee-box {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 16px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.marquee-title {
  background: #d4af37;
  color: #1a1a1a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-right: 12px;
  white-space: nowrap;
}

.marquee-content {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
}

.marquee-track {
  display: inline-block;
  animation: marquee 100s linear infinite;
  color: #ffd700;
  font-size: 0.95rem;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

/* 公佈欄樣式 */
.board-box {
  padding: 16px;
}

.board-box h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: #fff;
  display: flex;
  align-items: center;
}

.board-box p {
  margin: 0;
  color: #ccc;
  line-height: 1.6;
  font-size: 0.95rem;
}
</style>
