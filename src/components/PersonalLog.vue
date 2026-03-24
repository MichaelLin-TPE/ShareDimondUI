<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'

const authStore = useAuthStore()

// =========================================
//  1. 動態幣別看板 (資料結構與假資料)
// =========================================
interface MemberBalance {
  currencyCode: string
  dividend: number // 累計分紅
  fund: number // 累計公積金
}

const memberBalances = ref<MemberBalance[]>([])

// 【UX 優化】當前選中的幣別，預設選中第一個
const activeCurrency = ref(memberBalances.value[0]?.currencyCode || '')

// 計算當前應該顯示的餘額資料
const activeBalance = computed(() => {
  return (
    memberBalances.value.find((b) => b.currencyCode === activeCurrency.value) ||
    memberBalances.value[0]
  )
})

// =========================================
//  2. 個人歷史紀錄 (API 串接與資料結構)
// =========================================
interface PersonalLog {
  status: string
  eventDescription: string
  createdAt: string
}

const rawLogs = ref<PersonalLog[]>([])

const getPersonalLog = async () => {
  try {
    const res = await fetch('https://api.gameshare-system.com/getPersonalLog', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('API 請求失敗狀態碼:', res.status)
      return
    }
    rawLogs.value = data
  } catch (e) {
    console.error('獲取個人歷史紀錄失敗:', e)
  }
}
const getMemberCumulativeAmount = async () => {
  try {
    const res = await fetch('https://api.gameshare-system.com/getMemberCumulativeAmount', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('API 請求失敗狀態碼:', res.status)
      return
    }
    memberBalances.value = data
    activeCurrency.value = memberBalances.value[0]?.currencyCode || ''
  } catch (e) {
    console.error('獲取個人歷史紀錄失敗:', e)
  }
}

onMounted(() => {
  getPersonalLog()
  getMemberCumulativeAmount()
})

// =========================================
//  3. 狀態篩選與搜尋控制
// =========================================
const searchQuery = ref('')
const selectedStatus = ref('ALL')

const toggleStatus = (status: string) => {
  selectedStatus.value = status
}

const statusConfig: Record<string, { label: string; colorClass: string }> = {
  TRANSFERRED: { label: '轉帳', colorClass: 'color-open' },
  WITHDRAWN: { label: '提領', colorClass: 'color-delete' },
  COMPLETED_SHARED: { label: '一般分紅', colorClass: 'color-share' },
  COMPLETED_SHARED_CLAN: { label: '公會分紅', colorClass: 'color-join' },
  BUY: { label: '購買', colorClass: 'color-create' },
  SELL: { label: '販售', colorClass: 'color-bid' },
  BID: { label: '競標', colorClass: 'color-wait' },
}

const filteredLogs = computed(() => {
  return rawLogs.value.filter((log) => {
    const matchSearch = log.eventDescription.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchSearch
  })
})

// =========================================
//  4. 格式化工具 (時間與動態幣別)
// =========================================
const formatEventTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatAmount = (value: number, currencyCode: string) => {
  const formattedNum = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)
  if (currencyCode.toUpperCase() === 'TWD') {
    return `$ ${formattedNum}`
  }
  return `${formattedNum} ${currencyCode}`
}
</script>

<template>
  <div class="event-container">
    <div class="balances-wrapper">
      <div class="section-header">
        <span class="header-text">帳戶概況</span>
      </div>

      <div class="currency-tabs">
        <button
          v-for="balance in memberBalances"
          :key="balance.currencyCode"
          class="currency-tab"
          :class="{ 'is-active': activeCurrency === balance.currencyCode }"
          @click="activeCurrency = balance.currencyCode"
        >
          {{ balance.currencyCode }}
        </button>
      </div>

      <transition name="fade" mode="out-in">
        <div class="dashboard-grid" :key="activeCurrency" v-if="activeBalance">
          <div class="dashboard-card border-gold">
            <div class="dashboard-title">累計分紅金額</div>
            <div class="dashboard-value text-gold">
              {{ formatAmount(activeBalance.dividend, activeBalance.currencyCode) }}
            </div>
          </div>
          <div class="dashboard-card border-blue">
            <div class="dashboard-title">累計分配公積金</div>
            <div class="dashboard-value text-blue">
              {{ formatAmount(activeBalance.fund, activeBalance.currencyCode) }}
            </div>
          </div>
        </div>
      </transition>
    </div>

    <div class="filter-section">
      <div class="search-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋紀錄內容..."
          class="search-input"
        />
      </div>

      <div class="status-tags">
        <span
          class="status-tag"
          :class="{ 'is-active color-default': selectedStatus === 'ALL' }"
          @click="toggleStatus('ALL')"
          >全部紀錄</span
        >

        <span
          v-for="(config, key) in statusConfig"
          :key="key"
          class="status-tag"
          :class="{ ['is-active ' + config.colorClass]: selectedStatus === key }"
          @click="toggleStatus(String(key))"
        >
          {{ config.label }}
        </span>
      </div>
    </div>

    <div class="event-grid">
      <div v-for="item in filteredLogs" :key="item.createdAt" class="event-card">
        <div class="event-role" :class="statusConfig[item.status]?.colorClass + '-text'">
          {{ statusConfig[item.status]?.label || '未知狀態' }}
        </div>
        <div class="event-content">
          {{ item.eventDescription }}
        </div>
        <div class="event-time">
          {{ formatEventTime(item.createdAt) }}
        </div>
      </div>

      <div v-if="filteredLogs.length === 0" class="no-data">
        <div class="empty-icon">📂</div>
        找不到符合條件的紀錄
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   強制暗黑系基底
========================================= */
.event-container {
  padding: 20px;
  background-color: #0b0d14;
  color: #ffffff;
  min-height: 100%;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

/* =========================================
   UX大升級：幣別切換區塊 (Tab)
========================================= */
.balances-wrapper {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px dashed #2a2d3e;
}

.section-header {
  margin-bottom: 14px;
}

.header-text {
  font-size: 16px;
  color: #ffffff;
  font-weight: bold;
}

.currency-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  overflow-x: auto; /* 若幣別超過畫面可橫向滑動 */
  padding-bottom: 4px; /* 留給捲軸空間 */
}

