<script setup lang="ts">
import { useAuction } from '@/composables/allMemberBalance.ts'

const { isLive, formatNumber, getRawBalance, totalStats, allCurrencies, memberList } =
  useAuction()
</script>

<template>
  <div class="balance-container">
    <div class="title-wrap">
      <h2 class="title">💳 成員資產監控</h2>
      <div class="subtitle-row">
        <span class="subtitle">查看所有成員的多幣別錢包餘額</span>
        <span v-if="isLive" class="live-tag">
          <span class="live-dot"></span>
          即時同步
        </span>
      </div>
    </div>

    <!-- 統計卡 -->
    <section class="stats-grid">
      <div v-for="currency in allCurrencies" :key="currency" class="stat-card">
        <div class="stat-label">全體 {{ currency }}</div>
        <div class="stat-value gold">{{ formatNumber(totalStats[currency] ?? 0) }}</div>
      </div>
      <div class="stat-card members">
        <div class="stat-label">成員總數</div>
        <div class="stat-value">
          {{ memberList.length }}<span class="unit">人</span>
        </div>
      </div>
    </section>

    <!-- 成員清單 -->
    <section class="list-card">
      <div class="list-head">
        <h3 class="list-title">成員清單</h3>
        <span class="list-count">{{ memberList.length }} 位成員</span>
      </div>

      <div class="table-wrap">
        <table class="balance-table">
          <thead>
            <tr>
              <th class="text-left">UID</th>
              <th class="text-left">成員</th>
              <th
                v-for="currency in allCurrencies"
                :key="currency"
                class="text-right"
              >
                {{ currency }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in memberList" :key="user.userId">
              <td class="cell-uid">#{{ user.userId }}</td>
              <td class="cell-name">{{ user.userName }}</td>
              <td
                v-for="currency in allCurrencies"
                :key="currency"
                class="cell-balance"
              >
                <span :class="{ 'has-value': getRawBalance(user, currency) > 0 }">
                  {{ formatNumber(getRawBalance(user, currency)) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="memberList.length === 0" class="empty">
        <div class="empty-icon">👥</div>
        <div class="empty-text">目前沒有成員資料</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* === 統一規範 ===
   主色: var(--c-light) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.balance-container {
  padding: 32px 16px 80px;
  max-width: 1100px;
  margin: 0 auto;
}

/* Header */
.title-wrap {
  text-align: center;
  margin-bottom: 22px;
}
.title {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.subtitle-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
}
.live-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.35);
  color: #6ee7b7;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00ff88;
  animation: live-pulse 1.5s infinite;
}
@keyframes live-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(0, 255, 136, 0);
  }
}

/* Stats — 用 flex 讓卡片寬度依內容自動伸縮 */
.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}
.stat-card {
  flex: 1 1 auto;
  min-width: 180px;
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-top: 3px solid var(--c-light);
  border-radius: 14px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}
.stat-card.members {
  border-top-color: rgba(255, 255, 255, 0.18);
}
.stat-label {
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.stat-value {
  color: #e2e8f0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  line-height: 1.1;
  font-family: 'Consolas', 'Monaco', monospace;
  white-space: nowrap;
  overflow-wrap: break-word;
  word-break: break-all;
}
.stat-value.gold {
  color: var(--c-light);
}
.unit {
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 600;
  margin-left: 4px;
}

/* List card */
.list-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 16px;
  padding: 22px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.list-title {
  margin: 0;
  font-size: 1.15rem;
  color: #e2e8f0;
  font-weight: 700;
}
.list-count {
  font-size: 0.9rem;
  color: #94a3b8;
}

/* Table */
.table-wrap {
  overflow-x: auto;
}
.balance-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}
.balance-table th {
  padding: 14px 14px;
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #24263a;
  position: sticky;
  top: 0;
  background: rgba(22, 24, 34, 0.95);
}
.balance-table td {
  padding: 16px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 1rem;
}
.balance-table tbody tr:hover {
  background: rgba(var(--c-light-rgb), 0.04);
}
.balance-table tbody tr:last-child td {
  border-bottom: none;
}
.cell-uid {
  color: #64748b;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.92rem;
}
.cell-name {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 1rem;
}
.cell-balance {
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #475569;
  font-size: 1rem;
}
.cell-balance .has-value {
  color: var(--c-light);
  font-weight: 700;
}

.text-right {
  text-align: right;
}
.text-left {
  text-align: left;
}

/* Empty */
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}
.empty-icon {
  font-size: 2.4rem;
  margin-bottom: 10px;
  opacity: 0.6;
}
.empty-text {
  font-size: 0.95rem;
}

/* Mobile */
@media (max-width: 480px) {
  .balance-container {
    padding: 24px 12px 60px;
  }
  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .stat-card {
    padding: 16px 14px;
  }
  .stat-value {
    font-size: 1.6rem;
  }
  .balance-table th,
  .balance-table td {
    padding: 12px 10px;
  }
}
</style>
