<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useRouter } from 'vue-router'
const router = useRouter()
const menu = [
  { label: '🏰 血盟大廳' },
  { label: '🏰 分寶大廳' },
  { label: '💎 進行中的分寶' },
  { label: '📜 歷史分寶' },
  { label: '💰 公會基金' },
  { label: '👥 成員與權限' },
]
const authStore = useAuthStore()
const loading = ref(false)
const balance = ref(0)
const clanBalance = ref(0)

const formatNumber = (val: number | string | null) => {
  if (val === null || val === undefined) return '0'
  // 確保轉成數字後再格式化
  return Number(val).toLocaleString()
}

onMounted(async () => {
  loading.value = true
  if (!authStore.authToken) {
    handleInvalidToken()
    return
  }
  try {
    const res = await fetch('http://138.2.9.163:8080/getBalance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      balance.value = 0
      clanBalance.value = 0
      return
    }
    const data = await res.json()
    balance.value = data.balance
    clanBalance.value = data.clanBalance
  } catch (e) {
    balance.value = 0
    clanBalance.value = 0
  } finally {
    loading.value = false
  }
})

const handleInvalidToken = () => {
  alert('憑證過期,請重新發送驗證信!')
  router.replace('/login')
}
</script>

<template>
  <aside class="sidebar">
    <div class="clan">
      <img class="logo" src="/share_diamond_logo.png" />
      <div v-if="authStore.member" class="name">{{ authStore.member.clanName }}</div>
    </div>
    <div class="balance_view">
      <span v-if="loading">讀取中...</span>
      <span v-else class="balance-text">
        個人帳戶 : {{ formatNumber(balance) }} 元寶
        <br />
        血盟帳戶 : {{ formatNumber(clanBalance) }} 元寶
      </span>
    </div>
    <nav>
      <div v-for="item in menu" :key="item.label" class="menu-item">
        {{ item.label }}
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  background: #0e0f13;
  color: #fff;
  height: 100vh;
  padding: 16px;
}

.balance_view {
  font-size: 16px;
  font-weight: 600;
  color: #f5c451; /* 偏金色 */
  padding: 10px 12px;
  background: rgba(245, 196, 81, 0.08);
  border-radius: 8px;
}

.clan {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
}

.name {
  font-size: 18px;
  font-weight: 600;
}

.menu-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.menu-item:hover {
  background: #161822;
}
</style>
