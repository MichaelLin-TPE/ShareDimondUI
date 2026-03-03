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
  selectPeopleItem,
  openAddTreasureDialog,
  handleDeleteItem,
  showAddTreasureDialog,
  addItemName,
  loading,
  error,
  addTreasure,
  showAddBossDialog,
  handleJoinItem,
  balance,
  formatPrice,
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
      <h3>寶物分紅參予：（共 {{ auctions.length }} 件寶物）</h3>
      <button class="open-ticket" @click="openTicket">我要開單</button>
      <button class="add-treasure" @click="openAddTreasureDialog">新增道具</button>
      <button class="add-boss" @click="openAddBossDialog">新增首領</button>
    </div>
    <div class="auction-scroll">
      <div class="auction-grid">
        <div v-for="item in auctions" :key="item.treasureCode" class="auction-card">
          <button
            class="delete-ticket"
            v-show="item.showDeleteTicket"
            @click="handleDeleteItem(item)"
          >
            撤單
          </button>
          <div class="item-name gold">{{ item.itemName }}</div>

          <div class="price">首領：{{ item.bossName }}</div>
          <div class="price">開單者：{{ item.ticketOwerName }}</div>
          <div class="price">分紅幣別：{{ item.currency }}</div>
          <div class="price">價格：{{ Number(item.baseAmount).toLocaleString() }}</div>
          <div class="price">單子種類：{{ item.treasureType }}</div>
          <button
            class="submit-btn"
            @click="handleJoinItem(item)"
            :disabled="item.joinButtonDisable"
          >
            <span v-if="item.joinButtonDisable">已參與此次分紅</span>
            <span v-else>我有參與+1</span>
          </button>

          <div class="meta" @click="handlePeopleCount(item)">
            ⏳ {{ formatTime(item.remainSeconds) }} 👥 {{ item.treasureAttendanceList.length }}人
          </div>
          <div class="bottom_title">倒數完畢此道具將會進入競拍...</div>
        </div>
      </div>
    </div>

    <div v-if="showPeopleList" class="show-people-list" @click.self="showPeopleList = false">
      <div class="boss-container">
        <h2 class="boss-title">參與名單</h2>
        <div v-if="showPeopleList" class="show-people-list" @click.self="showPeopleList = false">
          <div class="boss-container">
            <h2 class="boss-title">參與名單</h2>

            <ul class="people-list">
              <li v-for="(data, index) in getJoinList()" :key="index" class="person-item">
                <div class="person-info">
                  <span class="person-name">👤 {{ data.userName }}</span>
                  <span class="join-time">{{ formatTimestamp(data.joinTime) }}</span>
                </div>
              </li>
            </ul>

            <button class="close-btn" @click="showPeopleList = false">關閉</button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showAddBossDialog"
      class="show-add-boss-overlay"
      @click.self="showAddBossDialog = false"
    >
      <div class="boss-container">
        <h2 class="boss-title">創建首領</h2>
        <div class="form-group">
          <input
            type="text"
            id="item-name"
            v-model.number="addBossName"
            class="text-input"
            placeholder="輸入首領名稱"
          />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <div class="modal-actions2">
          <button class="submit-btn2" type="submit" @click="addBoss" :disabled="loading">
            <span v-if="!loading">新增</span>
            <span v-else>傳送中…</span>
          </button>
          <button type="button" class="close-btn2" @click="showAddBossDialog = false">關閉</button>
        </div>
      </div>
    </div>

    <div
      v-if="showAddTreasureDialog"
      class="show-add-treasure-overlay"
      @click.self="showAddTreasureDialog = false"
    >
      <div class="treasure-container">
        <h2 class="treasure-title">創建道具</h2>
        <div class="form-group">
          <input
            type="text"
            id="item-name"
            v-model.number="addItemName"
            class="text-input"
            placeholder="輸入道具名稱"
          />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <div class="modal-actions2">
          <button class="submit-btn2" type="submit" @click="addTreasure" :disabled="loading">
            <span v-if="!loading">新增</span>
            <span v-else>傳送中…</span>
          </button>
          <button type="button" class="close-btn2" @click="showAddTreasureDialog = false">
            關閉
          </button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-container">
        <h2 class="modal-title">開單</h2>
        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-group">
            <label for="item-name">寶物名稱</label>
            <div class="custom-select-wrapper">
              <select id="item-name" v-model="itemName" required class="custom-select">
                <option disabled value="">請選擇寶物</option>
                <option v-for="item in itemOptions" :key="item.itemId" :value="item.itemId">
                  {{ item.itemName }}
                </option>
              </select>
              <span class="select-arrow"></span>
            </div>
          </div>

          <div class="form-group">
            <label for="boss-name">首領名稱</label>
            <div class="custom-select-wrapper">
              <select id="boss-name" v-model="bossName" required class="custom-select">
                <option disabled value="">請選擇首領</option>
                <option v-for="boss in bossOptions" :key="boss.bossId" :value="boss.bossId">
                  {{ boss.bossName }}
                </option>
              </select>
              <span class="select-arrow"></span>
            </div>
          </div>

          <div class="form-group">
            <label>選擇幣種</label>
            <div class="currency-radio-group">
              <label
                v-for="item in balance.balanceList"
                :key="item.currency"
                class="currency-option"
              >
                <input
                  type="radio"
                  v-model="selectedCurrency"
                  :value="item.currency"
                  name="currency"
                />
                <span class="custom-radio"></span>
                <span class="currency-name">{{ item.currency }}</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>選擇開單種類</label>
            <div class="currency-radio-group">
              <label class="currency-option">
                <input type="radio" v-model="selectedType" value="bid" name="orderType" />
                <span class="custom-radio"></span>
                <span class="currency-name">競標</span>
              </label>

              <label class="currency-option">
                <input type="radio" v-model="selectedType" value="fixed" name="orderType" />
                <span class="custom-radio"></span>
                <span class="currency-name">固定金額</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="base-price">底價</label>
            <input
              type="number"
              id="base-price"
              v-model.number="basePrice"
              min="0"
              required
              class="text-input"
              placeholder="輸入起始競標價格"
            />
          </div>

          <div class="form-group">
            <label for="remark">備註</label>
            <textarea
              id="remark"
              v-model="remark"
              rows="3"
              class="text-input"
              placeholder="可選填，例如：寶物狀態、特殊說明..."
            ></textarea>
          </div>
          <div v-if="error" class="error">{{ error }}</div>
          <div class="modal-actions">
            <button class="submit-btn large" type="submit" :disabled="loading">
              <span v-if="!loading">提交</span>
              <span v-else>傳送中…</span>
            </button>
            <button type="button" class="close-btn" @click="showModal = false">關閉</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 容器主體 */
