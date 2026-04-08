<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useBalanceStore } from '@/stores/balanceTool.ts'
// 記得引入你的 authStore 來拿 Token
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

interface MarketCurrency {
  currency: string
  amount: string
}

interface MarketItem {
  itemName: string
  unit: string
  seller: string
  description: string
  currencyList: MarketCurrency[]
  userName: string
  ticketCode: string
}

const authStore = useAuthStore()
const balance = useBalanceStore()

const isDialogOpen = ref(false)
const marketList = ref<MarketItem[]>([])

const inputAmounts = ref<Record<string, number>>({})

const newOrder = ref({
  itemName: '',
  description: '',
})

// 💡 記錄當前正在編輯的單號。如果是 null，代表是「新增掛單」
const editingTicketCode = ref<string | null>(null)

// =========================================
//  API 串接區塊
// =========================================

const fetchMarketList = async () => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/getMarketSellingItem', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })

    if (res.ok) {
      const data = await res.json()
      marketList.value = data
    } else {
      console.error('取得掛賣列表失敗，狀態碼:', res.status)
    }
  } catch (error) {
    console.error('API 請求發生錯誤:', error)
  }
}

onMounted(() => {
  fetchMarketList()
})

// =========================================
//  輔助工具與按鈕事件
// =========================================

const formatAmount = (amountStr: string) => {
  if (!amountStr) return '0'
  const num = Number(amountStr)
  if (isNaN(num)) return amountStr
  return new Intl.NumberFormat('zh-TW').format(num)
}

// 💡 點擊「+ 我要開單」時觸發，確保清空狀態
const openCreateDialog = () => {
  editingTicketCode.value = null
  newOrder.value.itemName = ''
  newOrder.value.description = ''
  inputAmounts.value = {}
  isDialogOpen.value = true
}

// 送出掛單 (自動判斷 新增 / 編輯)
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
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
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

      await fetchMarketList()
    } else {
      useAlert.error(data.message || '發布失敗，請稍後再試')
    }
  } catch (error) {
    const err = error as Error // 強制斷言為 Error 型別
    useAlert.error(`發布掛單發生錯誤: ${err}`)
    alert('系統連線異常，請檢查網路狀態')
  }
}

// =========================================
//  商品操作與詳情狀態
// =========================================
const isDetailDialogOpen = ref(false)
const selectedItem = ref<MarketItem | null>(null)

const currentUserName = computed(() => authStore.member?.userName)

const viewDetails = (item: MarketItem) => {
  selectedItem.value = item
  isDetailDialogOpen.value = true
}

const buyItem = async () => {
  if (!selectedItem.value) return

  const confirmBuy = confirm(`確定要購買 ${selectedItem.value.itemName} 嗎？`)
  if (!confirmBuy) return

  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/buyMarketTicket', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
      body: JSON.stringify({
        ticketCode: selectedItem.value.ticketCode,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      isDetailDialogOpen.value = false
    } else {
      useAlert.success(data.message)
      isDetailDialogOpen.value = false
      await fetchMarketList()
    }
  } catch (error) {
    alert(`購買失敗，請稍後再試 ${error}`)
  }
}

// 💡 點擊「✏️ 編輯」時觸發
const editOrder = (item: MarketItem) => {
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

const cancelOrder = async (item: MarketItem) => {
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
    const res = await fetch('https://api.gameshare-system.com/deleteMarketTicket', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
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
    await fetchMarketList()
  } catch (e) {
    console.log(e)
  }
}
</script>

<template>
  <div class="market-container">
    <header class="header">
      <div class="header-content">
        <div>
          <h2 class="title">💰 個人掛賣區</h2>
          <p class="subtitle">瀏覽其他玩家的掛賣資訊</p>
        </div>
        <button @click="openCreateDialog" class="btn-main-action">+ 我要開單</button>
      </div>
    </header>

    <section class="list-section">
      <div class="list-header">
        <span class="col-item">道具資訊</span>
        <span class="col-price">售價</span>
        <span class="col-seller">賣家</span>
        <span class="col-action">操作</span>
      </div>

      <div class="order-list">
        <div v-if="marketList.length === 0" class="empty-state">目前沒有掛賣中的商品</div>

        <div v-else v-for="item in marketList" :key="item.ticketCode" class="order-item">
          <div class="col-item">
            <div class="item-name">📦 {{ item.itemName }}</div>
            <div v-if="item.description" class="item-desc">
              {{ item.description }}
            </div>
          </div>

          <div class="col-price currency-stack">
            <div v-for="(curr, index) in item.currencyList" :key="index" class="currency-tag">
              <span class="price-value">{{ formatAmount(curr.amount) }}</span>
              <span class="price-unit">{{ curr.currency }}</span>
            </div>
          </div>

          <div class="col-seller">
            <span class="seller-badge">👤 {{ item.userName }}</span>
          </div>

          <div class="col-action action-group">
            <button class="btn-secondary" @click="viewDetails(item)">查看詳情</button>

            <!--            <template v-if="item.userName === currentUserName">-->
            <!--              <button class="btn-edit-sm" @click="editOrder(item)">✏️ 編輯</button>-->
            <!--              <button class="btn-danger-sm" @click="cancelOrder(item)">🗑️ 撤銷</button>-->
            <!--            </template>-->
          </div>
        </div>
      </div>
    </section>

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

    <transition name="dialog-fade">
      <div
        v-if="isDetailDialogOpen && selectedItem"
        class="dialog-mask"
        @click.self="isDetailDialogOpen = false"
      >
        <div class="dialog-window detail-window">
          <div class="dialog-header">
            <div>
              <h3 class="detail-title">📦 {{ selectedItem.itemName }}</h3>
            </div>
            <button class="close-x" @click="isDetailDialogOpen = false">✕</button>
          </div>

          <div class="dialog-body">
            <div class="info-card">
              <span class="info-label">賣家</span>
              <div class="seller-info">
                <span class="avatar-circle">👤</span>
                <span class="seller-name">{{ selectedItem.userName }}</span>
              </div>
            </div>

            <div class="info-card price-card">
              <span class="info-label">商品售價</span>
              <div class="detail-price-list">
                <div
                  v-for="(curr, index) in selectedItem.currencyList"
                  :key="index"
                  class="detail-currency-tag"
                >
                  <span class="detail-price-value">{{ formatAmount(curr.amount) }}</span>
                  <span class="detail-price-unit">{{ curr.currency }}</span>
                </div>
              </div>
            </div>

            <div class="info-card">
              <span class="info-label">商品描述</span>
              <div class="desc-content">
                {{ selectedItem.description || '該賣家沒有留下任何描述。' }}
              </div>
            </div>
          </div>

          <div class="dialog-footer balanced-footer">
            <button class="btn-cancel" @click="isDetailDialogOpen = false">關閉</button>
            <button
              v-if="selectedItem.userName !== currentUserName"
              class="btn-buy"
              @click="buyItem"
            >
              💰 立即購買
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ================== 主視圖 ================== */
.market-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  color: #e2e8f0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  border: 1px solid #334155;
}

