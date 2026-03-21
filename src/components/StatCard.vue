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
  showPeopleList,
  getJoinList,
  formatTimestamp,
  handlePeopleCount,
  selectedBuyCurrency,
  submitAssign,
  showAssignModal,
  selectedMemberId,
  selectedTreasure,
  showCurrencyModal,
  formatEventTime,
  handleConfirmBuy,
  openCurrencyModal,
  currentBuyItem, // 👉 需要在 composable 中新增這個 ref 來記錄當前點擊的物品
} = useAuction()
</script>

<template>
  <div class="whole_page">
    <div class="page-header">
      <h3>正在競拍 共 {{ auctions.length }} 件競拍中道具</h3>
    </div>

    <div class="auction-container">
      <div class="auction-grid">
        <div v-for="item in auctions" :key="item.treasureCode" class="auction-card">
          <div class="card-tools">
            <button
              class="tool-btn remark"
              v-show="item.showDeleteTicket"
              @click="handleUpdateRemark(item)"
              title="備註"
            >
              備註
            </button>
            <button
              class="tool-btn delete"
              v-show="item.showDeleteTicket"
              @click="handleDeleteItem(item)"
              title="撤單"
            >
              撤單
            </button>
          </div>

          <div class="item-main">
            <div class="item-name gold">{{ item.itemName }}</div>
            <div class="boss-name">BOSS: {{ item.bossName }}</div>
          </div>

          <div class="divider"></div>

          <div class="info-section">
            <div class="info-row">
              <span class="label">開單時間</span>
              <span class="value">{{ formatEventTime(item.createDate) }}</span>
            </div>
            <div class="info-row">
              <span class="label">開單者</span>
              <span class="value">{{ item.ticketOwerName }}</span>
            </div>
            <div class="info-row" v-for="c in item.treasureCurrencyList" :key="c.currency">
              <span class="label">{{ c.currency }}價格</span>
              <span class="value gold">{{ Number(c.amount).toLocaleString() }}</span>
            </div>
            <div v-if="item.treasureType === 'BID'" class="info-row highlight">
              <span class="label">目前最高價</span>
              <span class="value-price"
                >{{ Number(item.currentPrice).toLocaleString() }} {{ item.currency }}</span
              >
            </div>
          </div>

          <div class="bidder-section">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <div class="info-row">
                <span class="label">競標名單</span>
                <span class="value-text">{{ item.biddingMemberContent || '無' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="info-row">
                <span class="label">最高出價者</span>
                <span class="value">{{ item.biddingName || '尚未有人出價' }}</span>
              </div>
            </template>
            <div class="info-row">
              <span class="label">備註</span>
              <span class="value-remark">{{ item.remark || '無備註' }}</span>
            </div>
          </div>

          <div v-if="item.treasureType !== 'RANDOM_BUYER'" class="bid-input-box">
            <input
              type="number"
              v-model.number="item.biddingPrice"
              min="0"
              class="price-input"
              placeholder="輸入競標金額"
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
            @click="
              item.treasureType === 'RANDOM_BUYER' && item.isBidding && item.canBid
                ? openCurrencyModal(item)
                : handleSubmit(item)
            "
          >
            <span v-if="item.isBidding">
              <template v-if="!item.canBid">尚未參與,無法競標</template>
              <template v-else-if="item.treasureType === 'RANDOM_BUYER'">我要標此物品</template>
              <template v-else>確認出價</template>
            </span>
            <span v-else-if="item.disableSubmitButton">競標已結束</span>
            <span v-else-if="item.assignByLeader">指定得標者</span>
            <span v-else-if="item.canVerifyBiddingTicket">派發獎金</span>
          </button>

          <div class="card-footer" @click="handlePeopleCount(item)">
            <span class="timer">⏳ {{ formatTime(item.remainSeconds) }}</span>
            <span class="people">👥 {{ item.treasureAttendanceList.length }}人</span>
            <span class="status-tag">{{ handleStatus(item.status) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCurrencyModal" class="modal-overlay" @click.self="showCurrencyModal = false">
      <div class="modal-card mini">
        <div class="modal-header">
          <h2 class="modal-title">請選擇購買幣別</h2>
        </div>

        <div class="form-group" style="margin-top: 20px">
          <div class="radio-card-group">
            <label
              v-for="c in currentBuyItem?.treasureCurrencyList"
              :key="c.currency"
              class="radio-card"
            >
              <input
                type="radio"
                v-model="selectedBuyCurrency"
                :value="c.currency"
                name="buyCurrency"
              />
              <div class="radio-content" style="padding: 12px">
                <div style="font-size: 1rem; margin-bottom: 4px">{{ c.currency }}</div>
                <div class="gold" style="font-weight: bold">
                  {{ Number(c.amount).toLocaleString() }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-submit" @click="handleConfirmBuy">我要標!</button>
          <button class="btn-cancel" @click="showCurrencyModal = false">取消</button>
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
  </div>
</template>

<style scoped>



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

.gold {
  color: #f5c451;
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
.value {
  color: #f1f5f9;
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

/* Modal 共用樣式 */
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

/* 👇 補齊你原本寫在 TreasureCard 裡的 Radio 樣式 👇 */
.radio-card-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
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
  border-radius: 8px;
  text-align: center;
  color: #94a3b8;
  transition: all 0.2s;
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
  color: #1e293b;
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

.close-btn {
  width: 100%;
  height: 40px;
}

.boss-container {
  background: #1e1e2e;
  height: 60%;
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
}

.boss-title {
  text-align: center;
  color: #fff;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.people-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 15px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}

.people-list::-webkit-scrollbar {
  width: 6px;
}
.people-list::-webkit-scrollbar-thumb {
  background-color: #334155;
  border-radius: 10px;
}

.close-btn,
.modal-footer {
  flex-shrink: 0;
  margin-top: auto;
}
.person-item {
  background: #27293d;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.gold {
  color: #f5c451;
  font-weight: bold;
}
.person-item.is-selected {
  border: 1px solid #6366f1;
  background: rgba(99, 102, 241, 0.1);
}
</style>

<style>
/* SweetAlert2 自定義 (無 scoped) */
.custom-swal-actions {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px;
}
.custom-swal-confirm {
  background: #6366f1 !important;
}
</style>
