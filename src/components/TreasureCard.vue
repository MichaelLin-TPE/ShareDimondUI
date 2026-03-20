<script setup lang="ts">
import { useAuction } from '@/composables/treasureCare.ts'

const {
  auctions,
  formatTime,
  showModal,
  handleSubmit,
  itemName,
  itemOptions,
  bossName,
  bossOptions,
  basePrice,
  remark,
  openTicket,
  handlePeopleCount,
  showPeopleList,
  handleUpdateRemark,
  openAddTreasureDialog,
  handleDeleteItem,
  showAddTreasureDialog,
  addItemName,
  handlePersonClick,
  loading,
  error,
  addTreasure,
  showAddBossDialog,
  handleJoinItem,
  balance,
  formatTimestamp,
  selectedCurrency,
  selectedType,
  addBossName,
  addBoss,
  getJoinList,
  openAddBossDialog,
} = useAuction()
</script>

<template>
  <div class="whole_page">
    <div class="page-header">
      <h3 class="page-title">
        寶物分紅參與 <span>(共 {{ auctions.length }} 件)</span>
      </h3>
      <div class="header-btns">
        <button class="btn-top open" @click="openTicket">我要開單</button>
        <button class="btn-top add" @click="openAddTreasureDialog">新增道具</button>
        <button class="btn-top add" @click="openAddBossDialog">新增首領</button>
      </div>
    </div>

    <div class="auction-container">
      <div class="auction-grid">
        <div v-for="item in auctions" :key="item.treasureCode" class="auction-card">
          <div class="card-tools">
            <button
              class="tool-btn"
              v-show="item.showDeleteTicket"
              @click="handleUpdateRemark(item)"
            >
              備註
            </button>
            <button
              class="tool-btn del"
              v-show="item.showDeleteTicket"
              @click="handleDeleteItem(item)"
            >
              撤單
            </button>
          </div>
          <div class="item-main">
            <div class="item-name gold">{{ item.itemName }}</div>
            <div class="boss-tag">首領：{{ item.bossName }}</div>
          </div>
          <div class="divider"></div>
          <div class="info-body">
            <div class="info-row">
              <span class="label">開單者</span><span class="value">{{ item.ticketOwerName }}</span>
            </div>
            <div class="info-row" v-for="c in item.treasureCurrencyList" :key="c.currency">
              <span class="label">{{ c.currency }}價格</span
              ><span class="value gold">{{ Number(c.amount).toLocaleString() }}</span>
            </div>
            <div class="info-row">
              <span class="label">種類</span><span class="value">{{ item.treasureType }}</span>
            </div>
            <div class="info-row">
              <span class="label">備註</span
              ><span class="value-remark">{{ item.remark || '無' }}</span>
            </div>
          </div>
          <button
            class="join-btn"
            :class="{ joined: item.joinButtonDisable }"
            @click="handleJoinItem(item)"
          >
            {{ item.joinButtonDisable ? '已參與 (撤銷)' : '我有參與 +1' }}
          </button>
          <div class="card-footer" @click="handlePeopleCount(item)">
            <span>⏳ {{ formatTime(item.remainSeconds) }}</span>
            <span>👥 {{ item.treasureAttendanceList.length }} 人</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showPeopleList" class="show-people-list" @click.self="showPeopleList = false">
      <div class="boss-container">
        <h2 class="boss-title">參與名單</h2>
        <ul class="people-list">
          <li
            v-for="(data, index) in getJoinList()"
            :key="index"
            class="person-item"
            @click="handlePersonClick(data)"
          >
            <div class="person-info">
              <span class="person-name">👤 {{ data.userName }} </span>
              <span class="join-time"> , {{ formatTimestamp(data.joinTime) }}</span>
            </div>
          </li>
        </ul>
        <button class="close-btn" @click="showPeopleList = false">關閉</button>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">創建拍賣清單</h2>
          <p class="modal-subtitle">請填寫詳細寶物資訊</p>
        </div>

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label>寶物名稱</label>
            <select v-model="itemName" required class="styled-select">
              <option disabled value="">請選擇要開單的寶物</option>
              <option v-for="opt in itemOptions" :key="opt.itemId" :value="opt.itemId">
                {{ opt.itemName }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>首領名稱</label>
            <select v-model="bossName" required class="styled-select">
              <option disabled value="">請選擇掉落的首領</option>
              <option v-for="boss in bossOptions" :key="boss.bossId" :value="boss.bossId">
                {{ boss.bossName }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>分紅幣種</label>
            <div class="radio-card-group">
              <label v-for="item in balance.balanceList" :key="item.currency" class="radio-card">
                <input
                  type="radio"
                  v-model="selectedCurrency"
                  :value="item.currency"
                  name="currency"
                />
                <div class="radio-content">{{ item.currency }}</div>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>開單種類</label>
            <div class="radio-card-group binary">
              <label class="radio-card">
                <input type="radio" v-model="selectedType" value="bid" name="type" />
                <div class="radio-content">競標模式</div>
              </label>
              <label class="radio-card">
                <input type="radio" v-model="selectedType" value="fixed" name="type" />
                <div class="radio-content">固定金額</div>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>起始底價</label>
            <div class="input-wrapper">
              <input
                type="number"
                v-model.number="basePrice"
                class="styled-input"
                required
                placeholder="0"
              />
              <span class="input-suffix">{{ selectedCurrency || 'G' }}</span>
            </div>
          </div>

          <div class="form-group">
            <label>備註說明</label>
            <textarea
              v-model="remark"
              class="styled-input textarea"
              placeholder="輸入特殊說明..."
            ></textarea>
          </div>

          <div v-if="error" class="error-msg">{{ error }}</div>

          <div class="modal-footer">
            <button type="submit" class="btn-submit" :disabled="loading">
              {{ loading ? '提交中...' : '確認開單' }}
            </button>
            <button type="button" class="btn-cancel" @click="showModal = false">取消</button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showAddBossDialog || showAddTreasureDialog"
      class="modal-overlay"
      @click.self="showAddBossDialog = showAddTreasureDialog = false"
    >
      <div class="modal-card mini">
        <h2 class="modal-title">{{ showAddBossDialog ? '新增首領' : '新增道具' }}</h2>
        <input
          v-if="showAddBossDialog"
          v-model="addBossName"
          class="styled-input"
          placeholder="名稱"
        />
        <input v-else v-model="addItemName" class="styled-input" placeholder="名稱" />
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="modal-footer">
          <button class="btn-submit" @click="showAddBossDialog ? addBoss() : addTreasure()">
            確認新增
          </button>
          <button class="btn-cancel" @click="showAddBossDialog = showAddTreasureDialog = false">
            關閉
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.whole_page {
  padding: 20px;
  color: #e2e8f0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.page-title {
  /* 將原本的 1.5rem 縮小至 1.25rem，視覺上更平衡 */
  font-size: 1.25rem;
  font-weight: normal; /* 取消粗體 */
  letter-spacing: 0.5px;

  /* 縮小左邊裝飾條，使其與文字高度更契合 */
  border-left: 3px solid #b46eff;
  padding-left: 10px;

  /* 確保與右邊按鈕垂直對齊 */
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}

.page-title span {
  /* 副標題（共幾件）也微調一下顏色與大小 */
  font-size: 0.8rem;
  font-weight: normal;
  color: #64748b;
  letter-spacing: 0;
}
.header-btns {
  display: flex;
  gap: 8px;
}

.btn-top {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #00d4ff;
  cursor: pointer;
}

.auction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px; /* 稍微調小網格間距，從 20px 改成 16px */
  width: 100%;
}
.auction-card {
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 20px;
  position: relative;
}
.item-name {
  font-size: 1.25rem;
  margin-bottom: 4px;
}
.boss-tag {
  font-size: 0.85rem;
  color: #94a3b8;
}
.divider {
  height: 1px;
  background: #2d3047;
  margin: 12px 0;
}
.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.9rem;
}
.label {
  color: #64748b;
}
.gold {
  color: #f5c451;
  font-weight: bold;
}
.join-btn {
  width: 100%;
  height: 44px;
  margin-top: 12px;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: filter 0.2s;
}
.joined {
  background: #334155;
  color: #94a3b8;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
}

