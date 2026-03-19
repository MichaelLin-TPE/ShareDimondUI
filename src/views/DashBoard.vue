<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import ClanNotice from '@/components/ClanNotice.vue' // 引入新組件
import { useAuthStore } from '@/stores/auth.ts'
import BiddingManagement from '@/components/BiddingManagement.vue'
import { onMounted, ref } from 'vue'
import type { Balance } from '@/types/balance.ts'
import Stomp from 'stompjs'
import SockJS from 'sockjs-client'
import { useBalanceStore } from '@/stores/balanceTool.ts'
const socket = new SockJS('https://api.gameshare-system.com/ws-gs')
const stompClient = Stomp.over(socket)

const memberBalance = ref<Balance[]>([])
const clanBalance = ref<Balance[]>([])
const authStore = useAuthStore()
const balance = useBalanceStore()

stompClient.connect({}, (frame) => {
  console.log('Connected : ' + frame)
  stompClient.subscribe('/topic/balance/' + authStore?.member?.clanId, () => {
    console.log("收到更新balance")
    getBalance()
  })
})

const getBalance = async () => {
  if (!authStore.authToken) {
    return
  }
  try {
    const res = await fetch('https://api.gameshare-system.com/getBalance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return
    const data = await res.json()
    memberBalance.value = data.memberBalanceResponseList
    clanBalance.value = data.clanBalanceResponseList
    balance.setBalanceList(data.memberBalanceResponseList)
    balance.setClanBalanceList(data.clanBalanceResponseList)
  } catch (e) {
    console.log(e)
  }
}

onMounted(getBalance)
</script>

<template>
  <div class="dashboard">
    <h1 v-if="authStore.member">{{ authStore.member.clanName }} 血盟大廳</h1>

    <ClanNotice />

    <div class="balance-dashboard-compact">
      <div class="balance-row personal">
        <div class="row-header">
          <div class="icon-wrapper">👤</div>
          <h3 class="row-title">我的帳戶</h3>
        </div>
        <div class="balance-items-wrapper">
          <div v-for="item in memberBalance" :key="item.currency" class="balance-item-compact">
            <span class="currency-label">{{ item.currency }}</span>
            <span class="amount-value gold">{{ item.balance.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <div class="balance-row clan">
        <div class="row-header">
          <div class="icon-wrapper gold">🏰</div>
          <h3 class="row-title">血盟金庫</h3>
        </div>
        <div class="balance-items-wrapper">
          <div v-for="item in clanBalance" :key="item.currency" class="balance-item-compact">
            <span class="currency-label">{{ item.currency }}</span>
            <span class="amount-value gold">{{ item.balance.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="stats">
      <TreasureCard class="treasureCard" />
      <StatCard />
      <BiddingManagement class="biddingManagement" />
    </div>
  </div>
</template>

<style scoped>

h1{
margin-top: 5px;
  margin-bottom: 15px;
}

.dashboard {
  /* 修改這裡：原本是 24px，現在左邊多加 40px 給按鈕（共 64px） */
  padding: 24px 24px 24px 80px;
  color: #fff;
  transition: padding-left 0.4s ease; /* 增加平滑感 */
}

/* 這裡是關鍵：控制所有組件的上下間距 */
.stats {
  margin-bottom: 32px;

  display: flex;
  flex-direction: column; /* 確保由上而下排列 */
  gap: 32px; /* 每個組件之間的垂直距離，你可以改成 40px 或更大 */
}

/* 如果你想讓特定的組件（例如公告）下方也大一點 */
:deep(ClanNotice) {
  margin-bottom: 24px;
}

/* --- 精緻版餘額儀表板 CSS --- */
.balance-dashboard-compact {
  display: flex;
  gap: 16px; /* 縮小間距 */
  width: 100%;
}

.balance-row {
  flex: 1;
  display: flex;
  align-items: center; /* 垂直居中 */
  background: rgba(17, 19, 28, 0.8); /* 深色半透明背景 */
  backdrop-filter: blur(8px); /* 玻璃擬態模糊 */
  border: 1px solid rgba(255, 255, 255, 0.03); /* 極淡邊框 */
  border-radius: 12px; /* 圓角調整 */
  padding: 12px 20px; /* 縮減上下內邊距 */
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); /* 較輕的陰影 */
}

/* Hover 時的精緻發光 */
.balance-row:hover {
  border-color: rgba(99, 102, 241, 0.2);
  background: rgba(17, 19, 28, 0.95);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
}

.balance-row.clan:hover {
  border-color: rgba(245, 196, 81, 0.2);
  box-shadow: 0 6px 20px rgba(245, 196, 81, 0.08);
}

/* 列頭部排版 */
.row-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 130px; /* 固定標題區寬度，確保對齊 */
  flex-shrink: 0;
}

.icon-wrapper {
  font-size: 1.2rem; /* 圖示小一點 */
  color: #6366f1;
}

.icon-wrapper.gold {
  color: #f5c451;
}

.row-title {
  font-size: 0.9rem; /* 標題小一點 */
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
  letter-spacing: 0.5px;
}

/* 餘額項目容器 */
.balance-items-wrapper {
  flex: 1;
  display: flex;
  justify-content: flex-end; /* 項目靠右對齊 */
  gap: 24px; /* 元寶與天幣之間的間距 */
}

.balance-item-compact {
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* 數字靠右對齊 */
  gap: 2px;
}

.currency-label {
  font-size: 0.7rem; /* 幣別標籤小一點 */
  color: #94a3b8;
  font-weight: 500;
}

.amount-value {
  font-size: 1.15rem; /* 數字大小適中 */
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.5px;
}

/* 金色數字與文字 */
.amount-value.gold {
  color: #f5c451;
}

/* 手機版適應：改為上下排列 */
@media (max-width: 768px) {
  .balance-dashboard-compact {
    flex-direction: column;
    gap: 10px;
  }

  .balance-row {
    padding: 10px 16px;
  }

  .row-header {
    width: 100px;
  }
}

/* 手機版適應 */
@media (max-width: 768px) {
  .balance-dashboard {
    flex-direction: column;
    gap: 16px;
  }
}

/* 手機版適應 */
@media (max-width: 768px) {
  .balance-section {
    flex-direction: column;
  }
}
</style>
