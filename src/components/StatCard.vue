<script setup lang="ts">
import { useAuction } from '@/composables/statCard.ts'

const {
  auctions,
  formatTime,
  handleStatus,
  handlePersonClick,
  handleSubmit,
  handleUpdateRemark,
  handleDeleteItem,
  canSubmit,
  // 新增以下解構
  showPeopleList,
  inputPrice,
  getJoinList,
  formatTimestamp,
  handlePeopleCount,
  submitAssign,
  showAssignModal,
  selectedMemberId,
  selectedTreasure,
} = useAuction()
</script>

<template>
  <div class="whole_page">
    <div class="page-header">
      <h3>正在競拍 共 {{ auctions.length }} 件競拍中道具</h3>
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
          <button
            class="remark-ticket"
            v-show="item.showDeleteTicket"
            @click="handleUpdateRemark(item)"
          >
            備註
          </button>
          <div class="item-name gold">{{ item.itemName }}</div>
          <div class="price">開單者：{{ item.ticketOwerName }}</div>
          <div class="price">頭目：{{ item.bossName }}</div>
          <div class="price">底價：{{ item.lowestPrice.toLocaleString() }} {{ item.currency }}</div>
          <div class="price">目前最高：{{ item.currentPrice }} {{ item.currency }}</div>

          <div class="bidder">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <span class="status-label">目前競標玩家：</span>
              <span class="status-value">{{ item.biddingMemberContent }}</span>
            </template>

            <template v-else> 出價者：{{ item.biddingName }} </template>
          </div>
          <div class="bidder">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <span class="status-label">得標者：</span>
              <span class="status-value">{{ item.biddingName }}</span>
            </template>
          </div>
          <div class="price">備註：{{ item.remark }}</div>
          <div v-if="item.treasureType !== 'RANDOM_BUYER'" class="bid-control">
            <input
              type="number"
              id="base-price"
              v-model.number="item.biddingPrice"
              min="0"
              required
              class="text-input"
              placeholder="請輸入你要競標的價格"
            />
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
            <span v-if="item.isBidding">
              <template v-if="!item.canBid">沒有參與，暫時無法競標</template>
              <template v-else-if="item.treasureType === 'RANDOM_BUYER'">我要標此物品</template>
              <template v-else>我要出價</template>
            </span>

            <span v-else-if="item.disableSubmitButton">結束競標</span>
            <span v-else-if="item.assignByLeader">請選擇得標者</span>
            <span v-else-if="item.canVerifyBiddingTicket">已拿到帳款,可派發獎金</span>
          </button>

          <div class="meta" @click="handlePeopleCount(item)">
            ⏳ {{ formatTime(item.remainSeconds) }} 👥 {{ item.treasureAttendanceList.length }} 人
            🔥{{ handleStatus(item.status) }}
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
              <span class="person-name">👤 {{ data.userName }}</span>
              <span class="join-time">{{ formatTimestamp(data.joinTime) }}</span>
            </div>
          </li>
        </ul>
        <button class="close-btn" @click="showPeopleList = false">關閉</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" v-if="showAssignModal" @click.self="showAssignModal = false">
    <div class="boss-container assign-modal">
      <div class="boss-title">會長指定得標</div>

      <div class="target-item-info">
        道具：<span class="gold">{{ selectedTreasure?.itemName }}</span>
      </div>

      <div class="people-list">
        <div v-if="!selectedTreasure?.biddingMemberList?.length" class="empty-hint">
          目前無人參與競標
        </div>

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
</template>

<style scoped>
/* 彈窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.assign-modal {
  border: 1px solid #6366f1; /* 給予霓虹邊框感 */
}

.target-item-info {
  text-align: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 14px;
}

/* 成員列 */
.person-item {
  padding: 15px;
  margin-bottom: 8px;
  border: 1px solid #2d3047;
  cursor: pointer;
  transition: all 0.2s;
}