/* 彈窗樣式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal-card {
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.modal-header {
  text-align: center;
  margin-bottom: 20px;
}
.modal-title {
  font-size: 1.4rem;
  color: #f8fafc;
  margin-bottom: 4px;
}
.modal-subtitle {
  font-size: 0.85rem;
  color: #64748b;
}

.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}

.styled-select,
.styled-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 12px;
  border-radius: 10px;
  font-size: 0.95rem;
  box-sizing: border-box;
}
.textarea {
  height: 60px;
  resize: none;
}
.input-wrapper {
  position: relative;
}
.input-suffix {
  position: absolute;
  right: 12px;
  top: 12px;
  color: #f5c451;
  font-weight: bold;
}

.radio-card-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.radio-card-group.binary {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.radio-card {
  cursor: pointer;
  flex: 1;
}
.radio-card input {
  display: none;
}
.radio-content {
  background: #0f172a;
  border: 1px solid #334155;
  padding: 8px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  transition: 0.2s;
}
.radio-card input:checked + .radio-content {
  border-color: #b46eff;
  background: rgba(180, 110, 255, 0.1);
  color: #fff;
}

.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}
.btn-submit {
  flex: 2;
  background: linear-gradient(135deg, #6cf2ff, #b46eff);
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
}
.btn-cancel {
  flex: 1;
  background: #334155;
  color: #f1f5f9;
  border: none;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
}
.error-msg {
  color: #ef4444;
  font-size: 0.8rem;
  text-align: center;
  margin-top: 8px;
}

.card-tools {
  position: absolute;
  top: 5px;
  right: 15px;
  display: flex;
  gap: 8px;
  z-index: 10;
}

/* 基礎按鈕：採用深色玻璃質感 */
.tool-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  background: rgba(30, 41, 59, 0.6); /* 半透明背景 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 備註按鈕 Hover：呈現專案主色調(紫色)的發光感 */
.tool-btn:hover {
  background: rgba(180, 110, 255, 0.15);
  border-color: #b46eff;
  color: #e2e8f0;
  box-shadow: 0 0 10px rgba(180, 110, 255, 0.3);
}

