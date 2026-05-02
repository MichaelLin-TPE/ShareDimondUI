<script setup lang="ts">
import { useAuction } from '@/composables/shareAmount.ts'

const {
  handleConfirm,
  allocatedAmount,
  balance,
  selectedCurrency,
  searchQuery,
  selectedCurrencyBalance,
  remaining,
  progressPercent,
  isOverallocated,
  groupedMembers,
} = useAuction()

const roleIcon = (role: string) => {
  if (role === '會長') return '👑'
  if (role === '幹部') return '⭐'
  return '👤'
}
</script>

<template>
  <div class="fund-page">
    <div class="content-wrapper">
      <!-- Header -->
      <header class="page-header">
        <h1 class="title">💰 基金撥款</h1>
        <p class="subtitle">使用批次工具快速分配，也可手動微調</p>
      </header>

      <!-- Step 1: 幣種 -->
      <section class="step-card">
        <div class="step-head">
          <span class="step-num">1</span>
          <h3>選擇幣種</h3>
        </div>
        <div class="currency-chips">
          <button
            v-for="item in balance.balanceList"
            :key="item.currency"
            class="chip"
            :class="{ active: selectedCurrency === item.currency }"
            @click="selectedCurrency = item.currency"
          >
            {{ item.currency }}
            <span class="chip-bal">{{ Number(item.balance).toLocaleString() }}</span>
          </button>
        </div>
      </section>

      <!-- Step 2: 金庫狀態 -->
      <section v-if="selectedCurrency" class="stats-card">
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-label">金庫總額</div>
            <div class="stat-value gold">{{ selectedCurrencyBalance.toLocaleString() }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">已分配</div>
            <div class="stat-value" :class="{ warn: isOverallocated }">
              {{ allocatedAmount.toLocaleString() }}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">剩餘</div>
            <div class="stat-value" :class="{ danger: isOverallocated }">
              {{ remaining.toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="{ warn: isOverallocated }"
            :style="{ width: Math.min(100, progressPercent) + '%' }"
          ></div>
        </div>
        <div class="progress-text">
          {{ progressPercent.toFixed(1) }}%
          <span v-if="isOverallocated" class="danger"> ⚠ 已超額</span>
        </div>
      </section>

      <!-- Step 2: 成員清單 -->
      <section v-if="selectedCurrency" class="step-card">
        <div class="step-head">
          <span class="step-num">2</span>
          <h3>設定每位成員金額</h3>
        </div>

        <input v-model="searchQuery" class="search-input" placeholder="🔍 搜尋成員名稱..." />

        <div class="members-list">
          <div v-for="group in groupedMembers" :key="group.role" class="role-group">
            <div class="group-header">
              <span class="group-icon">{{ roleIcon(group.role) }}</span>
              <span class="group-name">{{ group.role }}</span>
              <span class="group-count">{{ group.members.length }} 人</span>
            </div>

            <div
              v-for="member in group.members"
              :key="member.memberId"
              class="member-row"
              :class="{ 'has-amount': (member.memberAmount || 0) > 0 }"
            >
              <span class="member-name">{{ member.memberName }}</span>
              <input
                v-model.number="member.memberAmount"
                type="number"
                class="member-input"
                placeholder="0"
              />
            </div>
          </div>

          <div v-if="groupedMembers.length === 0" class="empty">
            {{ searchQuery ? '找不到符合搜尋的成員' : '尚無成員' }}
          </div>
        </div>
      </section>

      <!-- 確認按鈕 -->
      <div v-if="selectedCurrency" class="footer-actions">
        <button
          class="btn-primary"
          :disabled="allocatedAmount <= 0 || isOverallocated"
          @click="handleConfirm"
        >
          💸 確認發放
          <span v-if="allocatedAmount > 0">
            ({{ allocatedAmount.toLocaleString() }} {{ selectedCurrency }})
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fund-page {
  background: #0f111a;
  min-height: 100vh;
  color: #e2e8f0;
  padding: 24px 16px 48px;
  display: flex;
  justify-content: center;
}

.content-wrapper {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header */
.page-header {
  text-align: center;
  margin-bottom: 4px;
}
.title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 4px;
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.subtitle {
  font-size: 0.82rem;
  color: #64748b;
  margin: 0;
}

/* Step Card */
.step-card {
  background: #1a1c26;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 18px 16px;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f5c451, #a855f7);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-head h3 {
  margin: 0;
  font-size: 1rem;
  color: #f1f5f9;
}

/* Currency Chips */
.currency-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  flex: 1;
  min-width: 0;
  padding: 12px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  transition: all 0.15s;
}
.chip:hover {
  border-color: #f5c451;
  color: #e2e8f0;
}
.chip.active {
  background: rgba(245, 196, 81, 0.15);
  border-color: #a855f7;
  color: #fff;
  box-shadow: 0 0 14px rgba(168, 85, 247, 0.25);
}
.chip-bal {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 500;
}
.chip.active .chip-bal {
  color: #ffd166;
}

/* Stats Card */
.stats-card {
  background: linear-gradient(135deg, #1e2030, #2d3047);
  border: 1px solid #3d405b;
  border-radius: 16px;
  padding: 18px 16px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.stat {
  text-align: center;
}
.stat-label {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 1.15rem;
  font-weight: 800;
  color: #e2e8f0;
}
.stat-value.gold { color: #ffd166; }
.stat-value.warn { color: #f87171; }
.stat-value.danger { color: #f87171; }

.progress-track {
  height: 8px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 100px;
  overflow: hidden;
  margin-bottom: 6px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f5c451, #a855f7);
  border-radius: 100px;
  transition: width 0.3s ease;
}
.progress-fill.warn {
  background: linear-gradient(90deg, #ef4444, #f97316);
}
.progress-text {
  font-size: 0.75rem;
  color: #94a3b8;
  text-align: right;
}
.progress-text .danger {
  color: #f87171;
  font-weight: 700;
}

/* Search */
.search-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 12px;
}
.search-input:focus {
  border-color: #f5c451;
}

/* Members */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.role-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}
.group-icon { font-size: 0.95rem; }
.group-name { flex: 1; }
.group-count {
  color: #64748b;
  font-size: 0.72rem;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  transition: all 0.15s;
}
.member-row.has-amount {
  border-color: rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.05);
}
.member-name {
  flex: 1;
  font-size: 0.92rem;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-input {
  width: 110px;
  background: #0a0e1a;
  border: 1px solid #334155;
  color: #ffd166;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: right;
  outline: none;
}
.member-input:focus {
  border-color: #a855f7;
}

.empty {
  text-align: center;
  padding: 24px;
  color: #475569;
  font-size: 0.85rem;
}

/* Footer */
.footer-actions {
  padding-top: 8px;
}
.btn-primary {
  width: 100%;
  height: 54px;
  border-radius: 14px;
  border: none;
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
  background: linear-gradient(135deg, #ffd166, #e6b800);
  color: #0f111a;
  box-shadow: 0 6px 20px rgba(255, 209, 102, 0.25);
  transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(255, 209, 102, 0.35);
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(0.3);
}

/* RWD */
@media (max-width: 480px) {
  .member-input { width: 90px; font-size: 0.85rem; }
}
</style>
