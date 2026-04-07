<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { generateSignature } from '@/utils/SignTools.ts'
const authStore = useAuthStore()
// 狀態對應 (對應 DB 的 NUMBER)
enum OrderStatus {
  WAIT_PAYMENT = 'WAIT_PAYMENT',
  WAIT_TRADING = 'WAIT_TRADING',
  SELL_COMPLETED = 'SELL_COMPLETED',
  SELLING = 'SELLING',
}
const balance = useBalanceStore()

interface MarketCurrency {
  currency: string
  amount: string
}

interface MarketOrder {
  ticketCode: string
  itemName: string
  description: string
  userName: string
  status: OrderStatus
  ticketOwner: boolean
  currencyList: MarketCurrency[]
}

onMounted(() => {
  getPersonalLog()
})

const submitOrder = async () => {
  if (!newOrder.value.itemName) {
    alert('請填寫道具名稱')
    return
  }

  const selectedCurrencies: MarketCurrency[] = Object.entries(inputAmounts.value)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, amount]) => amount !== undefined && amount !== null && amount > 0)
    .map(([currency, amount]) => ({
      currency: currency,
      amount: amount.toString(),
    }))

  if (selectedCurrencies.length === 0) {
    alert('請至少設定一種幣別的價格')
    return
  }

  const isEdit = editingTicketCode.value !== null

  // 組裝 Payload
  const requestPayload: any = {
    itemName: newOrder.value.itemName,
    description: newOrder.value.description,
    currencyList: selectedCurrencies,
  }

  // 如果是編輯，要多傳 ticketCode 給後端
  if (isEdit) {
    requestPayload.ticketCode = editingTicketCode.value
  }

  // 根據狀態決定打哪一支 API
  const apiUrl = isEdit
    ? 'https://api.gameshare-system.com/updateMarketTicket'
    : 'https://api.gameshare-system.com/createMarketTicketed'

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString()
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimestamp),
        Timestamp:currentTimestamp,
      },
      body: JSON.stringify(requestPayload),
    })

    const data = await res.json()

    if (res.ok) {
      useAlert.success(isEdit ? '編輯成功！' : data.message)

      // 清空表單與狀態
      newOrder.value.itemName = ''
      newOrder.value.description = ''
      inputAmounts.value = {}
      editingTicketCode.value = null
      isDialogOpen.value = false

      await getPersonalLog()
    } else {
      useAlert.error(data.message || '發布失敗，請稍後再試')
    }
  } catch (error) {
    const err = error as Error // 強制斷言為 Error 型別
    useAlert.error(`發布掛單發生錯誤: ${err}`)
    alert('系統連線異常，請檢查網路狀態')
  }
}

const getPersonalLog = async () => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/getMarketSellingItem', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('API 請求失敗狀態碼:', res.status)
      return
    }
    orders.value = data
  } catch (e) {
    console.error('獲取個人歷史紀錄失敗:', e)
  }
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
const orders = ref<MarketOrder[]>([])

// 根據頁籤過濾資料
const filterOrders = (tabId: string) => {
  if (tabId === 'all') {
    return orders.value
  }
  if (tabId === 'payment') return orders.value.filter((o) => o.status === OrderStatus.WAIT_PAYMENT)
  if (tabId === 'transfer') return orders.value.filter((o) => o.status === OrderStatus.WAIT_TRADING)
  if (tabId === 'done') return orders.value.filter((o) => o.status === OrderStatus.SELL_COMPLETED)
  return []
}
const newOrder = ref({
  itemName: '',
  description: '',
})
const cancelOrder = async (item: MarketOrder) => {
  const result = await useAlert.confirm(
    `確定要撤銷掛單 ${item.itemName} 嗎？\n撤銷後商品將從市場下架。`,
  )
  if (result.isConfirmed) {
    deleteTicket(item.ticketCode)
  }
}
const deleteTicket = async (code: string) => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/deleteMarketTicket', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
      body: JSON.stringify({
        ticketCode: code,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      return
    }
    useAlert.success(data.message)
    await getPersonalLog()
  } catch (e) {
    console.log(e)
  }
}
const editingTicketCode = ref<string | null>(null)
const inputAmounts = ref<Record<string, number>>({})
const isDialogOpen = ref(false)
const editOrder = (item: MarketOrder) => {
  // 1. 記錄正在編輯的單號
  editingTicketCode.value = item.ticketCode

  // 2. 把原本的資料塞進表單
  newOrder.value.itemName = item.itemName
  newOrder.value.description = item.description || ''

  // 3. 把原本的幣別陣列，轉回輸入框用的物件格式
  inputAmounts.value = {}
  item.currencyList.forEach((c) => {
    inputAmounts.value[c.currency] = Number(c.amount)
  })

  // 4. 打開共用彈窗
  isDialogOpen.value = true
}
const filteredOrders = computed(() => filterOrders(currentTab.value))

// 狀態標籤樣式 (對應 CSS class)
const getStatusClass = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.WAIT_PAYMENT:
      return 'status-warning'
    case OrderStatus.WAIT_TRADING:
      return 'status-info'
    case OrderStatus.SELL_COMPLETED:
      return 'status-success'
    default:
      return 'status-default'
  }
}

