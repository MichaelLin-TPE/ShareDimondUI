<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useRouter } from 'vue-router'
import type { Balance } from '@/types/balance.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const memberBalanceList = ref<Balance[]>([])
const clanBalanceList = ref<Balance[]>([])
const balance = useBalanceStore()
const handleMenuClick = (item) => {
  console.log('你點擊了：', item.label)

  // 這裡可以根據點擊的內容做跳轉或其他操作
  if (item.label === '🏛️ 血盟大廳') {
    // 執行相關邏輯
    router.replace('/clan/dashboard')
  } else if (item.label == '📖 歷史紀錄') {
    router.replace('/clan/treasures')
  } else if (item.label == '💸 轉帳') {
    router.replace('/clan/transfer')
  } else if (item.label == '📤 申請提款') {
    router.replace('/clan/withdraw')
  } else if (item.label == '👑 成員管理') {
    router.replace('/clan/memberRole')
  } else if (item.label == '📤 提款審核') {
    router.replace('/clan/verifyWithdraw')
  }
}

const formatNumber = (val: number | string | null) => {
  if (val === null || val === undefined) return '0'
  // 確保轉成數字後再格式化
  return Number(val).toLocaleString()
}

const logout = async () => {
  try {
    const res = await fetch('https://gameshare-system.com/logout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.message)
      return
    }
    alert('登出成功')
    router.replace('/login')
  } catch (e) {
    console.log(e)
  }
}
const menuList = ref<Menu[]>([])
interface Menu {
  label: string
}

onMounted(async () => {
  try {
    const res = await fetch('https://gameshare-system.com/get-menu', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })
    const data = await res.json()
    menuList.value = data
  } catch (e) {
    console.log(e)
  }
})

onMounted(async () => {
  loading.value = true
  if (!authStore.authToken) {
    handleInvalidToken()
    return
  }
  try {
    const res = await fetch('https://gameshare-system.com/getBalance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      return
    }
    const data = await res.json()
    memberBalanceList.value = data.memberBalanceResponseList
    clanBalanceList.value = data.clanBalanceResponseList
    balance.setBalanceList(data.memberBalanceResponseList)
  } catch (e) {
    console.log(e)
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
      <div v-if="authStore.member" class="name">
        {{ authStore.member.clanName }}
      </div>
      <button class="logout" @click="logout">登出</button>
    </div>
    <div class="balance_view">
      <span v-if="loading">讀取中...</span>
      <div class="balance-text">
        <strong>個人帳戶 :</strong>
        <div v-for="item in memberBalanceList" :key="item.currency">
          {{ item.currency }} : {{ formatNumber(item.balance) }} 元
        </div>
        <strong>血盟共用基金 :</strong>
        <div v-for="item in clanBalanceList" :key="item.currency">
          {{ item.currency }} : {{ formatNumber(item.balance) }} 元
        </div>
      </div>
    </div>
    <nav>
      <div
        v-for="item in menuList"
        :key="item.label"
        class="menu-item"
        @click="handleMenuClick(item)"
      >
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

.logout:hover {
  border-color: #00d4ff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}

.logout:active {
  transform: translateY(1px);
}

.logout {
  width: 40px;
  height: 20px;
  padding: 0; /* 移除可能存在的內距 */
  margin: 0; /* 移除可能的邊距 */

  display: flex; /* 使用 flex 處理內部文字置中 */
  align-items: center;
  justify-content: center;

  line-height: 1; /* 確保文字不會被行高推下去 */
  font-size: 10px;
  box-sizing: border-box;

  /* 你的精美樣式保持不變 */
  border-radius: 8px;
  color: #00d4ff;
  background: linear-gradient(145deg, #12141d, #1a1f2e);
  border: 1px solid rgba(0, 212, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
  cursor: pointer;
  z-index: 10;
}

/* 確保父容器沒有干擾因素 */
.clan {
  display: flex;
  align-items: center; /* 這是垂直置中的關鍵 */
  gap: 12px;
  margin-bottom: 24px;
}

.clan h2,
.clan span {
  /* 如果你左邊是用 h2 或 span */
  margin: 0; /* 移除標題預設的下邊距 */
  display: flex;
  align-items: center;
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
