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

          <div class="price">底價：{{ item.lowestPrice.toLocaleString() }} 元寶</div>
          <div class="price">目前最高：{{ item.currentPrice }} 元寶</div>

          <div class="bidder">最高者：{{ item.biddingName }}</div>

          <div class="bid-control">
            <button class="reduce-button" @click="handleReduce(item)">-</button>
            <span class="myBid">{{ item.biddingPrice }}</span>
            <button class="plus-button" @click="handlePlus(item)">+</button>
          </div>

          <button class="submit-btn" :disabled="canSubmit(item)" @click="handleSubmit(item)">
            <span v-if="item.isBidding">我要出價</span>

            <span v-else-if="item.disableSubmitButton">結束競標</span>

            <span v-else-if="item.canVerifyBiddingTicket">已拿到帳款,可派發獎金</span>
          </button>

          <div class="meta">
            ⏳ {{ formatTime(item.remainSeconds) }} 👥 {{ item.treasureAttendanceList.length }} 人
            🔥{{ handleStatus(item.status) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



<style scoped>

.item-name{
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

.whole_page {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.meta {
  margin-top: 15px;
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
