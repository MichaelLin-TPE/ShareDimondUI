<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import { useAuthStore } from '@/stores/auth.ts'

const authStore = useAuthStore()
</script>

<template>
  <div class="dashboard">
    <h1 v-if="authStore.member">{{ authStore.member.clanName }} 血盟大廳</h1>

    <div class="stats">
      <StatCard />
      <TreasureCard class="treasureCard" />
    </div>
  </div>
</template>

<style scoped>

.treasureCard{
  margin-top: 50px;
}

.dashboard {
  padding: 24px;
  color: #fff;
}

.stats {
  margin-top: 20px;
  gap: 16px;
  margin-bottom: 32px;
}

</style>
