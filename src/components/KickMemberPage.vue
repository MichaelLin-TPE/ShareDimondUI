<script setup lang="ts">
import { useAuction } from '@/composables/kickMemberPage.ts'
import type { RoleFilter } from '@/composables/kickMemberPage.ts'

const {
  searchQuery,
  selectedRole,
  showModal,
  confirmKick,
  selectedMember,
  filteredMembers,
  handleKick,
  roleLabels,
  stats,
  loading,
} = useAuction()

const filters: { key: RoleFilter; label: string; emoji: string }[] = [
  { key: 'ALL', label: '全部', emoji: '👥' },
  { key: 'LEADER', label: '會長', emoji: '👑' },
  { key: 'OFFICER', label: '幹部', emoji: '⭐' },
  { key: 'MEMBER', label: '成員', emoji: '👤' },
]
</script>

<template>
  <div class="km-page">
    <!-- Header -->
    <header class="km-header">
      <div class="km-title-row">
        <span class="km-icon">🚪</span>
        <div>
          <h1 class="km-title">成員除名管理</h1>
          <p class="km-sub">移除不再活躍或違反規則的成員，此動作無法撤銷</p>
        </div>
      </div>
    </header>

    <!-- Stats -->
    <div class="km-stats">
      <div class="km-stat">
        <div class="km-stat-num">{{ stats.total }}</div>
        <div class="km-stat-label">👥 總人數</div>
      </div>
      <div class="km-stat leader">
        <div class="km-stat-num">{{ stats.leader }}</div>
        <div class="km-stat-label">👑 會長</div>
      </div>
      <div class="km-stat officer">
        <div class="km-stat-num">{{ stats.officer }}</div>
        <div class="km-stat-label">⭐ 幹部</div>
      </div>
      <div class="km-stat member">
        <div class="km-stat-num">{{ stats.member }}</div>
        <div class="km-stat-label">👤 成員</div>
      </div>
    </div>

    <!-- Search + Filter Toolbar -->
    <div class="km-toolbar">
      <div class="km-search">
        <span class="km-search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋成員名稱..."
          class="km-search-input"
        />
        <button v-if="searchQuery" class="km-search-clear" @click="searchQuery = ''">✕</button>
      </div>

      <div class="km-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          class="km-filter-chip"
          :class="{ active: selectedRole === f.key }"
          @click="selectedRole = f.key"
        >
          {{ f.emoji }} {{ f.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && filteredMembers.length === 0" class="km-empty">
      <div class="km-spinner"></div>
      <p>載入中...</p>
    </div>

    <!-- Empty / No Result -->
    <div v-else-if="filteredMembers.length === 0" class="km-empty">
      <div class="km-empty-icon">{{ searchQuery ? '🔍' : '👻' }}</div>
      <p>{{ searchQuery ? `找不到符合「${searchQuery}」的成員` : '尚無此類別成員' }}</p>
    </div>

    <!-- Member Grid -->
    <div v-else class="km-grid">
      <div
        v-for="member in filteredMembers"
        :key="member.memberId"
        class="km-card"
        :class="member.memberRole.toLowerCase()"
      >
        <div class="km-card-top">
          <div class="km-avatar" :class="member.memberRole.toLowerCase()">
            {{ member.memberName.charAt(0).toUpperCase() }}
          </div>
          <div class="km-card-info">
            <div class="km-card-name">{{ member.memberName }}</div>
            <span class="km-role-badge" :class="member.memberRole.toLowerCase()">
              {{ roleLabels[member.memberRole] }}
            </span>
          </div>
        </div>

        <button
          v-if="member.memberRole !== 'LEADER'"
          class="km-kick-btn"
          @click="confirmKick(member)"
        >
          🚪 剔除成員
        </button>
        <div v-else class="km-leader-tag">👑 會長無法被剔除</div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="km-modal">
        <div class="km-modal__mask" @click="showModal = false"></div>
        <div class="km-modal__panel" role="dialog">
          <div class="km-modal__icon">⚠️</div>
          <h3 class="km-modal__title">確認除名？</h3>
          <p class="km-modal__sub">此操作無法撤銷</p>

          <div class="km-modal__highlight">
            <div class="km-modal__avatar" :class="selectedMember?.memberRole.toLowerCase()">
              {{ selectedMember?.memberName.charAt(0).toUpperCase() }}
            </div>
            <div class="km-modal__name">{{ selectedMember?.memberName }}</div>
            <span
              class="km-role-badge"
              :class="selectedMember?.memberRole.toLowerCase()"
            >
              {{ selectedMember?.memberRole && roleLabels[selectedMember.memberRole] }}
            </span>
          </div>

          <p class="km-modal__warn">
            該成員將失去所有權限且無法參與分紅，他的錢包金額將會充公至血盟基金。
          </p>

          <div class="km-modal__actions">
            <button class="km-modal__btn cancel" @click="showModal = false">取消</button>
            <button class="km-modal__btn danger" @click="handleKick">確定剔除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.km-page {
  padding: 32px 20px 48px;
  max-width: 1100px;
  margin: 0 auto;
  color: #e2e8f0;
}

/* Header */
.km-header {
  margin-bottom: 24px;
  margin-left: 48px;
}
.km-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.km-icon {
  font-size: 2rem;
  filter: drop-shadow(0 0 8px rgba(245, 196, 81, 0.45));
}
.km-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: #ffd166;
  text-shadow:
    0 0 8px rgba(245, 196, 81, 0.45),
    0 2px 12px rgba(245, 158, 11, 0.2);
}
.km-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* Stats */
.km-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.km-stat {
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 16px 14px;
  text-align: center;
  transition: transform 0.15s;
}
.km-stat:hover {
  transform: translateY(-2px);
}
.km-stat-num {
  font-size: 1.8rem;
  font-weight: 800;
  color: #e2e8f0;
  line-height: 1;
  margin-bottom: 6px;
}
.km-stat-label {
  font-size: 0.78rem;
  color: #94a3b8;
}
.km-stat.leader { border-color: rgba(239, 68, 68, 0.3); }
.km-stat.leader .km-stat-num { color: #f87171; }
.km-stat.officer { border-color: rgba(245, 196, 81, 0.4); }
.km-stat.officer .km-stat-num { color: #ffd166; }
.km-stat.member { border-color: rgba(255, 255, 255, 0.12); }
.km-stat.member .km-stat-num { color: #e2e8f0; }

/* Toolbar */
.km-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}
.km-search {
  position: relative;
  width: 100%;
}
.km-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.95rem;
  pointer-events: none;
  opacity: 0.5;
}
.km-search-input {
  width: 100%;
  height: 48px;
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #3a3f5c;
  border-radius: 12px;
  padding: 0 40px;
  color: #fff;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.15s;
}
.km-search-input::placeholder {
  color: #64748b;
}
.km-search-input:focus {
  border-color: #ffd166;
  background: rgba(22, 24, 34, 1);
  box-shadow: 0 0 0 3px rgba(245, 196, 81, 0.15);
}
.km-search-icon {
  font-size: 1.05rem;
  opacity: 0.8;
}
.km-search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  border: 0;
  cursor: pointer;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.km-search-clear:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.km-filters {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  overflow: hidden;
}
.km-filter-chip {
  width: 100%;
  height: 44px;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  color: #94a3b8;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.km-filter-chip:hover:not(.active) {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.04);
}
.km-filter-chip.active {
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0f111a;
  font-weight: 800;
}

/* Member Grid */
.km-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.km-card {
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.km-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
}
.km-card.leader::before { background: linear-gradient(90deg, #ef4444, #b91c1c); }
.km-card.officer::before { background: linear-gradient(90deg, #ffd166, #f59e0b); }
.km-card.member::before { background: linear-gradient(90deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1)); }
.km-card:hover {
  transform: translateY(-2px);
  border-color: rgba(245, 196, 81, 0.35);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
}

.km-card-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.km-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.4rem;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.km-avatar.leader { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.km-avatar.officer { background: linear-gradient(135deg, #ffd166, #f59e0b); color: #0f111a; }
.km-avatar.member { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }

.km-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.km-card-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.km-role-badge {
  display: inline-block;
  width: fit-content;
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.km-role-badge.leader {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.km-role-badge.officer {
  background: rgba(245, 196, 81, 0.14);
  color: #ffd166;
  border: 1px solid rgba(245, 196, 81, 0.4);
}
.km-role-badge.member {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.km-kick-btn {
  width: 100%;
  height: 38px;
  background: transparent;
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.km-kick-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: #ef4444;
  color: #fff;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.25);
}
.km-leader-tag {
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
  padding: 9px 0;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

/* Empty / Loading */
.km-empty {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 16px;
  border: 1px dashed #2e3147;
}
.km-empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
.km-empty p {
  margin: 0;
  font-size: 0.95rem;
}
.km-spinner {
  width: 38px;
  height: 38px;
  border: 3px solid rgba(245, 196, 81, 0.2);
  border-top-color: #ffd166;
  border-radius: 50%;
  margin: 0 auto 14px;
  animation: km-spin 0.8s linear infinite;
}
@keyframes km-spin {
  to { transform: rotate(360deg); }
}

/* Modal */
.km-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.km-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
}
.km-modal__panel {
  position: relative;
  background: #1a1f2e;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 20px;
  padding: 28px 24px 22px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(239, 68, 68, 0.15), 0 20px 50px rgba(0, 0, 0, 0.6);
  text-align: center;
  animation: km-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
@keyframes km-pop {
  from { opacity: 0; transform: scale(0.9) translateY(10px); }
  to { opacity: 1; transform: scale(1); }
}
.km-modal__icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}
.km-modal__title {
  margin: 0 0 4px;
  font-size: 1.2rem;
  font-weight: 800;
  color: #f87171;
  letter-spacing: 1px;
}
.km-modal__sub {
  margin: 0 0 16px;
  font-size: 0.78rem;
  color: #94a3b8;
}

.km-modal__highlight {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 14px;
  margin-bottom: 16px;
}
.km-modal__avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.3rem;
  color: #fff;
}
.km-modal__avatar.leader { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.km-modal__avatar.officer { background: linear-gradient(135deg, #ffd166, #f59e0b); color: #0f111a; }
.km-modal__avatar.member { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }
.km-modal__name {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e2e8f0;
}
.km-modal__warn {
  margin: 0 0 18px;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.6;
  text-align: center;
}

.km-modal__actions {
  display: flex;
  gap: 10px;
}
.km-modal__btn {
  flex: 1;
  height: 44px;
  border: 0;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.km-modal__btn.cancel {
  background: #1e2233;
  color: #e2e8f0;
  border: 1px solid #3a3f5c;
}
.km-modal__btn.cancel:hover {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
}
.km-modal__btn.danger {
  flex: 1.4;
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
}
.km-modal__btn.danger:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(239, 68, 68, 0.5);
}

/* RWD */
@media (max-width: 768px) {
  .km-page { padding: 20px 12px 40px; }
  .km-header { margin-left: 48px; }
  .km-title { font-size: 1.25rem; }
  .km-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .km-stat { padding: 12px 10px; }
  .km-stat-num { font-size: 1.4rem; }
  .km-grid { grid-template-columns: 1fr; gap: 10px; }
  .km-filter-chip { font-size: 0.8rem; padding: 0 6px; }
}
@media (max-width: 480px) {
  .km-card { padding: 14px; }
  .km-avatar { width: 44px; height: 44px; font-size: 1.2rem; }
}
</style>