.title {
  color: #f8fafc;
  margin: 0;
}

.subtitle {
  color: #94a3b8;
  margin-top: 5px;
  font-size: 14px;
}

.btn-main-action {
  background: #2563eb;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-main-action:hover {
  background: #3b82f6;
}

/* ================== 列表排版核心 ================== */
.list-header,
.order-item {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  justify-items: center;
}

.list-header {
  padding: 0 1.2rem 10px 1.2rem;
  color: #94a3b8;
  font-weight: bold;
  font-size: 0.95rem;
  border-bottom: 2px solid transparent;
  width: 100%;
}

.order-item {
  background: #1e293b;
  margin-bottom: 10px;
  padding: 1.2rem;
  border-radius: 10px;
  border: 1px solid #334155;
  width: 100%;
  transition: background 0.2s;
}

.order-item:hover {
  background: #253347;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  background: #1e293b;
  border-radius: 10px;
  border: 1px dashed #334155;
}

/* 欄位內容對齊 */
.col-item,
.col-price,
.col-seller,
.col-action {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 100%;
}

.col-item {
  flex-direction: column;
}

.item-name {
  font-weight: bold;
  color: #f8fafc;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  color: #94a3b8;
  max-width: 90%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.currency-stack {
  flex-direction: column;
  gap: 6px;
}

.currency-tag {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.price-value {
  color: #fbbf24;
  font-weight: bold;
}

.price-unit {
  color: #d97706;
  font-size: 12px;
}

/* 💡 主頁列表專屬操作按鈕區 (垂直排列，保持整齊) */
.action-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100px;
}

.action-group button {
  width: 100%;
  padding: 6px 0;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: #334155;
  color: #e2e8f0;
}
.btn-secondary:hover {
  background: #475569;
}

.btn-edit-sm {
  background: #475569;
  color: white;
}
.btn-edit-sm:hover {
  background: #64748b;
}

.btn-danger-sm {
  background: #ef4444;
  color: white;
}
.btn-danger-sm:hover {
  background: #dc2626;
}

/* ================== Dialog 彈窗 ================== */
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

.btn-buy {
  background: #f59e0b;
  color: #fff;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
.btn-buy:hover {
  background: #fbbf24;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

/* ================== 商品詳情卡片 ================== */
.detail-window {
  max-width: 500px;
}
.detail-title {
  margin: 0;
  color: #f8fafc;
  font-size: 20px;
}

.info-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.price-card {
  border-color: rgba(251, 191, 36, 0.3);
  background: linear-gradient(180deg, #0f172a 0%, #16202e 100%);
}

.info-label {
  font-size: 13px;
  color: #94a3b8;
  font-weight: bold;
}
.seller-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-circle {
  background: #1e293b;
  padding: 8px;
  border-radius: 50%;
  font-size: 16px;
}
.seller-name {
  color: #e2e8f0;
  font-size: 16px;
  font-weight: bold;
}
.desc-content {
  color: #cbd5e1;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.detail-price-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.detail-currency-tag {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(251, 191, 36, 0.1);
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(251, 191, 36, 0.4);
}
.detail-price-value {
  color: #fbbf24;
  font-size: 18px;
  font-weight: bold;
}
.detail-price-unit {
  color: #d97706;
  font-size: 14px;
  font-weight: bold;
}

/* 動畫 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.2s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