.boss-container {
  background: rgba(30, 30, 30, 0.9); /* 深色背景符合整體氛圍 */
  width: 90%;
  max-width: 400px;
  max-height: 70vh; /* 限制高度，避免名單太長 */
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}

.boss-title {
  color: #ffffff;
  text-align: center;
  margin-bottom: 20px;
  font-size: 1.5rem;
  letter-spacing: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 10px;
}

/* 清單區域 */
.people-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto; /* 超出高度時可滾動 */
}

/* 每一行名單 */
.person-item {
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 10px;
  border-radius: 8px;
  transition: background 0.2s;
}

.person-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.person-info {
  display: flex;
  justify-content: space-between; /* 名字在左，時間在右 */
  align-items: center;
  padding: 12px 15px;
}

.person-name {
  color: #e0e0e0;
  font-weight: 500;
  font-size: 1.1rem;
}

.join-time {
  color: #888;
  font-size: 0.85rem;
}

/* 自定義捲軸樣式 (讓它看起來更精緻) */
.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

/* 下方的關閉按鈕 */
.close-btn {
  margin-top: 20px;
  padding: 10px;
  background: #444;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}
.close-btn:hover {
  background: #666;
}

.error {
  width: 100%;
  margin-top: 4px;
  font-size: 13px;
  color: #ff6b6b;
  text-align: center;
}

/* --- Modal Overlay & Container --- */
span {
  margin-right: 15px;
}
.show-people-list,
.show-add-boss-overlay,
.show-add-treasure-overlay,
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7); /* 半透明黑色背景 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* 確保在最上層 */
  backdrop-filter: blur(5px); /* 磨砂玻璃效果 */
  animation: fadeIn 0.3s ease-out;
}
.boss-container,
.treasure-container,
.modal-container {
  background: linear-gradient(145deg, #1c1f2e, #141620); /* 深色漸層背景 */
  border: 1px solid rgba(50, 50, 70, 0.8);
  border-radius: 12px;
  padding: 30px;
  width: 90%;
  max-width: 500px; /* 控制最大寬度 */
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transform: scale(0.95);
  animation: slideIn 0.3s ease-out forwards;
}
.boss-title,
.treasure-title,
.modal-title {
  color: #a5b4fc; /* 淡紫色標題 */
  font-size: 1.8rem;
  margin-bottom: 25px;
  text-align: center;
  font-weight: bold;
  letter-spacing: 1px;
}

/* --- Form Groups --- */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: #e0e0e0; /* 淺灰色標籤 */
  margin-bottom: 8px;
  font-size: 0.95rem;
  font-weight: 500;
}

