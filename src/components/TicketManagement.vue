<template>
  <div class="order-management-container">
    <h1 class="page-title">交易訂單管理</h1>

    <div class="tabs-container">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: currentTab === tab.id }"
        @click="currentTab = tab.id"
      >
        {{ tab.label }}
        <span class="badge-count">{{ filterOrders(tab.id).length }}</span>
      </button>
    </div>

    <div class="order-list">
      <div v-if="filteredOrders.length === 0" class="empty-state">
        <p>目前此分類沒有任何訂單</p>
      </div>

      <div v-for="order in filteredOrders" :key="order.ticketCode" class="order-card">
        <div class="card-header">
          <div class="title-group">
            <span class="ticket-code">#{{ order.ticketCode }}</span>
            <h3 class="item-name">{{ order.itemName }}</h3>
          </div>
          <span class="status-badge" :class="getStatusClass(order.status)">
            {{ getStatusLabel(order.status) }}
          </span>
        </div>

        <p class="description">{{ order.description }}</p>

        <div class="card-footer">
          <div class="price-info">
            <span class="price-label">交易金額</span>
            <span class="price-amount">{{ order.amount }} {{ order.currency }}</span>
          </div>

          <div class="action-buttons">
            <button class="btn btn-outline" @click="viewDetail(order)">詳情</button>
            <button v-if="order.status === OrderStatus.WAIT_PAYMENT" class="btn btn-primary">
              立即付款
            </button>
            <button v-if="order.status === OrderStatus.COMPLETED_TRADING" class="btn btn-success">
              確認領取
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 狀態對應 (對應 DB 的 NUMBER)
enum OrderStatus {
  WAIT_PAYMENT = 10,
  PENDING = 20,
  COMPLETED_TRADING = 30,
  SELL_COMPLETED = 40,
}

interface MarketOrder {
  ticketCode: string
  itemName: string
  description: string
  amount: number
  currency: string
  status: OrderStatus
  ticketOwnerId: number
  buyerId: number
  createdAt: string
}

// 頁籤定義
const tabs = [
  { id: 'all', label: '進行中訂單' },
  { id: 'payment', label: '待付款' },
  { id: 'transfer', label: '待移交' },
  { id: 'done', label: '已完成' },
]

const currentTab = ref('all')

// 假資料 (結合你的 GameShare 與後端欄位情境)
const orders = ref<MarketOrder[]>([
  {
    ticketCode: 'TKT-20260326-001',
    itemName: '神級附魔石 x 10',
    description: '公會副本掉落，保證正貨，急售換現。',
    amount: 500,
    currency: 'GOLD',
    status: OrderStatus.WAIT_PAYMENT,
    ticketOwnerId: 1001,
    buyerId: 9999,
    createdAt: '2026-03-26T10:14:09Z',
  },
  {
    ticketCode: 'TKT-20260326-002',
    itemName: '稀有紅裝：火龍長劍',
    description: '強化 +12，已綁定公會，僅限內部交易。',
    amount: 12000,
    currency: 'DIAMOND',
    status: OrderStatus.COMPLETED_TRADING,
    ticketOwnerId: 1002,
    buyerId: 9999,
    createdAt: '2026-03-26T12:00:00Z',
  },
  {
    ticketCode: 'TKT-20260325-099',
    itemName: '新手藥水組',
    description: '包含 99 個大紅水。',
    amount: 10,
    currency: 'GOLD',
    status: OrderStatus.SELL_COMPLETED,
    ticketOwnerId: 1003,
    buyerId: 9999,
    createdAt: '2026-03-25T15:30:00Z',
  },
  {
    ticketCode: 'TKT-20260326-004',
    itemName: '高階素材包',
    description: '買家已付款，等待賣家移交道具中。',
    amount: 800,
    currency: 'SILVER',
    status: OrderStatus.PENDING,
    ticketOwnerId: 1004,
    buyerId: 9999,
    createdAt: '2026-03-26T16:00:00Z',
  },
])

// 根據頁籤過濾資料
const filterOrders = (tabId: string) => {
  if (tabId === 'all') {
    return orders.value.filter((o) => o.status !== OrderStatus.SELL_COMPLETED)
  }
  if (tabId === 'payment') return orders.value.filter((o) => o.status === OrderStatus.WAIT_PAYMENT)
  if (tabId === 'transfer')
    return orders.value.filter(
      (o) => o.status === OrderStatus.COMPLETED_TRADING || o.status === OrderStatus.PENDING,
    )
  if (tabId === 'done') return orders.value.filter((o) => o.status === OrderStatus.SELL_COMPLETED)
  return []
}

