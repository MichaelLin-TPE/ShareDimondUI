<script setup lang="ts">
import { useAuction } from '@/composables/BiddingManageMent.ts'

const {
  auctions,
  formatTime,
  handleStatus,
  handleSubmit,
  groupedAuctionsList,
  handleUpdateRemark,
  handleDeleteItem,
  canSubmit,
  showPeopleList,
  getJoinList,
  formatTimestamp,
  handleSubmitFromWallet,
  handlePeopleClick,
  authStore,
  handlePeopleCount,
  submitAssign,
  showAssignModal,
  selectedMemberId,
  handleStorageChange,
  selectedTreasure,
} = useAuction()
</script>

<template>
  <div class="whole_page">
    <div class="page-header">
      <h3>待分配單 共 {{ auctions.length }} 件待分配道具</h3>
      <div class="tooltip-wrapper">
        <font-awesome-icon :icon="['far', 'circle-question']" class="info-icon" />
        <div class="tooltip-content">
          <strong>📋 待分配區作業須知</strong>
          1. <b>狀態轉換：</b>物品一旦有人標中，競標單將自動轉為「待分配單」。<br />
          2. <b>得標判定：</b>若有複數出價者，管理員可手動指定得標人，或由系統自動判定。<br />
          3. <b>收款方式：</b>管理員可依情況選擇「帳戶餘額扣款」或「遊戲內直接取款」。<br />
          4. <b>分紅結算：</b>管理員截標後，系統將依設定比例發放分紅予參與成員，並提撥公積金。<br />
          5. <b>物品交付：</b>確認收到款項後，請管理員務必將結案物品確實交付予得標人。
        </div>
      </div>
    </div>

    <div class="auction-container">
      <div v-for="group in groupedAuctionsList" :key="group.title" class="group-wrapper">
        <h4 class="group-title">{{ group.title }}</h4>

        <div class="auction-grid">
          <div v-for="item in group.items" :key="item.treasureCode" class="auction-card">
            <div class="card-tools">
              <button
                class="tool-btn remark"
                v-show="item.showDeleteTicket"
                @click="handleUpdateRemark(item)"
              >
                備註
              </button>
              <button
                class="tool-btn delete"
                v-show="item.showDeleteTicket"
                @click="handleDeleteItem(item)"
              >
                撤單
              </button>
            </div>

            <div class="item-main">
              <div class="item-name gold">{{ item.itemName }}</div>
              <div class="boss-name">頭目：{{ item.bossName }}</div>
            </div>

            <div class="divider"></div>

            <div class="info-section">
              <div class="info-row">
                <span class="label">開單者</span>
                <span class="value">{{ item.ticketOwerName }}</span>
              </div>
              <div class="info-row" v-for="c in item.treasureCurrencyList" :key="c.currency">
                <span class="label">{{ c.currency }}價格</span
                ><span class="value">{{ Number(c.amount).toLocaleString() }}</span>
              </div>
              <div v-if="item.biddingName != '尚未有得標者'" class="info-row highlight">
                <span class="label">最終價格</span>
                <span class="value gold"
                  >{{ Number(item.currentPrice).toLocaleString() }} {{ item.currency }}</span
                >
              </div>
              <div v-if="item.biddingName == null || item.biddingName.length == 0" class="info-row">
                <span class="label">競標名單</span>
                <span class="value-text">{{ item.biddingMemberContent || '無' }}</span>
              </div>
            </div>

            <div class="bidder-section">
              <div class="info-row">
                <span class="label">得標者</span>
                <span class="value gold">{{ item.biddingName }}</span>
              </div>
              <div class="info-row">
                <span class="label">備註</span>
                <span class="value-remark">{{ item.remark }}</span>
              </div>
              <div class="info-row">
                <span class="label">確認存倉</span>
                <div
                  v-if="authStore.member?.role == 'LEADER' || authStore.member?.role == 'OFFICER'"
                  class="value-action"
                >
                  <input
                    type="checkbox"
                    v-model="item.checkFromRepository"
                    class="small-checkbox"
                    @change="handleStorageChange(item)"
                  />
                </div>
                <span v-else class="value-remark">{{
                  item.checkFromRepository ? '確認存倉' : '尚未存倉'
                }}</span>
              </div>
            </div>

            <div class="action-wrapper">
              <button
                class="submit-btn wallet-btn"
                v-if="item.canVerifyBiddingTicket && item.hasEnoughMoneyToBuy"
                :disabled="canSubmit(item)"
                @click="handleSubmitFromWallet(item)"
              >
                從錢包扣除並派發
              </button>
            </div>
            <button
              class="submit-btn"
              :class="{
                'btn-assign-gem': !item.isBidding && item.assignByLeader,
                'btn-verify-gem':
                  !item.isBidding && !item.assignByLeader && item.canVerifyBiddingTicket,
              }"
              :disabled="canSubmit(item)"
              @click="handleSubmit(item)"
            >
              <span v-if="item.isBidding">確認出價</span>
              <span v-else-if="item.disableSubmitButton">分配結束</span>
              <span v-else-if="item.assignByLeader">指定得標者</span>
              <span v-else-if="item.canVerifyBiddingTicket">取得帳款並派發獎金</span>
            </button>

            <div class="card-footer" @click="handlePeopleCount(item)">
              <span class="timer">⏳ {{ formatTime(item.remainSeconds) }}</span>
              <span class="people">👥 {{ item.treasureAttendanceList.length }}人</span>
              <span class="status-tag">{{ handleStatus(item.status) }}</span>
            </div>
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
            @click="handlePeopleClick(data)"
          >
            <div class="person-info">
              <span class="person-name">👤 {{ data.userName }}</span>
              <span class="join-time"> , {{ formatTimestamp(data.joinTime) }}</span>
            </div>
          </li>
        </ul>
        <button class="close-btn" @click="showPeopleList = false">關閉</button>
      </div>
    </div>

    <div class="modal-overlay" v-if="showAssignModal" @click.self="showAssignModal = false">
      <div class="boss-container assign-modal">
        <div class="boss-title">會長指定得標</div>
        <div class="target-item-info">
          道具：<span class="gold-class gold">{{ selectedTreasure?.itemName }}</span>
        </div>
        <div class="people-list">
          <div
            v-for="member in selectedTreasure?.biddingMemberList"
            :key="member.userName"
            class="person-item"
            :class="{ 'is-selected': selectedMemberId === member.userName }"
            @click="selectedMemberId = member.userName"
          >
            <div class="member-info">
              <span class="member-name">{{ member.userName }}</span>
              <span class="check-icon" v-if="selectedMemberId === member.userName">✔</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="confirm-btn" @click="submitAssign">確認得標</button>
          <button class="cancel-btn" @click="showAssignModal = false">取消</button>
        </div>
      </div>
    </div>
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
  transition: all 0.2s; /* 讓大小變化也能有過渡效果 */

  /* 調整大小 */
  font-size: 20px; /* 你可以設定 px, rem 或 em */
  cursor: pointer;

  /* 如果覺得圖示跟文字沒對齊，可以加這個 */
  vertical-align: middle;
}

