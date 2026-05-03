<script setup lang="ts">
import { useLootTracker } from '@/composables/lootTracker.ts'

const {
  activeTab,
  stats,
  history,
  loading,
  submitting,
  itemOptions,
  bossOptions,
  showAddModal,
  form,
  totalRecords,
  trackedItems,
  imminentItems,
  openAdd,
  closeAdd,
  submitRecord,
  deleteRecord,
  formatInterval,
  formatRelative,
  formatAbs,
  isOverdue,
  isImminent,
} = useLootTracker()
</script>

<template>
  <div class="lt-container">
    <div class="title-wrap">
      <h2 class="title">📦 掉寶追蹤</h2>
      <p class="subtitle">記錄首領掉寶 → 自動推算掉落間隔 → 預估下次刷新</p>
    </div>

    <!-- 統計列 -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-label">總紀錄</span>
        <span class="stat-value">{{ totalRecords }}</span>
      </div>
      <div class="stat-card gold-top">
        <span class="stat-label">追蹤道具</span>
        <span class="stat-value gold">{{ trackedItems }}</span>
      </div>
      <div class="stat-card warn-top" :class="{ flash: imminentItems > 0 }">
        <span class="stat-label">即將掉落</span>
        <span class="stat-value warn">{{ imminentItems }}</span>
      </div>
    </div>

    <!-- 主動作 -->
    <button class="add-btn" @click="openAdd">+ 記錄掉寶</button>

    <!-- Tabs -->
    <div class="seg-tabs">
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'stats' }"
        @click="activeTab = 'stats'"
      >
        道具分析
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ active: activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        歷史紀錄
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="empty-card">
      <div class="empty-icon">⏳</div>
      <div class="empty-text">載入中...</div>
    </div>

    <!-- Tab: 道具分析 -->
    <div v-else-if="activeTab === 'stats'">
      <div v-if="stats.length === 0" class="empty-card">
        <div class="empty-icon">📦</div>
        <div class="empty-text">還沒有任何掉寶紀錄,點上方按鈕新增</div>
      </div>

      <div v-else class="stats-grid">
        <div
          v-for="s in stats"
          :key="s.itemId"
          class="item-card"
          :class="{ overdue: isOverdue(s.estimatedNextAt), imminent: isImminent(s.estimatedNextAt) }"
        >
          <div class="item-head">
            <span class="item-name">{{ s.itemName }}</span>
            <span class="record-count">{{ s.recordCount }} 筆</span>
          </div>

          <div class="info-row">
            <span class="info-label">⏱ 平均間隔</span>
            <span class="info-value">{{ formatInterval(s.avgIntervalMinutes) }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">🟢 上次掉落</span>
            <span class="info-value">
              {{ formatRelative(s.lastDroppedAt) }}
              <span v-if="s.lastBossName" class="boss-tag">{{ s.lastBossName }}</span>
            </span>
          </div>

          <div v-if="s.estimatedNextAt" class="info-row next-row">
            <span class="info-label">🔮 下次預估</span>
            <span class="info-value next-value">
              <template v-if="isOverdue(s.estimatedNextAt)">
                <span class="badge-overdue">已過期 · {{ formatRelative(s.estimatedNextAt) }}</span>
              </template>
              <template v-else-if="isImminent(s.estimatedNextAt)">
                <span class="badge-imminent">⚠ {{ formatRelative(s.estimatedNextAt) }}</span>
              </template>
              <template v-else>
                {{ formatRelative(s.estimatedNextAt) }}
                <span class="abs-time">({{ formatAbs(s.estimatedNextAt) }})</span>
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: 歷史紀錄 -->
    <div v-else>
      <div v-if="history.length === 0" class="empty-card">
        <div class="empty-icon">📋</div>
        <div class="empty-text">還沒有任何紀錄</div>
      </div>

      <div v-else class="history-list">
        <div v-for="rec in history" :key="rec.id" class="history-item">
          <div class="hist-main">
            <span class="hist-item">{{ rec.itemName }}</span>
            <span v-if="rec.bossName" class="hist-arrow">←</span>
            <span v-if="rec.bossName" class="hist-boss">{{ rec.bossName }}</span>
            <span v-else class="hist-boss-empty">未指定首領</span>
          </div>
          <div class="hist-meta">
            <span class="hist-time">{{ formatRelative(rec.droppedAt) }}</span>
            <span class="hist-abs">{{ formatAbs(rec.droppedAt) }}</span>
            <span class="hist-by">by {{ rec.recordedByName }}</span>
            <button v-if="rec.canDelete" class="hist-del" @click="deleteRecord(rec.id)" title="刪除">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: 記錄掉寶 -->
    <div v-if="showAddModal" class="modal-mask" @click.self="closeAdd">
      <div class="modal-card">
        <div class="modal-title">📦 記錄掉寶</div>

        <div class="field">
          <label>道具 <span class="required">*</span></label>
          <select v-model="form.itemId" class="field-input">
            <option value="" disabled>請選擇道具</option>
            <option v-for="opt in itemOptions" :key="opt.itemId" :value="opt.itemId">
              {{ opt.itemName }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>首領 <span class="optional">(可選)</span></label>
          <select v-model="form.bossId" class="field-input">
            <option value="">未指定</option>
            <option v-for="opt in bossOptions" :key="opt.bossId" :value="opt.bossId">
              {{ opt.bossName }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>掉落時間 <span class="optional">(預設為現在)</span></label>
          <input type="datetime-local" v-model="form.droppedAt" class="field-input" />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeAdd" :disabled="submitting">取消</button>
          <button class="btn-confirm" @click="submitRecord" :disabled="submitting">
            {{ submitting ? '記錄中…' : '確認記錄' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lt-container {
  padding: 32px 16px 80px;
  max-width: 920px;
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

/* Stats row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-top: 3px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-card.gold-top {
  border-top-color: var(--c-light);
}
.stat-card.warn-top {
  border-top-color: #ef4444;
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
  letter-spacing: 0.3px;
  line-height: 1.1;
  font-family: 'Consolas', 'Monaco', monospace;
}
.stat-value.gold {
  color: var(--c-light);
}
.stat-value.warn {
  color: #fca5a5;
}
.stat-card.flash {
  animation: flash-warn 1.6s ease-in-out infinite;
}
@keyframes flash-warn {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

/* Add button */
.add-btn {
  width: 100%;
  height: 48px;
  margin-bottom: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
  transition: all 0.2s;
}
.add-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}

/* Segmented tabs */
.seg-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}
.seg-btn {
  width: 100%;
  height: 44px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition:
    background 0.18s,
    color 0.18s;
}
.seg-btn:hover:not(.active) {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.04);
}
.seg-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
}

/* Empty */
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

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.item-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 14px 16px;
  transition: border-color 0.18s, box-shadow 0.2s;
}
.item-card:hover {
  border-color: rgba(var(--c-light-rgb), 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.item-card.imminent {
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.04);
}
.item-card.overdue {
  border-color: rgba(255, 255, 255, 0.12);
  opacity: 0.85;
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.item-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
}
.record-count {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  margin-bottom: 6px;
  gap: 10px;
}
.info-label {
  color: #94a3b8;
  white-space: nowrap;
}
.info-value {
  color: #e2e8f0;
  text-align: right;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.boss-tag {
  font-size: 0.72rem;
  padding: 1px 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border-radius: 999px;
}
.next-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
}
.next-value {
  font-weight: 700;
  color: var(--c-light);
}
.abs-time {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 500;
}
.badge-imminent {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}
.badge-overdue {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}

/* History list */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hist-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hist-item {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--c-light);
}
.hist-arrow {
  color: #64748b;
  font-size: 0.85rem;
}
.hist-boss {
  font-size: 0.85rem;
  color: #e2e8f0;
  font-weight: 600;
}
.hist-boss-empty {
  font-size: 0.78rem;
  color: #64748b;
  font-style: italic;
}
.hist-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: #94a3b8;
}
.hist-time {
  color: #e2e8f0;
  font-weight: 600;
}
.hist-abs {
  color: #64748b;
  font-family: 'Consolas', 'Monaco', monospace;
}
.hist-by {
  color: #94a3b8;
}
.hist-del {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.hist-del:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  color: #fff;
}

