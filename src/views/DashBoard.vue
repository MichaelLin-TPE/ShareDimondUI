<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import ClanNotice from '@/components/ClanNotice.vue' // 引入新組件
import { useAuthStore } from '@/stores/auth.ts'
import BiddingManagement from '@/components/BiddingManagement.vue'

const authStore = useAuthStore()
</script>

<template>
  <div class="dashboard">
    <h1 v-if="authStore.member">{{ authStore.member.clanName }} 血盟大廳</h1>

    <ClanNotice />

    <div class="stats">
      <TreasureCard class="treasureCard" />
      <StatCard />
      <BiddingManagement class="biddingManagement" />
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 24px;
  color: #fff;
}

/* 這裡是關鍵：控制所有組件的上下間距 */
.stats {
  margin-top: 24px; /* 與標題/公告的距離 */
  margin-bottom: 32px;

  display: flex;
  flex-direction: column; /* 確保由上而下排列 */
  gap: 32px; /* 每個組件之間的垂直距離，你可以改成 40px 或更大 */
}

/* 如果你想讓特定的組件（例如公告）下方也大一點 */
:deep(ClanNotice) {
  margin-bottom: 24px;
}
</style>