const filteredOrders = computed(() => filterOrders(currentTab.value))

// 狀態標籤樣式 (對應 CSS class)
const getStatusClass = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.WAIT_PAYMENT:
      return 'status-warning'
    case OrderStatus.PENDING:
      return 'status-info'
    case OrderStatus.COMPLETED_TRADING:
      return 'status-primary'
    case OrderStatus.SELL_COMPLETED:
      return 'status-success'
    default:
      return 'status-default'
  }
}

const getStatusLabel = (status: OrderStatus) => {
  const labels: Record<number, string> = {
    [OrderStatus.WAIT_PAYMENT]: '待付款',
    [OrderStatus.PENDING]: '待移交',
    [OrderStatus.COMPLETED_TRADING]: '待領取',
    [OrderStatus.SELL_COMPLETED]: '已完成',
  }
  return labels[status] || '未知狀態'
}

const viewDetail = (order: MarketOrder) => {
  alert(`查看訂單詳情：${order.ticketCode}`)
}
</script>

<style scoped>
/* 全局容器設定：深色背景 */
.order-management-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #e0e0e0;
  background-color: #121212; /* 深邃黑 */
  min-height: 100vh;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  color: #ffffff;
}

/* 頁籤區塊：深灰底色 */
.tabs-container {
  display: flex;
  background-color: #18181b; /* 更深的底座 */
  padding: 6px;
  border-radius: 10px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
  margin-bottom: 24px;
  gap: 4px;
  border: 1px solid #27272a;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #71717a;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.tab-btn:hover {
  background-color: #27272a;
  color: #a1a1aa;
}

.tab-btn.active {
  background: linear-gradient(145deg, #3f3f46, #27272a);
  color: #f4f4f5;
  border: 1px solid #52525b;
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.badge-count {
  margin-left: 8px;
  background-color: #09090b;
  color: #71717a;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid #27272a;
}

.tab-btn.active .badge-count {
  background-color: #18181b;
  color: #d4d4d8;
  border-color: #3f3f46;
}

/* 訂單列表與卡片 */
.order-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #666666;
  font-size: 16px;
  background: #1e1e1e;
  border-radius: 12px;
  border: 1px dashed #333333;
}

.order-card {
  background-color: #1e1e1e;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border: 1px solid #2a2a2a;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.order-card:hover {
  transform: translateY(-2px);
  border-color: #444444;
}

/* 卡片頭部：標題與狀態 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.ticket-code {
  font-size: 12px;
  color: #666666;
  font-family: monospace;
  display: block;
  margin-bottom: 4px;
}

.item-name {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
}

/* 狀態標籤顏色 (暗黑版螢光色系) */
.status-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

/* 說明文字 */
.description {
  color: #aaaaaa;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 20px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 卡片底部：金額與按鈕 */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #2a2a2a;
}

.price-info {
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: 12px;
  color: #888888;
  margin-bottom: 2px;
}

.price-amount {
  font-size: 20px;
  font-weight: 800;
  color: #ff9800; /* 遊戲常見的橘金色系 */
}

/* 按鈕樣式 */
.action-buttons {
  display: flex;
  gap: 10px;
}
.btn {
  padding: 8px 16px;
  border-radius: 6px; /* 稍微硬挺一點的圓角 */
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  width: 120px;
  transition: all 0.2s ease;
  border: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); /* 文字加上陰影增加立體感 */
}

/* 詳情按鈕：暗色石板 */
.btn-outline {
  background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
  color: #a1a1aa;
  border: 1px solid #3f3f46;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.btn-outline:hover {
  background: linear-gradient(145deg, #3f3f46, #2a2a2a);
  color: #e4e4e7;
  border-color: #52525b;
}

/* 立即付款：低調鍛造鐵/槍灰，帶微弱冷光 */
.btn-primary {
  background: linear-gradient(145deg, #3b4252, #2e3440);
  color: #d8dee9;
  border: 1px solid #4c566a;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.5);
}

.btn-primary:hover {
  background: linear-gradient(145deg, #434c5e, #3b4252);
  color: #eceff4;
  border-color: #5e81ac; /* hover 邊框透出微微冷藍光 */
}

/* 確認領取：低調墨綠色/暗翡翠 */
.btn-success {
  background: linear-gradient(145deg, #1b3325, #0f1c14);
  color: #8fbc8f;
  border: 1px solid #2d5a40;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 2px 4px rgba(0, 0, 0, 0.5);
}

.btn-success:hover {
  background: linear-gradient(145deg, #234331, #15261b);
  color: #a3d9a5;
  border-color: #3e7a57;
}
</style>
