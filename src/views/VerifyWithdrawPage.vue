<script setup lang="ts">
import { useAuction } from '@/composables/withdraw_verify.ts'

const { totalAmount, withdrawHistoryList, handleAction } = useAuction()
</script>

<template>
  <div class="audit-container">
    <div class="title-wrap">
      <h2 class="title">📤 提款審核大廳</h2>
      <p class="subtitle">審慎核對金額來源與用途,確認無誤後撥款給成員</p>
    </div>

    <div class="stats-row">
      <div class="stat-card pending">
        <span class="stat-label">待審核項目</span>
        <span class="stat-value">{{ withdrawHistoryList.length }}</span>
      </div>
      <div class="stat-card amount">
        <span class="stat-label">待撥款總額</span>
        <span class="stat-value">{{ totalAmount }}</span>
      </div>
    </div>

    <div v-if="withdrawHistoryList.length === 0" class="empty-card">
      <div class="empty-icon">✅</div>
      <div class="empty-text">目前沒有待審核的提款申請</div>
    </div>

    <div v-else class="request-list">
      <div
        v-for="req in withdrawHistoryList"
        :key="req.ticketCode"
        class="request-card"
      >
        <div class="request-head">
          <div class="avatar">{{ req.requestUserName.charAt(0) }}</div>
          <div class="info">
            <div class="name">{{ req.requestUserName }}</div>
            <div class="time">{{ req.createTime }}</div>
          </div>
          <div class="amount-block">
            <span class="amount-currency">{{ req.currency }}</span>
            <span class="amount-value">${{ req.requestAmount.toLocaleString() }}</span>
          </div>
        </div>

        <div v-if="req.remark" class="memo">
          <span class="memo-icon">💬</span>
          <span class="memo-text">{{ req.remark }}</span>
        </div>

        <div class="actions">
          <button class="btn-reject" @click="handleAction(req.ticketCode, 'reject')">
            拒絕
          </button>
          <button class="btn-approve" @click="handleAction(req.ticketCode, 'approve')">
            核准撥款
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 統一規範(同 LoginView / CreateGuild / TransferPage / WithdrawPage)===
   主色: var(--c-light) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.audit-container {
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
    0 0 8px rgba(var(--c-light-rgb), 0.45),
    0 2px 12px rgba(var(--c-deep-rgb), 0.2);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
}

/* === 統計卡 === */
.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
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
  color: #e2e8f0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1.1;
}
.stat-card.pending {
  border-top: 3px solid var(--c-light);
}
.stat-card.pending .stat-value {
  color: var(--c-light);
}
.stat-card.amount {
  border-top: 3px solid rgba(255, 255, 255, 0.18);
}

/* === Empty === */
.empty-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px dashed #2e3147;
  border-radius: 16px;
  padding: 56px 20px;
  text-align: center;
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

/* === Request 列表 === */
.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 16px;
  padding: 16px 18px 14px;
  transition:
    border-color 0.18s,
    box-shadow 0.2s;
}
.request-card:hover {
  border-color: rgba(var(--c-light-rgb), 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

/* Head:頭像 + 名稱 + 金額 */
.request-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.avatar {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  background: rgba(var(--c-light-rgb), 0.12);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-light);
  font-weight: 800;
  font-size: 0.95rem;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  color: #e2e8f0;
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.time {
  color: #64748b;
  font-size: 0.78rem;
  margin-top: 1px;
}

.amount-block {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.amount-currency {
  display: inline-block;
  padding: 1px 8px;
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.amount-value {
  color: var(--c-light);
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* 備註 */
.memo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  margin-bottom: 12px;
}
.memo-icon {
  font-size: 0.8rem;
  flex-shrink: 0;
  opacity: 0.7;
}
.memo-text {
  color: #94a3b8;
  font-size: 0.85rem;
  line-height: 1.4;
  word-break: break-word;
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

/* === Mobile === */
@media (max-width: 480px) {
  .audit-container {
    padding: 24px 14px 80px;
  }
  .stats-row {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .stat-value {
    font-size: 1.4rem;
  }
  .request-card {
    padding: 14px 14px 12px;
  }
  .request-head {
    flex-wrap: wrap;
    gap: 10px;
  }
  .amount-block {
    margin-left: auto;
  }
}
</style>