/* Modal */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-card {
  width: 100%;
  max-width: 380px;
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  padding: 24px 22px 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
}
.modal-title {
  text-align: center;
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--c-light);
  letter-spacing: 0.5px;
}
.field {
  margin-bottom: 14px;
}
.field label {
  display: block;
  font-size: 0.85rem;
  color: #e2e8f0;
  margin-bottom: 6px;
  font-weight: 600;
}
.required {
  color: #f87171;
}
.optional {
  color: #64748b;
  font-weight: 500;
  font-size: 0.78rem;
  margin-left: 4px;
}
.field-input {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.15s;
  box-sizing: border-box;
  font-family: inherit;
}
.field-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.field-input[type='datetime-local']::-webkit-calendar-picker-indicator {
  filter: invert(1);
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.btn-cancel,
.btn-confirm {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn-cancel {
  background: #1e2233;
  color: #e2e8f0;
  border: 1px solid #3a3f5c;
}
.btn-cancel:hover:not(:disabled) {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
}
.btn-confirm {
  flex: 1.4;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.3);
}
.btn-confirm:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.btn-cancel:disabled,
.btn-confirm:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 480px) {
  .lt-container {
    padding: 24px 14px 80px;
  }
  .stats-row {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .stat-value {
    font-size: 1.3rem;
  }
}
</style>
