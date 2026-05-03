<script setup lang="ts">
import { useAttendance } from '@/composables/attendance'

const {
  RANGE_OPTIONS,
  range,
  loading,
  error,
  members,
  totalTreasures,
  rangeText,
  setRange,
  load,
  rateColor,
  roleLabel,
} = useAttendance()
</script>

<template>
  <div class="att-container">
    <div class="title-wrap">
      <h2 class="title">📊 出席率</h2>
      <p class="subtitle">統計每位成員的開單參與情況 · 全血盟可看</p>
    </div>

    <!-- 時段切換 -->
    <div class="range-tabs">
      <div class="range-group">
        <button
          v-for="opt in RANGE_OPTIONS"
          :key="opt.value"
          class="range-btn"
          :class="{ active: range === opt.value }"
          :disabled="loading"
          @click="setRange(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <button class="refresh-btn" @click="load" :disabled="loading" title="重新整理">
        🔄
      </button>
    </div>

    <!-- 摘要卡 -->
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">統計範圍</div>
        <div class="stat-value range-text">{{ rangeText || '—' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">期間總開單</div>
        <div class="stat-value">{{ totalTreasures }}<span class="unit">張</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">統計人數</div>
        <div class="stat-value">{{ members.length }}<span class="unit">人</span></div>
      </div>
    </section>

    <!-- 排行榜 -->
    <section class="list-card">
      <div class="list-head">
        <h3 class="list-title">出席排行</h3>
        <span class="list-count">依出席率高至低</span>
      </div>

      <div v-if="loading" class="state state-loading">載入中...</div>
      <div v-else-if="error" class="state state-error">{{ error }}</div>
      <div v-else-if="!members.length" class="state state-empty">
        <div class="state-emoji">📭</div>
        <div>沒有資料</div>
      </div>

      <div v-else class="table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th class="col-member">成員</th>
              <th class="col-attended text-right">出席</th>
              <th class="col-total text-right">總單</th>
              <th class="col-rate text-right">出席率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in members" :key="m.memberId" :class="{ 'row-top': i < 3 }">
              <td class="col-rank">
                <span v-if="i === 0" class="medal gold-m">🥇</span>
                <span v-else-if="i === 1" class="medal silver">🥈</span>
                <span v-else-if="i === 2" class="medal bronze">🥉</span>
                <span v-else class="rank-num">{{ i + 1 }}</span>
              </td>
              <td class="col-member">
                <div class="member-cell">
                  <span class="member-name">{{ m.userName }}</span>
                  <span :class="['role-chip', `role-${m.role.toLowerCase()}`]">
                    {{ roleLabel(m.role) }}
                  </span>
                </div>
              </td>
              <td class="col-attended text-right">
                <strong>{{ m.attended }}</strong>
              </td>
              <td class="col-total text-right muted">{{ m.total }}</td>
              <td class="col-rate text-right">
                <div class="rate-cell">
                  <div class="rate-bar">
                    <div
                      class="rate-fill"
                      :class="rateColor(m.attendanceRate)"
                      :style="{ width: m.attendanceRate + '%' }"
                    ></div>
                  </div>
                  <span class="rate-num" :class="rateColor(m.attendanceRate)">
                    {{ m.attendanceRate }}%
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.att-container {
  padding: 24px 18px 60px;
  max-width: 960px;
  margin: 0 auto;
}

/* Header */
.title-wrap {
  text-align: center;
  margin-bottom: 18px;
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

/* Range tabs — segmented control 群組 + 獨立 refresh */
.range-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.range-group {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 4px;
  gap: 0;
}
.range-btn {
  min-width: 72px;
  height: 32px;
  padding: 0 16px;
  background: transparent;
  border: none;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.range-btn:hover:not(:disabled):not(.active) {
  color: var(--c-light);
}
.range-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.range-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.refresh-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.refresh-btn:hover:not(:disabled) {
  border-color: rgba(var(--c-light-rgb), 0.4);
  color: var(--c-light);
}
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
.stat-card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px 18px;
}
.stat-label {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 6px;
  letter-spacing: 0.3px;
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 800;
  color: #f1f5f9;
  font-variant-numeric: tabular-nums;
}
.stat-value.range-text {
  font-size: 0.95rem;
  color: var(--c-light);
}
.unit {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-left: 4px;
  font-weight: 500;
}

/* List card */
.list-card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.list-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f1f5f9;
}
.list-count {
  font-size: 0.78rem;
  color: #64748b;
}

.table-wrap {
  overflow-x: auto;
}
.att-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.att-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
}
.att-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
.att-table tbody tr:last-child td {
  border-bottom: none;
}
.att-table tbody tr.row-top {
  background: rgba(var(--c-light-rgb), 0.04);
}
.text-right {
  text-align: right !important;
}

.col-rank {
  width: 56px;
  text-align: center;
}
.medal {
  font-size: 1.4rem;
  line-height: 1;
}
.rank-num {
  font-weight: 700;
  color: #94a3b8;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.member-name {
  font-weight: 700;
  color: #f1f5f9;
  word-break: break-word;
}

.role-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}
.role-chip.role-leader {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.35);
}
.role-chip.role-officer {
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
}
.role-chip.role-member {
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.muted {
  color: #64748b;
}

/* Rate cell */
.rate-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  justify-content: flex-end;
}
.rate-bar {
  flex: 1;
  max-width: 120px;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  overflow: hidden;
}
.rate-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
/* 全部跟主題色,只用透明度區分熱度 (寬度本身已表達 % 大小) */
.rate-fill.rate-high {
  background: linear-gradient(90deg, var(--c-light), var(--c-mid));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.rate-fill.rate-mid {
  background: linear-gradient(90deg, var(--c-mid), var(--c-deep));
}
.rate-fill.rate-low {
  background: linear-gradient(90deg, var(--c-deep), var(--c-deep));
  opacity: 0.7;
}
.rate-fill.rate-zero {
  background: rgba(100, 116, 139, 0.4);
}
.rate-num {
  min-width: 52px;
  text-align: right;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rate-num.rate-high {
  color: var(--c-light);
}
.rate-num.rate-mid {
  color: var(--c-light);
}
.rate-num.rate-low {
  color: var(--c-light);
  opacity: 0.7;
}
.rate-num.rate-zero {
  color: #64748b;
}

/* States */
.state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}
.state-error {
  color: #fca5a5;
}
.state-emoji {
  font-size: 2.6rem;
  margin-bottom: 8px;
  opacity: 0.6;
}

/* Mobile */
@media (max-width: 600px) {
  .att-container {
    padding: 18px 12px 60px;
  }
  .att-table th,
  .att-table td {
    padding: 10px 8px;
    font-size: 0.82rem;
  }
  .col-rank {
    width: 38px;
  }
  .rate-bar {
    max-width: 60px;
  }
  .rate-num {
    min-width: 42px;
    font-size: 0.8rem;
  }
  .role-chip {
    font-size: 0.65rem;
  }
}
</style>