.info-icon:hover {
  color: #4a90e2;
  transform: scale(1.1); /* 額外小技巧：滑鼠移上去稍微放大 1.1 倍，動感更強 */
}

/* 提示框本體 */
.tooltip-content {
  visibility: hidden;
  width: 350px; /* 增加寬度，文字才不會擠在一起 */
  background-color: rgba(15, 15, 15, 0.95); /* 稍微加深背景色增加對比 */
  color: #fff;
  text-align: left;
  padding: 15px; /* 增加內距，讓文字有呼吸空間 */
  border-radius: 8px; /* 圓角加大一點點，看起來更現代 */

  /* 關鍵字體調整 */
  font-size: 15px; /* 放大字體 */
  line-height: 1.7; /* 增加行高，閱讀長文案才不吃力 */
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
  border: 1px solid #444; /* 加一個細邊框，更有質感 */
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

/* -------------------------------------- */
/* 新增：群組標題相關樣式 (加在原本 CSS 的最上方) */
/* -------------------------------------- */
.group-wrapper {
  margin-bottom: 40px;
}

.group-title {
  color: #f1f5f9;
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(99, 102, 241, 0.3); /* 使用與你按鈕相呼應的紫色調 */
  display: flex;
  align-items: center;
}

/* -------------------------------------- */
/* 以下為你原本的 CSS，完全未作更動 */
/* -------------------------------------- */

/* Checkbox 外層容器，確保垂直置中 */
.value-action {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 如果你的 value 通常靠右對齊，用這個 */
}

/* 小巧的 Checkbox 樣式 */
.small-checkbox {
  width: 16px; /* 控制框框大小 */
  height: 16px; /* 控制框框大小 */
  cursor: pointer;
  margin: 0;

  /* UX 小細節：讓打勾時的顏色符合你暗黑 UI 的主色調 (金黃色) */
  accent-color: #ffd166;

  /* 如果是在手機上，稍微加一點過渡效果會更滑順 */
  transition: transform 0.1s ease;
}

.small-checkbox:active {
  transform: scale(0.9); /* 點擊時微縮的按壓回饋 */
}
/* 頁面基礎設定 */
.whole_page {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 20px;
  border-left: 4px solid #6366f1;
  padding-left: 15px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

/* 核心：Grid 排版，自動換行，一排約 3-4 個 */
.auction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  width: 100%;
}

/* 卡片美化 */
.auction-card {
  position: relative;
  background: #161822;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.auction-card:hover {
  border-color: #6366f1;
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
}

/* 工具按鈕區 */
.card-tools {
  position: absolute;
  top: 5px;
  right: 15px;
  display: flex;
  gap: 8px;
}

.tool-btn {
  background: #1f2235;
  border: 1px solid #3f425b;
  color: #888;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.tool-btn:hover {
  background: #2d314d;
  color: #fff;
}

/* 物品與來源 */
.item-main {
  margin-bottom: 15px;
}

.item-name {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 4px;
}
.value {
  color: #f1f5f9;
}
.gold {
  color: #f5c451;
  font-weight: bold;
}

.boss-name {
  font-size: 0.85rem;
  color: #94a3b8;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 15px;
}

/* 欄位資訊 */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.label {
  color: #64748b;
}

.highlight .value-price {
  color: #10b981;
  font-weight: bold;
  font-size: 1.1rem;
}

.value-text,
.value-remark {
  color: #888;
  font-size: 0.85rem;
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 出價輸入 */
.bid-input-box {
  margin-top: auto;
  padding-top: 15px;
}

.price-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #fff;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  box-sizing: border-box;
}

/* 按鈕 */
.submit-btn {
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

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #334155;
}

.submit-btn.btn-assign-gem {
  background: linear-gradient(135deg, #9f1239, #be123c) !important;
}

.submit-btn.btn-verify-gem {
  background: linear-gradient(135deg, #0e7490, #155e75) !important;
}

/* 底部數據 */
.card-footer {
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #64748b;
  cursor: pointer;
}

.card-footer:hover {
  color: #6366f1;
}

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
.close-btn {
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

/* --- 彈窗底部按鈕區域升級 --- */
.modal-footer {
  display: flex;
  gap: 12px; /* 按鈕之間的間距 */
  margin-top: 24px; /* 與上方名單的距離 */
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.05); /* 輕微的分割線 */
  flex-shrink: 0; /* 防止按鈕區塊被壓縮 */
}

/* 按鈕基礎共用樣式 */
.modal-footer button {
  flex: 1; /* 兩個按鈕平分寬度 */
  height: 42px; /* 統一高度 */
  border-radius: 8px; /* 圓角 */
  font-weight: 600; /* 粗體字 */
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease; /* 流暢的過場動畫 */
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.5px;
}

/* 確認得標按鈕：遊戲風格漸層與發光 */
.confirm-btn {
  background: linear-gradient(135deg, #6366f1, #a855f7); /* 藍紫漸層 */
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); /* 深藍色發光 */
}

.confirm-btn:hover {
  filter: brightness(1.1); /* 懸停時變亮 */
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5); /* 加強發光 */
  transform: translateY(-1px); /* 微微上浮 */
}

/* 取消按鈕：低調深色 */
.cancel-btn {
  background: #2d3047; /* 深色背景，與卡片呼應 */
  color: #94a3b8; /* 較暗的文字顏色 */
  border: 1px solid #3f425b; /* 細邊框 */
}

.cancel-btn:hover {
  background: #3f425b; /* 懸停時稍微變亮 */
  color: #f1f5f9; /* 文字變亮 */
  border-color: #4b5563;
}

/* 按鈕點擊時的縮放反饋 */
.modal-footer button:active {
  transform: scale(0.96) translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 針對「指定得標」彈窗的特殊修正（如果是 BiddingManageMent.vue） */
.assign-modal .target-item-info {
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
  color: #888;
}
</style>
