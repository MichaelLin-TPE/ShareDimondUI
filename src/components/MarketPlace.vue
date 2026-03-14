<script setup lang="ts">
import { ref } from 'vue'

interface MarketItem {
  id: number
  itemName: string
  price: number
  unit: string
  seller: string
  description: string // 新增：商品描述
}

const isDialogOpen = ref(false)

const marketList = ref<MarketItem[]>([
  {
    id: 1,
    itemName: '火之手套',
    price: 1200,
    unit: '鑽石',
    seller: '阿龍',
    description: '打怪掉落，火屬性攻擊+10',
  },
  {
    id: 2,
    itemName: '強化武卷',
    price: 50,
    unit: '鑽石',
    seller: '路人甲',
    description: '便宜賣，不議價',
  },
  {
    id: 3,
    itemName: '受祝福的防卷',
    price: 300,
    unit: '鑽石',
    seller: '神秘商販',
    description: '防具升級必備',
  },
])

const newOrder = ref({
  itemName: '',
  price: null as number | null,
  unit: '鑽石',
  seller: '我本人',
  description: '', // 新增：商品描述的初始值
})

const submitOrder = () => {
  if (!newOrder.value.itemName || newOrder.value.price === null) {
    alert('請填寫完整資訊')
    return
  }

  marketList.value.unshift({
    id: Date.now(),
    itemName: newOrder.value.itemName,
    price: newOrder.value.price,
    unit: newOrder.value.unit,
    seller: newOrder.value.seller,
    description: newOrder.value.description, // 新增：將描述存入列表
  })

  // 清空表單
  newOrder.value.itemName = ''
  newOrder.value.price = null
  newOrder.value.description = '' // 清空描述

  isDialogOpen.value = false
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

        <button @click="isDialogOpen = true" class="btn-main-action">+ 我要開單</button>
      </div>
    </header>

    <section class="list-section">
      <div class="list-header">
        <span class="col-item">道具名稱</span>
        <span class="col-price">價格 / 單位</span>
        <span class="col-seller">賣家</span>
        <span class="col-action">操作</span>
      </div>

      <div class="order-list">
        <div v-for="item in marketList" :key="item.id" class="order-item">
          <div class="item-info col-item">📦 {{ item.itemName }}</div>

          <div class="item-price col-price">
            <span class="price-value">
              {{ item.price.toLocaleString() }}
            </span>
            <span class="price-unit">
              {{ item.unit }}
            </span>
          </div>

          <div class="item-seller col-seller">👤 {{ item.seller }}</div>

          <div class="item-action col-action">
            <button class="btn-secondary">查看詳情</button>
          </div>
        </div>
      </div>
    </section>

    <transition name="dialog-fade">
      <div v-if="isDialogOpen" class="dialog-mask" @click.self="isDialogOpen = false">
        <div class="dialog-window">
          <div class="dialog-header">
            <div>
              <h3>建立掛單</h3>
              <p>填寫道具資訊後即可發布</p>
            </div>

            <button class="close-x" @click="isDialogOpen = false">✕</button>
          </div>

          <div class="dialog-body">
            <div class="form-group">
              <label>道具名稱</label>
              <input v-model="newOrder.itemName" placeholder="例如：龍之鑽石" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>價格</label>
                <input v-model.number="newOrder.price" type="number" placeholder="0" />
              </div>

              <div class="form-group">
                <label>單位</label>
                <select v-model="newOrder.unit">
                  <option>鑽石</option>
                  <option>金幣</option>
                </select>
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

          <div class="dialog-footer">
            <button class="btn-cancel" @click="isDialogOpen = false">取消</button>
            <button class="btn-confirm" @click="submitOrder">發布掛單</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* 主頁 */

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
}

.btn-main-action {
  background: #2563eb;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-main-action:hover {
  background: #3b82f6;
}

/* ================== 列表排版核心 (絕對置中版) ================== */

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
}

.col-item,
.col-price,
.col-seller,
.col-action {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 100%;
  height: 100%;
}

.price-value {
  color: #fbbf24;
  font-weight: bold;
  margin-right: 6px;
}

.btn-secondary {
  background: #334155;
  color: #e2e8f0;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #475569;
}

/* ================== dialog ================== */

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
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  color: #94a3b8;
}

/* 將 textarea 加入共用樣式 */

/* 把 textarea 加進來，讓它吃一樣的暗色背景跟白字 */
.form-group input,
.form-group select,
.form-group textarea {
  background: #0f172a;
  border: 1px solid #334155;
  padding: 10px 12px;
  border-radius: 8px;
  color: white;
  outline: none;
  transition: border 0.2s;
  font-family: inherit;
}

/* 針對 textarea 限制只能往下拖拉，並給一個預設高度 */
.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* 點擊輸入框時的亮藍色邊框，也把 textarea 加上 */
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.dialog-footer {
  padding: 16px 20px;
  background: #16202e;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-confirm {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #475569;
  color: #94a3b8;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
}

/* animation */

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
