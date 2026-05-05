<script setup lang="ts">
import { useAuction } from '@/composables/approvalPage.ts'

const { pendingRequests, handleApproval, loading } = useAuction()
</script>

<template>
  <div class="approval-container">
    <div class="title-wrap">
      <h2 class="title">🙋‍♂️ 人員審核</h2>
      <p class="subtitle">審核新成員的加入申請,點擊「准許」將其加入血盟</p>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-label">待審核申請</span>
        <span class="stat-value">{{ pendingRequests.length }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <span>載入中...</span>
    </div>

    <div v-else-if="pendingRequests.length === 0" class="empty-card">
      <div class="empty-icon">✨</div>
      <div class="empty-text">目前沒有待處理的加入申請</div>
    </div>

    <div v-else class="member-list">
      <div
        v-for="req in pendingRequests"
        :key="req.memberId"
        class="member-card"
      >
        <div class="member-head">
          <div class="avatar">{{ req.userName.charAt(0) }}</div>
          <div class="info">
            <div class="name">{{ req.userName }}</div>
            <div class="role-tag">申請加入</div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-reject" @click="handleApproval(req.memberId, 'REJECT')">
            拒絕
          </button>
          <button class="btn-approve" @click="handleApproval(req.memberId, 'APPROVE')">
            准許加入
          </button>
        </div>
      </div>
    </div>

    <div class="info-box">
      <span class="info-icon">ℹ️</span>
      <span class="info-text">核准後該成員會以「一般成員」職位自動進入血盟名單</span>
    </div>
  </div>
</template>

<style scoped>
/* === 統一規範 ===
   主色: var(--c-light) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.approval-container {
  padding: 32px 16px 80px;
  max-width: 720px;
  margin: 0 auto;
}

/* Header */
.title-wrap {
  text-align: center;
  margin-bottom: 22px;
}
.title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
}

/* Stats */
.stats-row {
  margin-bottom: 18px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-top: 3px solid var(--c-light);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
}
.stat-value {
  color: var(--c-light);
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1.1;
}

/* Empty */
.empty-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px dashed #2e3147;
  border-radius: 16px;
  padding: 56px 20px;
  text-align: center;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #94a3b8;
  font-size: 0.95rem;
}
.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(var(--c-light-rgb), 0.18);
  border-top-color: var(--c-light);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
.empty-icon {
  font-size: 2.4rem;
  margin-bottom: 10px;
  opacity: 0.7;
}
.empty-text {
  color: #64748b;
  font-size: 0.95rem;
}

/* Member 列表 */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 16px;
  padding: 16px 18px 14px;
  transition:
    border-color 0.18s,
    box-shadow 0.2s;
}
.member-card:hover {
  border-color: rgba(var(--c-light-rgb), 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.member-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.avatar {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  background: rgba(var(--c-light-rgb), 0.12);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-light);
  font-weight: 800;
  font-size: 1rem;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  color: #e2e8f0;
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.role-tag {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
}

/* 動作按鈕 */
.actions {
  display: flex;
  gap: 10px;
}
.btn-reject,
.btn-approve {
  height: 40px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.18s;
}
.btn-reject {
  flex: 1;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
}
.btn-reject:hover {
  background: rgba(239, 68, 68, 0.22);
  border-color: rgba(239, 68, 68, 0.7);
  color: #fca5a5;
}
.btn-approve {
  flex: 2;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.3);
}
.btn-approve:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.45);
}

/* Info box */
.info-box {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(var(--c-light-rgb), 0.06);
  border: 1px solid rgba(var(--c-light-rgb), 0.22);
  border-radius: 12px;
}
.info-icon {
  flex-shrink: 0;
  font-size: 1rem;
}
.info-text {
  color: #94a3b8;
  font-size: 0.78rem;
  line-height: 1.5;
}

/* Mobile */
@media (max-width: 480px) {
  .approval-container {
    padding: 24px 14px 80px;
  }
  .member-card {
    padding: 14px 14px 12px;
  }
  .stat-value {
    font-size: 1.4rem;
  }
}
</style>