const getStatusLabel = (status: OrderStatus) => {
  const labels: Record<string, string> = {
    [OrderStatus.WAIT_PAYMENT]: '待付款',
    [OrderStatus.WAIT_TRADING]: '待移交',
    [OrderStatus.SELL_COMPLETED]: '已完成',
    [OrderStatus.SELLING]: '掛單中',
  }
  return labels[status] || '未知狀態'
}

const viewDetail = (order: MarketOrder) => {
  alert(`查看訂單詳情：${order.ticketCode}`)
}
</script>

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
            <div class="currency-list">
              <span
                v-for="(currencyItem, index) in order.currencyList"
                :key="index"
                class="price-amount"
              >
                {{ currencyItem.amount }} {{ currencyItem.currency }}
              </span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn btn-outline" @click="viewDetail(order)">詳情</button>
            <template v-if="order.userName == authStore.member?.userName">
              <button class="btn btn-outline" @click="editOrder(order)">✏️ 編輯</button>
              <button class="btn btn-outline" @click="cancelOrder(order)">🗑️ 撤銷</button>
            </template>
            <button v-if="order.status === OrderStatus.WAIT_PAYMENT" class="btn btn-primary">
              立即付款
            </button>
            <button v-if="order.status === OrderStatus.WAIT_TRADING" class="btn btn-success">
              確認領取
            </button>
          </div>
        </div>
      </div>
    </div>
    <transition name="dialog-fade">
      <div v-if="isDialogOpen" class="dialog-mask" @click.self="isDialogOpen = false">
        <div class="dialog-window">
          <div class="dialog-header">
            <div>
              <h3>{{ editingTicketCode ? '✏️ 編輯掛單' : '建立掛單' }}</h3>
              <p>{{ editingTicketCode ? '修改您的商品資訊與金額' : '填寫道具資訊後即可發布' }}</p>
            </div>
            <button class="close-x" @click="isDialogOpen = false">✕</button>
          </div>

          <div class="dialog-body">
            <div class="form-group">
              <label>道具名稱</label>
              <input v-model="newOrder.itemName" placeholder="例如：龍之鑽石" />
            </div>

            <div class="form-group">
              <label>價格設定</label>
              <div class="currency-inputs-wrapper">
                <div
                  v-for="item in balance.clanBalanceList"
                  :key="item.currency"
                  class="currency-input-row"
                >
                  <div class="currency-prefix">{{ item.currency }}</div>
                  <input
                    v-model.number="inputAmounts[item.currency]"
                    type="number"
                    min="0"
                    placeholder="請輸入金額 (選填)"
                    class="currency-input"
                  />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>商品描述 (選填)</label>
              <textarea
                v-model="newOrder.description"
                placeholder="請簡單描述商品狀態或交易備註..."
                rows="3"
              ></textarea>
            </div>
          </div>

          <div class="dialog-footer balanced-footer">
            <button class="btn-cancel" @click="isDialogOpen = false">取消</button>
            <button class="btn-confirm" @click="submitOrder">
              {{ editingTicketCode ? '儲存修改' : '發布掛單' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

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

/* 新增：包裝多種幣別的容器 */
.currency-list {
  display: flex;
  flex-direction: column; /* 讓多個幣別垂直排列，若想水平排列可改為 row */
  gap: 4px;
  margin-top: 4px;
}
/* 原有的 price-amount 樣式保持不變，或可依需求微調 */
.price-amount {
  font-size: 20px;
  font-weight: 800;
  color: #ff9800;
}

.dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.dialog-window {
  background: #1e293b;
  width: 92%;
  max-width: 460px;
  border-radius: 14px;
  border: 1px solid #334155;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.dialog-header {
  padding: 18px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  color: #f1f5f9;
}
.dialog-header p {
  margin-top: 4px;
  font-size: 13px;
  color: #94a3b8;
}

.close-x {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 22px;
  cursor: pointer;
}

.dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-size: 13px;
  color: #94a3b8;
}

.form-group input,
.form-group textarea {
  background: #0f172a;
  border: 1px solid #334155;
  padding: 10px 12px;
  border-radius: 8px;
  color: white;
  outline: none;
  transition: border 0.2s;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}
.form-group input:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.currency-inputs-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.currency-input-row {
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.currency-input-row:focus-within {
  border-color: #3b82f6;
}

.currency-prefix {
  padding: 10px 14px;
  background: #16202e;
  color: #94a3b8;
  font-size: 13px;
  font-weight: bold;
  border-right: 1px solid #334155;
  min-width: 50px;
  text-align: center;
}

.currency-input {
  flex-grow: 1;
  border: none !important;
  background: transparent !important;
  border-radius: 0 !important;
}

/* 💡 彈窗底部等寬分配容器 */
.balanced-footer {
  padding: 16px 20px;
  background: #16202e;
  display: flex;
  gap: 12px;
}

/* 讓裡面的所有按鈕平分寬度 */
.balanced-footer button {
  flex: 1;
  padding: 10px 0;
  font-size: 15px;
  font-weight: bold;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

/* 各別按鈕顏色 */
.btn-cancel {
  background: transparent;
  border: 1px solid #475569 !important;
  color: #94a3b8;
}
.btn-cancel:hover {
  background: #1e293b;
  color: #f8fafc;
}

.btn-confirm {
  background: #2563eb;
  color: white;
}
.btn-confirm:hover {
  background: #3b82f6;
}
</style>
