<script setup lang="ts">
import { useAuction } from '@/composables/withdraw_verify.ts'
// 靜態資料
const { mockRequests, totalAmount, withdrawHistoryList, handleAction } = useAuction()
</script>

<template>
  <div class="audit-container">
    <div class="header-section">
      <h2 class="title">提款審核大廳</h2>
      <p class="subtitle">管理所有成員的提領請求，請審慎核對金幣來源與用途</p>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <span class="label">待審核項目</span>
        <span class="value warning">{{ withdrawHistoryList.length }}</span>
      </div>
      <div class="stat-card">
        <span class="label">待撥款總額</span>
        <span class="value">{{ totalAmount }}</span>
      </div>
    </div>

    <div class="audit-card">
      <div class="tab-header">
        <div class="tab active">待審核</div>
        <div class="tab">已核准</div>
        <div class="tab">已駁回</div>
      </div>

      <div class="request-list">
        <div v-for="req in withdrawHistoryList" :key="req.ticketCode" class="request-item">
          <div class="requester-info">
            <div class="avatar">{{ req.requestUserName.charAt(0) }}</div>
            <div class="details">
              <div class="name">{{ req.requestUserName }}</div>
              <div class="request-time">{{ req.createTime }}</div>
            </div>
          </div>

          <div class="request-content">
            <div class="amount">💰 {{ req.requestAmount.toLocaleString() }}</div>
            <div class="memo">" {{ req.remark }} "</div>
          </div>

          <div class="audit-actions">
            <button class="btn-reject" @click="handleAction(req.ticketCode, 'reject')">核准</button>
            <button class="btn-approve" @click="handleAction(req.ticketCode, 'approve')">
              核准
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-container {
  padding: 40px 24px;
  max-width: 1000px; /* 寬度放大，與管理頁面一致 */
  margin: 0 auto;
}

.header-section {
  margin-bottom: 32px;
}
.title {
  color: #fff;
  font-size: 28px;
  margin-bottom: 8px;
}
.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

/* 統計資訊 */
.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
}
.stat-card {
  flex: 1;
  background: #161822;
  border: 1px solid #24263a;
  padding: 20px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}
.stat-card .label {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  margin-bottom: 8px;
}
.stat-card .value {
  color: #fff;
  font-size: 24px;
  font-weight: 800;
}
.stat-card .value.warning {
  color: #ffd166;
}

/* 審核卡片 */
.audit-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px;
  overflow: hidden;
}

.tab-header {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid #24263a;
}
.tab {
  padding: 16px 32px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tab.active {
  color: #ffd166;
  border-bottom-color: #ffd166;
  background: rgba(255, 209, 102, 0.05);
}

/* 列表項目 */
.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid #24263a;
}

.requester-info {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 200px;
}
.avatar {
  width: 44px;
  height: 44px;
  background: #24263a;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffd166;
  font-weight: bold;
}
.name {
  color: #fff;
  font-weight: 600;
  font-size: 16px;
}
.request-time {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
}

.request-content {
  flex: 1;
  text-align: left;
  padding: 0 40px;
}
.amount {
  color: #ffd166;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}
.memo {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-style: italic;
}

/* 按鈕動作 */
.audit-actions {
  display: flex;
  gap: 12px;
}
.btn-approve,
.btn-reject {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-approve {
  background: linear-gradient(135deg, #00ff88, #00bd65);
  color: #0f111a;
}
.btn-reject {
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid #ff4d4d;
  color: #ff4d4d;
}
.btn-approve:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
}
.btn-reject:hover {
  background: #ff4d4d;
  color: #fff;
}
</style>