/* 隱藏捲軸讓畫面更乾淨 */
.currency-tabs::-webkit-scrollbar {
  display: none;
}

.currency-tab {
  padding: 8px 18px;
  border-radius: 20px;
  background: #161822;
  border: 1px solid #2a2d3e;
  color: #8e9db0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.currency-tab:hover {
  background: #1f2233;
  color: #ffffff;
}

/* 該幣別被選中時的高亮樣式 */
.currency-tab.is-active {
  background: rgba(255, 209, 102, 0.15);
  border-color: rgba(255, 209, 102, 0.5);
  color: #ffd166;
  font-weight: bold;
}

/* 切換數字時的淡入淡出動畫 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

/* =========================================
   下方卡片等原始樣式維持不變
========================================= */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.dashboard-card {
  background: linear-gradient(180deg, #1a1c26, #12141d);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.border-gold {
  border-top: 3px solid #ffd166;
}
.border-blue {
  border-top: 3px solid #4a90e2;
}

.dashboard-title {
  font-size: 13px;
  color: #8e9db0;
  margin-bottom: 6px;
}

.dashboard-value {
  font-size: 26px;
  font-weight: bold;
}

.text-gold {
  color: #ffd166;
}
.text-blue {
  color: #4a90e2;
}

.filter-section {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  background: #161822;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: #ffd166;
  box-shadow: 0 0 0 2px rgba(255, 209, 102, 0.15);
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.status-tag {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
  background: #161822;
  color: #8e9db0;
  border: 1px solid #2a2d3e;
  transition: all 0.2s ease;
  user-select: none;
}

.status-tag:hover {
  background: #1f2233;
  color: #ffffff;
}

.status-tag.is-active {
  font-weight: bold;
  border-color: transparent;
}

.is-active.color-default {
  background: #7f8c8d;
  color: #fff;
  box-shadow: 0 4px 10px rgba(127, 140, 141, 0.3);
}
.is-active.color-open {
  background: #4a90e2;
  color: #fff;
  box-shadow: 0 4px 10px rgba(74, 144, 226, 0.3);
}
.is-active.color-delete {
  background: #e74c3c;
  color: #fff;
  box-shadow: 0 4px 10px rgba(231, 76, 60, 0.3);
}
.is-active.color-share {
  background: #2ecc71;
  color: #fff;
  box-shadow: 0 4px 10px rgba(46, 204, 113, 0.3);
}
.is-active.color-join {
  background: #16a085;
  color: #fff;
  box-shadow: 0 4px 10px rgba(22, 160, 133, 0.3);
}
.is-active.color-create {
  background: #34495e;
  color: #fff;
  box-shadow: 0 4px 10px rgba(52, 73, 94, 0.3);
}
.is-active.color-bid {
  background: #f39c12;
  color: #fff;
  box-shadow: 0 4px 10px rgba(243, 156, 18, 0.3);
}
.is-active.color-wait {
  background: #9b59b6;
  color: #fff;
  box-shadow: 0 4px 10px rgba(155, 89, 182, 0.3);
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.event-card {
  background: linear-gradient(180deg, #161822, #0f111a);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
  display: flex;
  flex-direction: column;
}

.event-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  border-color: #32354a;
}

.event-role {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
}

.color-default-text {
  color: #7f8c8d;
}
.color-open-text {
  color: #4a90e2;
}
.color-delete-text {
  color: #e74c3c;
}
.color-share-text {
  color: #2ecc71;
}
.color-join-text {
  color: #16a085;
}
.color-create-text {
  color: #8e9db0;
}
.color-bid-text {
  color: #f39c12;
}
.color-wait-text {
  color: #9b59b6;
}

.event-content {
  font-size: 15px;
  color: #e0e0e0;
  margin-bottom: 12px;
  line-height: 1.5;
  white-space: pre-line;
  flex-grow: 1;
}

.event-time {
  font-size: 12px;
  color: #6c757d;
  text-align: right;
  border-top: 1px solid #1f2233;
  padding-top: 8px;
}

.no-data {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #5a6270;
  font-size: 15px;
  background: #12141d;
  border-radius: 12px;
  border: 1px dashed #2a2d3e;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .event-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .status-tag {
    flex: 1 1 calc(33.33% - 10px);
    text-align: center;
    padding: 8px 4px;
  }
}
</style>