/* --- Text Input & Textarea --- */
.text-input {
  width: calc(100% - 20px); /* 考慮 padding */
  padding: 12px 10px;
  background-color: #0d0f17; /* 更深的背景色 */
  border: 1px solid #3a3f5a;
  border-radius: 6px;
  color: #f0f0f0; /* 白色文字 */
  font-size: 1rem;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.text-input:focus {
  border-color: #a5b4fc; /* 焦點時邊框變色 */
  outline: none;
  box-shadow: 0 0 0 2px rgba(165, 180, 252, 0.3); /* 焦點時發光效果 */
}

/* --- Custom Select Dropdown --- */
.custom-select-wrapper {
  position: relative;
  width: 100%;
}

.custom-select {
  -webkit-appearance: none; /* 移除瀏覽器預設樣式 */
  -moz-appearance: none;
  appearance: none;
  width: calc(100% - 20px);
  padding: 12px 35px 12px 10px; /* 留空間給箭頭 */
  background-color: #0d0f17;
  border: 1px solid #3a3f5a;
  border-radius: 6px;
  color: #f0f0f0;
  font-size: 1rem;
  cursor: pointer;
  transition:
    border-color 0.3s,
    box-shadow 0.3s;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.custom-select:focus {
  border-color: #a5b4fc;
  outline: none;
  box-shadow: 0 0 0 2px rgba(165, 180, 252, 0.3);
}

.select-arrow {
  position: absolute;
  top: 50%;
  right: 15px;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #a5b4fc; /* 淡紫色箭頭 */
  pointer-events: none; /* 讓點擊穿透到 select */
}

.currency-radio-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 保持三行 */
  gap: 15px;
  margin-top: 10px;
}

/* 調整父容器，確保對齊 */
.currency-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  min-width: 0; /* 👈 防止 flex 子元素溢出 */
}

/* 隱藏預設 input */
.currency-option input {
  display: none;
}

/* 自定義圓圈：核心修正 */
.custom-radio {
  width: 18px; /* 固定寬度 */
  height: 18px; /* 固定高度 */
  flex: 0 0 18px; /* 👈 強制設定 flex-basis 為 18px，防止任何擠壓 */
  border: 2px solid #555;
  border-radius: 50%; /* 絕對圓角 */
  margin-right: 10px;
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  box-sizing: border-box; /* 確保 18px 包含 border */
  display: inline-block; /* 👈 確保它是區塊元素 */
}

/* 文字樣式 */
.currency-name {
  color: #ccc;
  font-size: 14px;
  white-space: nowrap; /* 防止文字換行擠壓圓圈 */
}

/* 選中狀態：外圈變色 */
.currency-option input:checked + .custom-radio {
  border-color: #7e57c2;
  box-shadow: 0 0 8px rgba(126, 87, 194, 0.5);
}

/* 選中狀態：內心實心圓 */
.currency-option input:checked + .custom-radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #88d3ce;
  border-radius: 50%;
  /* 確保內心圓也不會變形 */
  display: block;
}

/* 選中後的文字顏色 */
.currency-option input:checked ~ .currency-name {
  color: #fff;
}

.item-name {
  font-size: 20px;
}

/* --- Action Buttons --- */
.modal-actions2,
.modal-actions {
  display: grid;
  align-items: center; /* 確保垂直中心點對齊 */
  gap: 0px; /* 縮小間距更現代 */
  margin-top: 30px;
}

/* 建立一個共通類別來統一高度與對齊 */

.submit-btn2,
.close-btn2,
.submit-btn.large,
.close-btn {
  width: calc(100% - 20px);
  height: 44px; /* 統一高度 */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  box-sizing: border-box; /* 關鍵：讓 border 不會撐開寬高 */
}
.submit-btn2,
.submit-btn.large {
  min-width: 100px;
  background: linear-gradient(135deg, #6cf2ff, #b46eff);
  color: #0b0f1a;
  border: none;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}
.close-btn2,
.close-btn {
  min-width: 100px; /* 寬度設為一致 */

  background: #2a2d3e;
  color: #e0e0e0;
  border: 1px solid #4a4e69;
}
/* Hover 效果 */
.submit-btn2:hover,
.submit-btn.large:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(108, 242, 255, 0.3);
}