/* 撤單按鈕 Hover：呈現警告色(紅色) */
.tool-btn.del:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #fca5a5;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
}

/* 點擊時的反饋縮放 */
.tool-btn:active {
  transform: scale(0.95);
}

/* 修正 item-main 避免標題太長撞到右側按鈕 */
.item-main {
  padding-right: 110px;
}

/* Modal 樣式保持原本邏輯但微調 */
/* Modal 樣式保持原本邏輯但微調 */
.show-people-list,
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.close-btn {
  width: 100%;
  height: 40px;
}

.boss-container {
  background: #1e1e2e;
  height: 60%; /* 保持你原本要求的 60% 高度 */
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;

  /* 新增：使用 flex 佈局，讓內部組件可以自動撐開與收縮 */
  display: flex;
  flex-direction: column;
}

/* 2. 針對標題固定位置 */
.boss-title {
  text-align: center;
  color: #fff;
  margin-bottom: 20px;
  flex-shrink: 0; /* 防止標題被壓縮 */
}

/* 3. 關鍵：針對名單區域設定滾動 */
.people-list {
  flex: 1; /* 佔據彈窗內扣除標題與按鈕後的剩餘所有空間 */
  overflow-y: auto; /* 內容超過時顯示垂直滾動軸 */
  margin-bottom: 15px;
  padding-right: 8px; /* 預留空間給滾動軸，防止擋住文字 */

  /* 優化滾動軸樣式（選配，讓它更有質感） */
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

/* 針對 Chrome, Safari 的滾動軸優化 */
.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 10px;
}

/* 4. 針對底部按鈕固定位置 */
.close-btn,
.modal-footer {
  flex-shrink: 0; /* 防止按鈕被壓縮 */
  margin-top: auto;
}
.person-item {
  background: #27293d;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.person-item.is-selected {
  border: 1px solid #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

/* 4. 針對底部按鈕固定位置 */
.close-btn,
.modal-footer {
  flex-shrink: 0; /* 防止按鈕被壓縮 */
  margin-top: auto;
}
</style>
