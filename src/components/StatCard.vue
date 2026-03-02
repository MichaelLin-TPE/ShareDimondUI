<script setup lang="ts">
import { useAuction } from '@/composables/statCard.ts'

const {
  auctions,
  formatTime,
  handleStatus,
  handlePlus,
  handleSubmit,
  handleDeleteItem,
  handleReduce,
  canSubmit,
  // 新增以下解構
  showPeopleList,
  getJoinList,
  formatTimestamp,
  handlePeopleCount,
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
          <div class="item-name gold">{{ item.itemName }}</div>

          <div class="price">底價：{{ item.lowestPrice.toLocaleString() }} {{ item.currency }}</div>
          <div class="price">目前最高：{{ item.currentPrice }} {{ item.currency }}</div>

          <div class="bidder">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <span class="status-label">目前競標玩家：</span>
              <span class="status-value">{{ item.biddingMemberContent}}</span>
            </template>

            <template v-else> 出價者：{{ item.biddingName }} </template>
          </div>
          <div class="bidder">
            <template v-if="item.treasureType === 'RANDOM_BUYER'">
              <span class="status-label">得標者：</span>
              <span class="status-value">{{ item.biddingName }}</span>
            </template>
          </div>

          <div v-if="item.treasureType !== 'RANDOM_BUYER'" class="bid-control">
            <button class="reduce-button" @click="handleReduce(item)">-</button>
            <span class="myBid">{{ item.biddingPrice }}</span>
            <button class="plus-button" @click="handlePlus(item)">+</button>
          </div>

          <button class="submit-btn" :disabled="canSubmit(item)" @click="handleSubmit(item)">
            <span v-if="item.isBidding">
              <template v-if="item.treasureType === 'RANDOM_BUYER'">我要標此物品</template>
              <template v-else>我要出價</template>
            </span>

            <span v-else-if="item.disableSubmitButton">結束競標</span>

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
</template>

<style scoped>
/* 原有的樣式保持不變 */
.item-name {
  font-size: 20px;
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
  margin-top: 10px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
}

.auction-scroll::-webkit-scrollbar {
  height: 6px;
}

.auction-scroll::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 10px;
  transition: background-color 0.3s;
}

.auction-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(180, 110, 255, 0.5);
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
  background: linear-gradient(135deg, #6cf2ff, #b46eff);
  color: #0b0f1a;
  padding: 10px;
  border-radius: 8px;
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
