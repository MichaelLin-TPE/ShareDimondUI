<script setup lang="ts">
import { useAuction } from '@/composables/allMemberBalance.ts'

const { isLive, formatNumber, getRawBalance, totalStats, allCurrencies,memberList } =
  useAuction()
</script>

<template>
  <div class="guild-master-dashboard">
    <section class="summary-row">
      <div class="card total-card" v-for="currency in allCurrencies" :key="currency">
        <div class="label">全體總 {{ currency }}</div>
        <div class="value">{{ formatNumber(totalStats[currency] ?? 0) }}</div>
      </div>

      <div class="card member-count">
        <div class="label">成員總數</div>
        <div class="value">{{ memberList.length }} <small>人</small></div>
      </div>
    </section>

    <section class="list-container">
      <div class="table-header">
        <div class="title-group">
          <h2>會長管理面板 - 資產監控</h2>
          <span class="project-tag">GameShare System</span>
        </div>
        <div class="refresh-tag" v-if="isLive">● 即時數據同步中 (WS)</div>
      </div>

      <div class="table-responsive">
        <table class="wallet-table">
          <thead>
            <tr>
              <th class="text-left">UID</th>
              <th class="text-left">成員名稱</th>
              <th v-for="currency in allCurrencies" :key="currency" class="text-right">
                {{ currency }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in memberList" :key="user.userId">
              <td class="uid">#{{ user.userId }}</td>
              <td class="username">{{ user.userName }}</td>

              <td v-for="currency in allCurrencies" :key="currency" class="balance-cell">
                <span :class="{ 'has-value': getRawBalance(user, currency) > 0 }">
                  {{ formatNumber(getRawBalance(user, currency)) }}
                </span>
              </td>


            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 全域容器樣式 */
.guild-master-dashboard {
  padding: 24px;
  background: #121212; /* 更深的暗黑模式背景 */
  color: #e0e0e0;
  min-height: 100vh;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* 總結卡片佈局 */
.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  flex: 1;
  min-width: 200px;
  background: #1e1e1e;
  padding: 20px;
  border-radius: 12px;
  border-bottom: 4px solid #3498db;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.total-card {
  border-bottom-color: #f1c40f;
} /* 強化金幣感 */

.label {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
}

/* 清單容器樣式 */
.list-container {
  background: #1e1e1e;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
  border-bottom: 1px solid #333;
  padding-bottom: 16px;
}

.project-tag {
  font-size: 0.75rem;
  background: #333;
  padding: 2px 8px;
  border-radius: 4px;
  color: #4a90e2;
}

.refresh-tag {
  color: #2ecc71;
  font-size: 0.8rem;
  font-weight: bold;
  animation: blink 2s infinite;
}

/* 表格樣式優化 */
.table-responsive {
  overflow-x: auto;
}

.wallet-table {
  width: 100%;
  border-collapse: collapse;
}

.wallet-table th {
  padding: 12px 16px;
  color: #888;
  font-weight: 500;
  border-bottom: 2px solid #333;
}

.wallet-table td {
  padding: 16px;
  border-bottom: 1px solid #2a2a2a;
}

.uid {
  color: #555;
  font-family: 'Courier New', monospace;
}
.username {
  font-weight: 600;
  color: #fff;
}

.balance-cell {
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #666; /* 預設 0 的顏色較淡 */
}

.has-value {
  color: #f1c40f; /* 有錢的幣種亮金色 */
  font-weight: 500;
}

/* 操作按鈕 */
.actions {
  text-align: center;
  white-space: nowrap;
}

button {
  margin: 0 4px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-history {
  background: #333;
  color: #bbb;
}
.btn-history:hover {
  background: #444;
  color: #fff;
}

.btn-edit {
  background: #4a90e2;
  color: #fff;
}
.btn-edit:hover {
  background: #357abd;
  box-shadow: 0 0 10px rgba(74, 144, 226, 0.4);
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
  }
}

.text-right {
  text-align: right;
}
.text-center {
  text-align: center;
}
.text-left {
  text-align: left;
}
</style>
