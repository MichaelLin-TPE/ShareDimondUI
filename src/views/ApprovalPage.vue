<script setup lang="ts">
import { useAuction } from '@/composables/approvalPage.ts'

const { pendingRequests, handleApproval } = useAuction()
// 模擬待審核資料
</script>

<template>
  <div class="admin-container">
    <div class="header-section">
      <h2 class="title">人員加入審核</h2>
      <p class="subtitle">審核新成員的加入申請：點擊「准許」將其加入聯盟</p>
    </div>

    <div class="management-card">
      <div class="search-bar flex justify-between items-center">
        <span class="text-sm text-gray-400">
          待處理申請：<span class="text-indigo-400 font-bold">{{ pendingRequests.length }}</span> 筆
        </span>
      </div>

      <div class="member-list">
        <div v-if="pendingRequests.length === 0" class="empty-state">
          <div class="empty-icon">✨</div>
          <p>暫無待處理的申請資料</p>
        </div>

        <div v-for="request in pendingRequests" :key="request.memberId" class="member-item">
          <div class="member-info">
            <div class="avatar">{{ request.userName.charAt(0) }}</div>
            <div class="details">
              <div class="name">{{ request.userName }}</div>
            </div>
          </div>

          <div class="role-actions">
            <button
              class="action-btn btn-approve"
              @click="handleApproval(request.memberId, 'APPROVE')"
            >
              准許加入
            </button>
            <button
              class="action-btn btn-reject"
              @click="handleApproval(request.memberId, 'REJECT')"
            >
              拒絕
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="info-box">
      <div class="info-icon">ℹ️</div>
      <div class="info-text">注意：核准後，該成員將以「一般成員」職位自動進入聯盟清單。</div>
    </div>
  </div>
</template>

<style scoped>
/* 直接引用你原本 Page 的變數與結構 */
.admin-container {
  padding: 40px 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 24px;
}
.title {
  color: #fff;
  font-size: 24px;
  margin-bottom: 4px;
}
.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.management-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.search-bar {
  padding: 16px 32px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid #24263a;
}

.member-list {
  max-height: 500px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid #24263a;
}

.member-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.member-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #6366f1, #4338ca);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.name {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}
.apply-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  margin-top: 4px;
}

/* 按鈕風格統一樣式 */
.role-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 8px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #2d3047;
}

/* 准許按鈕：使用類似「幹部」的亮眼色系，但改為青藍色調 */
.btn-approve {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
  border: none;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}

.btn-approve:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(16, 185, 129, 0.4);
}

/* 拒絕按鈕：深色背景紅框，低調但不失警示 */
.btn-reject {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-reject:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
}

.empty-state {
  padding: 60px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.info-box {
  margin-top: 20px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.info-text {
  color: #a5b4fc;
  font-size: 12px;
}
</style>