.close-btn:hover {
  background: #33364b;
  color: #fff;
}

/* --- Animations --- */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-50px) scale(0.9);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* --- 您的其他樣式 --- */
/* (將您現有的 style scoped 內容貼在這裡，確保沒有衝突) */

/* 範例：為了讓開單按鈕能觸發彈窗，請確保它也在這裡 */

.delete-ticket:active,
.open-ticket:active,
.add-boss:active,
.add-treasure:active {
  transform: translateY(1px);
}

.open-ticket,
.add-boss,
.add-treasure {
  width: 80px;
  height: 32px;
  padding: 0; /* 調整為0，透過 flex 置中文字 */
  display: flex; /* 確保內容置中 */
  align-items: center;
  justify-content: center;
  border-radius: 8px;

  /* 顏色調整：電光藍 */
  color: #00d4ff;
  background: linear-gradient(145deg, #12141d, #1a1f2e);
  border: 1px solid rgba(0, 212, 255, 0.3);

  /* 立體感：淡淡的外發光 */
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.05);

  transition: all 0.3s ease;
  cursor: pointer;
}
.delete-ticket:hover,
.open-ticket:hover,
.add-boss:hover,
.add-treasure:hover {
  border-color: #00d4ff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}

/* --- 修正 Header 與標題 --- */
.page-header {
  display: flex;
  align-items: center; /* 垂直置中 */
  gap: 15px;
  margin-bottom: 5px; /* 增加一點與下方滾動區的距離 */
}

.page-header h3 {
  margin-top: 18px;
  font-size: 1.25rem;
  color: #ffffff;
  line-height: 1; /* 確保行高不干擾對齊 */
}

.bottom_title {
  margin-top: 10px;
}

.whole_page {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.meta {
  margin-top: 15px;
  cursor: pointer; /* 讓滑鼠移上去時顯示小手圖示 */
  transition: all 0.2s ease; /* 讓背景顏色變化更平滑 */
  padding: 8px; /* 增加一點點點擊範圍 */
  border-radius: 4px; /* 讓邊緣稍微圓潤，看起來像按鈕 */
}
.meta:hover {
  background-color: rgba(0, 0, 0, 05);
}
/* 點擊下去的效果：縮放或變暗 */
.meta:active {
  transform: scale(0.98); /* 輕微縮小，模擬實體按鈕按下去的感覺 */
  background-color: rgba(0, 0, 0, 0.1);
}

/* 1. 基礎容器設定 */
.auction-scroll {
  margin-top: 10px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
}

/* 2. 定義捲軸整體樣式 */
.auction-scroll::-webkit-scrollbar {
  height: 6px; /* 捲軸高度 */
}

/* 3. 預設讓捲軸軌道與滑塊變透明 */
.auction-scroll::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 10px;
  transition: background-color 0.3s;
}

/* 4. 當滑鼠 hover 容器時，顯示滑塊顏色 */
.auction-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(180, 110, 255, 0.5); /* 使用你主題的紫色，帶點透明度 */
}

/* 5. (選用) 懸停在滑塊本身時變深 */
.auction-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #b46eff;
}

.auction-grid {
  display: flex;
  gap: 20px;

  width: max-content; /* 👈 關鍵：不要被父層壓縮 */
}

.auction-card {
  position: relative;
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 14px;
  /* 關鍵 1：稍微增加 padding-top，為標題留出呼吸空間，但不影響按鈕 */
  padding: 24px 16px 16px 16px;
  flex: 0 0 360px;
  /* 關鍵 2：確保內容不會溢出，這有助於定位精準 */
  overflow: hidden;
}
.delete-ticket {
  position: absolute; /* 👈 脫離排版流 */
  top: 0px; /* 距離頂部 */
  right: 12px; /* 👈 改為右邊 12px，就變成右上角了 */

  /* 保持你原本的樣式設定 */
  width: 45px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #00d4ff;
  background: linear-gradient(145deg, #12141d, #1a1f2e);
  border: 1px solid rgba(0, 212, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
  cursor: pointer;
  z-index: 10;
}

.gold {
  color: #f5c451;
  font-weight: bold;
}

.submit-btn {
  width: 100%;
  height: 50px;
  margin-top: 15px;
  background: linear-gradient(135deg, #6cf2ff, #b46eff);
  color: #0b0f1a;
  padding: 10px;
  border-radius: 8px;
}
</style>