.person-item.is-selected {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.member-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.check-icon {
  color: #6366f1;
  font-weight: bold;
}

/* 底部按鈕 */
.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.confirm-btn {
  flex: 2;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  padding: 12px;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  cursor: pointer;
}

.cancel-btn {
  flex: 1;
  background: #2d3047;
  border: none;
  padding: 12px;
  border-radius: 8px;
  color: #aaa;
  cursor: pointer;
}

.empty-hint {
  text-align: center;
  color: #666;
  padding: 20px;
}

/* 原有的樣式保持不變 */
.item-name {
  font-size: 20px;
}
.remark-ticket:active {
  transform: translateY(1px);
}
.remark-ticket:hover {
  border-color: #00d4ff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}
.remark-ticket {
  position: absolute;
  top: 0px;
  right: 60px;
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
.delete-ticket:active {
  transform: translateY(1px);
}

.delete-ticket:hover {
  border-color: #00d4ff;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}

.delete-ticket {
  position: absolute;
  top: 0px;
  right: 12px;
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

.whole_page {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.meta {
  margin-top: 15px;
  cursor: pointer; /* 增加手勢 */
  transition: all 0.2s ease;
  padding: 8px;
  border-radius: 4px;
}
.meta:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
.meta:active {
  transform: scale(0.98);
}

.reduce-button,
.plus-button {
  height: 50px;
  width: 50px;
}
.myBid {
  margin-left: 10px;
  margin-right: 10px;
}

.auction-scroll {
  overflow-x: auto; /* 確保橫向溢出 */
  padding-bottom: 15px; /* 給予捲軸空間，避免擋住卡片內容 */
}

/* 2. 設定 Webkit 瀏覽器的捲軸樣式 */
.auction-scroll::-webkit-scrollbar {
  height: 8px; /* 橫向捲軸的高度 */
  display: block; /* 確保顯示 */
}

/* 3. 捲軸軌道（底色）*/
.auction-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05); /* 稍微看得到的深色底 */
  border-radius: 10px;
}

/* 4. 捲軸拉條（滑塊）*/
.auction-scroll::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.5); /* 使用你系統的紫色調，並給予固定透明度 */
  border-radius: 10px;
  border: 2px solid transparent; /* 讓滑塊看起來細一點 */
  background-clip: padding-box;
}

/* 5. 滑鼠移上去時變亮（可選，增加互動感）*/
.auction-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.8);
}

.auction-grid {
  display: flex;
  gap: 20px;
  width: max-content;
}

.auction-card {
  position: relative;
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 24px 16px 16px 16px;
  flex: 0 0 360px;
  overflow: hidden;
}

.gold {
  color: #f5c451;
  font-weight: bold;
}

.submit-btn {
  width: 100%;
  height: 50px;
  margin-top: 15px;
  background: linear-gradient(135deg, #6cf2ff, #b46eff); /* 這是原本的藍紫漸層 */
  color: #0b0f1a;
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

/* --- 只有符合條件時才會覆蓋上去的顏色 --- */

/* 狀態：請選擇得標者 (日落橘漸層 - 代表動作提醒) */
/* 狀態：請選擇得標者 (寶石紅漸層) */
.submit-btn.btn-assign-gem {
  background: linear-gradient(135deg, #9f1239, #be123c) !important;
  color: #ffffff !important;
  box-shadow: 0 0 15px rgba(159, 18, 57, 0.4);
  border: 1px solid rgba(251, 113, 133, 0.3) !important;
}

/* 狀態：已拿到帳款 (深邃藍綠漸層) */
.submit-btn.btn-verify-gem {
  background: linear-gradient(135deg, #0e7490, #155e75) !important;
  color: #ffffff !important;
  box-shadow: 0 0 15px rgba(14, 116, 144, 0.4);
  border: 1px solid rgba(34, 211, 238, 0.3) !important;
}

/* 強化懸停時的發光感 */
.submit-btn.btn-assign-gem:hover,
.submit-btn.btn-verify-gem:hover {
  filter: brightness(1.2);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
}

/* --- 新增彈窗專用 CSS (由 TreasureCard 移植) --- */
.show-people-list {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
  animation: fadeIn 0.3s ease-out;
}

.boss-container {
  background: rgba(30, 30, 30, 0.9);
  width: 90%;
  max-width: 400px;
  max-height: 70vh;
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

.people-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}

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
  justify-content: space-between;
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

.close-btn {
  margin-top: 20px;
  padding: 10px;
  width: 100%;
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

.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>

<style>
/* 注意：這裡不要加 scoped */

/* 強制讓 SweetAlert2 內容垂直排列 */
.custom-swal-actions {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  width: 100% !important;
  gap: 12px !important;
  margin-top: 20px !important;
}

/* 強制按鈕與輸入框寬度一致 (90%) */
.custom-swal-confirm,
.custom-swal-cancel,
.custom-swal-input {
  width: 90% !important;
  max-width: 350px !important; /* 限制最大寬度防止太醜 */
  margin: 5px auto !important;
  box-sizing: border-box !important;
}

/* 按鈕高度與圓角 */
.custom-swal-confirm,
.custom-swal-cancel {
  height: 48px !important;
  border-radius: 8px !important;
  font-size: 16px !important;
  font-weight: bold !important;
  border: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 送出按鈕顏色 (套用你的藍紫漸層) */
.custom-swal-confirm {
  background: linear-gradient(135deg, #6366f1, #a855f7) !important;
  color: white !important;
}

/* 取消按鈕顏色 */
.custom-swal-cancel {
  background: #444 !important;
  color: white !important;
}

/* 輸入框深色背景 */
.custom-swal-input {
  background-color: rgba(255, 255, 255, 0.05) !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  height: 45px !important;
}
</style>
