<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '@/composables/treasureCare.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'

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
  handleItemChange,
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

interface ItemOpt { itemId: string; itemName: string }
interface BossOpt { bossId: string; bossName: string }
const itemSelectOptions = computed(() =>
  (itemOptions.value as ItemOpt[]).map((it) => ({ value: it.itemId, label: it.itemName })),
)
const bossSelectOptions = computed(() =>
  (bossOptions.value as BossOpt[]).map((b) => ({ value: b.bossId, label: b.bossName })),
)
const onItemChange = (v: string) => {
  itemName.value = v
  handleItemChange()
}
</script>

<template>
  <div class="whole_page">
    <div class="page-header">
      <h3 class="page-title">
        寶物分紅參與

        <div class="tooltip-wrapper">
          <font-awesome-icon :icon="['far', 'circle-question']" class="info-icon" />
          <div class="tooltip-content">
            <strong>💰 寶物分紅與申報須知</strong>
            1. <b>建立帳單：</b>掉落寶物後請立即進行開單。<br />
            2. <b>標註持有人：</b>備註註明保管人，以便會計與倉庫追蹤。<br />
            3. <b>及時交接：</b>請儘速將物品轉交倉庫或會計。<br />
            4. <b>確認權益：</b>參與成員請務必點擊「我有參與 +1」。
          </div>
        </div>

        <span>(共 {{ auctions.length }} 件)</span>
      </h3>
      <div class="header-btns">
        <button class="btn-top open" @click="openTicket">開單</button>
        <button class="btn-top add" @click="openAddTreasureDialog">道具</button>
        <button class="btn-top add" @click="openAddBossDialog">首領</button>
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

    <Teleport to="body">
      <div v-if="showPeopleList" class="ot-modal">
        <div class="ot-modal__mask" @click="showPeopleList = false"></div>
        <div class="ot-modal__panel ot-modal__panel--people" role="dialog">
          <button class="ot-modal__close" type="button" @click="showPeopleList = false">×</button>
          <div class="ot-modal__head">
            <h2>參與名單</h2>
            <p>點擊成員可管理其參與資格</p>
          </div>
          <ul class="ot-people-list">
            <li
              v-for="(data, index) in getJoinList()"
              :key="index"
              class="ot-people-item"
              @click="handlePersonClick(data)"
            >
              <span class="ot-people-name">👤 {{ data.userName }}</span>
              <span class="ot-people-time">{{ formatTimestamp(data.joinTime) }}</span>
            </li>
          </ul>
          <button class="ot-btn ot-btn--cancel" style="width: 100%;" @click="showPeopleList = false">
            關閉
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showModal" class="ot-modal">
        <div class="ot-modal__mask" @click="showModal = false"></div>
        <div class="ot-modal__panel" role="dialog">
          <button class="ot-modal__close" type="button" @click="showModal = false">×</button>
          <div class="ot-modal__head">
            <h2>創建拍賣清單</h2>
            <p>請填寫詳細寶物資訊</p>
          </div>

          <form @submit.prevent="handleSubmit" class="ot-modal__form">
            <div class="ot-field">
              <label>寶物名稱</label>
              <SearchableSelect
                :model-value="itemName"
                @update:model-value="onItemChange"
                :options="itemSelectOptions"
                placeholder="輸入關鍵字搜尋寶物..."
              />
            </div>

            <div class="ot-field">
              <label>首領名稱</label>
              <SearchableSelect
                v-model="bossName"
                :options="bossSelectOptions"
                placeholder="輸入關鍵字搜尋首領..."
              />
            </div>

            <div class="ot-field">
              <label>分紅幣種</label>
              <div class="ot-chips">
                <label v-for="item in balance.balanceList" :key="item.currency" class="ot-chip">
                  <input
                    type="radio"
                    v-model="selectedCurrency"
                    :value="item.currency"
                    name="ot-currency"
                  />
                  <span>{{ item.currency }}</span>
                </label>
              </div>
            </div>

            <div class="ot-field">
              <label>開單種類</label>
              <div class="ot-chips ot-chips--two">
                <label class="ot-chip">
                  <input type="radio" v-model="selectedType" value="bid" name="ot-type" />
                  <span>競標模式</span>
                </label>
                <label class="ot-chip">
                  <input type="radio" v-model="selectedType" value="fixed" name="ot-type" />
                  <span>固定金額</span>
                </label>
              </div>
            </div>

            <div class="ot-field">
              <label>起始底價</label>
              <div class="ot-input-wrap">
                <input type="number" v-model.number="basePrice" required placeholder="0" />
                <span class="ot-suffix">{{ selectedCurrency || 'G' }}</span>
              </div>
            </div>

            <div class="ot-field">
              <label>備註說明</label>
              <textarea v-model="remark" placeholder="輸入特殊說明..."></textarea>
            </div>

            <p v-if="error" class="ot-error">{{ error }}</p>

            <div class="ot-actions">
              <button type="button" class="ot-btn ot-btn--cancel" @click="showModal = false">
                取消
              </button>
              <button type="submit" class="ot-btn ot-btn--submit" :disabled="loading">
                {{ loading ? '提交中...' : '確認開單' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showAddBossDialog || showAddTreasureDialog" class="ot-modal">
        <div
          class="ot-modal__mask"
          @click="showAddBossDialog = showAddTreasureDialog = false"
        ></div>
        <div class="ot-modal__panel ot-modal__panel--mini" role="dialog">
          <button
            class="ot-modal__close"
            type="button"
            @click="showAddBossDialog = showAddTreasureDialog = false"
          >
            ×
          </button>
          <div class="ot-modal__head">
            <h2>{{ showAddBossDialog ? '新增首領' : '新增道具' }}</h2>
            <p>輸入名稱後送出即可</p>
          </div>

          <div class="ot-field">
            <label>{{ showAddBossDialog ? '首領名稱' : '道具名稱' }}</label>
            <input
              v-if="showAddBossDialog"
              v-model="addBossName"
              type="text"
              placeholder="請輸入名稱"
            />
            <input v-else v-model="addItemName" type="text" placeholder="請輸入名稱" />
          </div>

          <p v-if="error" class="ot-error">{{ error }}</p>

          <div class="ot-actions">
            <button
              type="button"
              class="ot-btn ot-btn--cancel"
              @click="showAddBossDialog = showAddTreasureDialog = false"
            >
              關閉
            </button>
            <button
              type="button"
              class="ot-btn ot-btn--submit"
              :disabled="loading"
              @click="showAddBossDialog ? addBoss() : addTreasure()"
            >
              {{ loading ? '處理中...' : '確認新增' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  cursor: help;
}

.info-icon {
  color: #999;
  transition: color 0.2s;
}

.info-icon:hover {
  color: #4a90e2; /* 滑鼠移上去變色 */
}

/* 提示框本體 */
.tooltip-content {
  visibility: hidden;
  width: 320px; /* 增加寬度，文字才不會擠在一起 */
  background-color: rgba(0, 0, 0, 0.9); /* 稍微加深背景色增加對比 */
  color: #fff;
  text-align: left;
  padding: 15px; /* 增加內距，讓文字有呼吸空間 */
  border-radius: 8px; /* 圓角加大一點點，看起來更現代 */

  /* 關鍵字體調整 */
  font-size: 15px; /* 放大字體 */
  line-height: 1.6; /* 增加行高，閱讀長文案才不吃力 */
  font-weight: normal;
  letter-spacing: 0.5px; /* 微調字距 */

  /* 定位 */
  position: absolute;
  bottom: 140%; /* 調整距離問號的高度 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 999; /* 確保在最上層 */

  /* 動畫 */
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none; /* 防止滑鼠滑進去提示框時閃爍 */
}

/* 小箭頭 */
.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -8px; /* 箭頭加大一點點 */
  border-width: 8px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
}
.tooltip-content strong {
  color: #ffda6a; /* 給標題一個顯眼的顏色，例如金色 */
  font-size: 17px; /* 標題再大一點 */
  display: block;
  margin-bottom: 8px;
}

/* 滑鼠移入 wrapper 時顯示 content */
.tooltip-wrapper:hover .tooltip-content {
  visibility: visible;
  opacity: 1;
  transform: translateX(-50%) translateY(-5px); /* 向上浮動的效果 */
}

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
  background: linear-gradient(135deg, #f5c451, #f59e0b) !important;
  color: #000000;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: filter 0.2s;
}
.joined {
  background: #334155;
  color: #000000;
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
  background: linear-gradient(135deg, #f5c451, #f59e0b) !important;
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

<!-- 新版開單彈窗：不用 scoped，因為 Teleport 到 body 外面 scoped 會失效 -->
<style>
.ot-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.ot-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  /* ⚠ 故意不用 backdrop-filter，避免兩層 blur 造成合成延遲 */
}
.ot-modal__panel {
  position: relative;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 460px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 28px 24px 24px;
  color: #f1f5f9;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}
.ot-modal__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.ot-modal__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
.ot-modal__head {
  text-align: center;
  margin-bottom: 18px;
}
.ot-modal__head h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
  color: #f8fafc;
  font-weight: 700;
}
.ot-modal__head p {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}
.ot-modal__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ot-field label {
  display: block;
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}
.ot-field select,
.ot-field textarea,
.ot-field input[type='number'],
.ot-field input[type='text']:not(.ss-input) {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.92rem;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}
.ot-field select:focus,
.ot-field textarea:focus,
.ot-field input[type='number']:focus,
.ot-field input[type='text']:not(.ss-input):focus {
  border-color: #b46eff;
}
.ot-field textarea {
  height: 56px;
  resize: none;
  font-family: inherit;
}
.ot-input-wrap {
  position: relative;
}
.ot-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #f5c451;
  font-weight: bold;
  font-size: 0.9rem;
  pointer-events: none;
}
.ot-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ot-chips--two {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.ot-chip {
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.ot-chip input {
  display: none;
}
.ot-chip span {
  display: block;
  background: #0f172a;
  border: 1px solid #334155;
  padding: 9px 8px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.85rem;
  color: #94a3b8;
  transition: all 0.12s;
}
.ot-chip input:checked + span {
  border-color: #b46eff;
  background: rgba(180, 110, 255, 0.12);
  color: #fff;
}
.ot-error {
  color: #ef4444;
  font-size: 0.82rem;
  text-align: center;
  margin: 0;
}
.ot-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.ot-btn {
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: bold;
  font-size: 0.95rem;
  cursor: pointer;
  transition: filter 0.15s, opacity 0.15s;
}
.ot-btn--cancel {
  flex: 1;
  background: #334155;
  color: #f1f5f9;
}
.ot-btn--cancel:hover {
  background: #475569;
}
.ot-btn--submit {
  flex: 2;
  background: linear-gradient(135deg, #f5c451, #f59e0b);
  color: #000;
}
.ot-btn--submit:hover:not(:disabled) {
  filter: brightness(1.08);
}
.ot-btn--submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 參與名單 Panel 變體 */
.ot-modal__panel--people {
  max-width: 400px;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.ot-people-list {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}
.ot-people-list::-webkit-scrollbar {
  width: 6px;
}
.ot-people-list::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.ot-people-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: #27293d;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.ot-people-item:hover {
  background: #2f3248;
}
.ot-people-name {
  font-size: 0.9rem;
  color: #f1f5f9;
  font-weight: 500;
}
.ot-people-time {
  font-size: 0.78rem;
  color: #94a3b8;
}

/* 新增道具 / 首領 Mini Panel 變體 */
.ot-modal__panel--mini {
  max-width: 360px;
}
</style>
