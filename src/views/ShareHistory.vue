<script setup lang="ts">
import { useAuction } from '@/composables/shareHistory'

const {
  roleTextMap,
  formatEventTime,
  selectedStatus,
  toggleStatus,
  filteredAuctions,
  searchQuery,
} = useAuction()
</script>

<template>
  <div class="event-container">
    <div class="filter-section">
      <div class="search-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋紀錄內容..."
          class="search-input"
        />
      </div>

      <div class="status-tags">
        <span
          class="status-tag tag-open"
          :class="{ 'is-active': selectedStatus === 'OPEN_TICKET' }"
          @click="toggleStatus('OPEN_TICKET')"
          >開啟工單</span
        >
        <span
          class="status-tag tag-delete"
          :class="{ 'is-active': selectedStatus === 'DELETE_TICKET' }"
          @click="toggleStatus('DELETE_TICKET')"
          >刪除工單</span
        >
        <span
          class="status-tag tag-bid"
          :class="{ 'is-active': selectedStatus === 'BIDDING' }"
          @click="toggleStatus('BIDDING')"
          >參與競標</span
        >
        <span
          class="status-tag tag-wait"
          :class="{ 'is-active': selectedStatus === 'WAIT_PAY' }"
          @click="toggleStatus('WAIT_PAY')"
          >等待支付</span
        >
        <span
          class="status-tag tag-share"
          :class="{ 'is-active': selectedStatus === 'COMPLETE_SHARE' }"
          @click="toggleStatus('COMPLETE_SHARE')"
          >完成分配</span
        >
        <span
          class="status-tag tag-join"
          :class="{ 'is-active': selectedStatus === 'JOIN_SHARE' }"
          @click="toggleStatus('JOIN_SHARE')"
          >加入分配</span
        >
        <span
          class="status-tag tag-create"
          :class="{ 'is-active': selectedStatus === 'CREATE_ITEM' }"
          @click="toggleStatus('CREATE_ITEM')"
          >新增項目</span
        >
        <span
          class="status-tag tag-remark"
          :class="{ 'is-active': selectedStatus === 'UPDATE_REMARK' }"
          @click="toggleStatus('UPDATE_REMARK')"
          >更新備註</span
        >
        <span
          class="status-tag tag-clan"
          :class="{ 'is-active': selectedStatus === 'UPDATE_CLAN_BALANCE' }"
          @click="toggleStatus('UPDATE_CLAN_BALANCE')"
          >血盟餘額</span
        >
        <span
          class="status-tag tag-share-balance"
          :class="{ 'is-active': selectedStatus === 'SHARE_CLAN_BALANCE' }"
          @click="toggleStatus('SHARE_CLAN_BALANCE')"
          >基金分配</span
        >
      </div>
    </div>

    <div class="event-grid">
      <div v-for="item in filteredAuctions" :key="item.createTime" class="event-card">
        <div class="event-role">
          {{ roleTextMap[item.role] }}
        </div>
        <div class="event-content">
          {{ item.eventContent }}
        </div>
        <div class="event-time">
          {{ formatEventTime(item.createTime) }}
        </div>
      </div>

      <div v-if="filteredAuctions.length === 0" class="no-data">找不到符合條件的紀錄</div>
    </div>
  </div>
</template>

<style scoped>
.no-data {
  grid-column: 1 / -1; /* 跨越所有網格列 */
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
}

/* ===== 新增搜尋與狀態列樣式 ===== */
.filter-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background: #1a1c26;
  border: 1px solid #32354a;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: #ffd166;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: opacity 0.2s;
}

.status-tag:hover {
  opacity: 0.8;
}

/* 狀態顏色分配 */
.tag-open {
  background: #4a90e2;
  color: #fff;
} /* 藍色 */
.tag-delete {
  background: #e74c3c;
  color: #fff;
} /* 紅色 */
.tag-bid {
  background: #f39c12;
  color: #fff;
} /* 橙色 */
.tag-wait {
  background: #9b59b6;
  color: #fff;
} /* 紫色 */
.tag-share {
  background: #2ecc71;
  color: #fff;
} /* 綠色 */
.tag-join {
  background: #16a085;
  color: #fff;
} /* 深綠 */
.tag-create {
  background: #34495e;
  color: #fff;
} /* 灰藍 */
.tag-remark {
  background: #7f8c8d;
  color: #fff;
} /* 灰色 */
.tag-clan {
  background: #d35400;
  color: #fff;
} /* 磚紅 */
.tag-share-balance {
  background: #8c9191;
  color: #fff;
} /* 磚紅 */

/* 手機版微調 */
@media (max-width: 600px) {
  .status-tag {
    flex: 1 1 calc(33.33% - 8px); /* 手機上一行三個 */
    text-align: center;
  }
}

/* ===== 外層留白（重點） ===== */
.event-container {
  padding: 16px; /* 👈 不再黏邊 */
}

/* ===== 兩個一行 ===== */
.event-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 👈 一行兩個 */
  gap: 14px;
}

/* ===== 卡片 ===== */
.event-card {
  background: linear-gradient(180deg, #161822, #0f111a);
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.event-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
}

/* ===== ROLE ===== */
.event-role {
  font-size: 13px;
  font-weight: 600;
  color: #ffd166;
  margin-bottom: 6px;
}

/* ===== 內容 ===== */
.event-content {
  font-size: 15px;
  color: #ffffff;
  margin-bottom: 6px;
  line-height: 1.4;
}
.event-content {
  white-space: pre-line;
}

/* ===== 時間 ===== */
.event-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

/* ===== 手機自動變一行一個 ===== */
@media (max-width: 600px) {
  .event-grid {
    grid-template-columns: 1fr;
  }
}
</style>
