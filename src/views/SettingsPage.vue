<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useSettings } from '@/composables/settings.ts'
import { useThemeStore, THEMES, type ThemeName } from '@/stores/theme'

const authStore = useAuthStore()
const themeStore = useThemeStore()
function pickTheme(t: ThemeName) {
  themeStore.setTheme(t)
}
const {
  showEditNameModal,
  editNameValue,
  submittingName,
  submittingLeave,
  openEditName,
  closeEditName,
  submitEditName,
  openLeaveConfirm,
} = useSettings()

const currentName = computed(() => authStore.member?.userName ?? '-')
const currentRole = computed(() => {
  const r = authStore.member?.role
  if (r === 'LEADER') return '會長'
  if (r === 'OFFICER') return '幹部'
  return '成員'
})
const currentClan = computed(() => authStore.member?.clanName ?? '-')
const isLeader = computed(() => authStore.member?.role === 'LEADER')
</script>

<template>
  <div class="st-container">
    <div class="title-wrap">
      <h2 class="title">⚙️ 個人設置</h2>
      <p class="subtitle">管理你的個人資訊與血盟成員身分</p>
    </div>

    <!-- 帳戶區塊 -->
    <section class="settings-section">
      <div class="section-head">
        <span class="section-title">帳戶</span>
        <span class="section-hint">個人資料與顯示名稱</span>
      </div>
      <div class="settings-card">
        <button class="setting-row" @click="openEditName">
          <span class="row-label">顯示名稱</span>
          <span class="row-value">
            {{ currentName }}
            <span class="row-arrow">›</span>
          </span>
        </button>

        <div class="setting-row readonly">
          <span class="row-label">目前身分</span>
          <span class="row-value">
            <span class="role-chip" :class="`role-${authStore.member?.role?.toLowerCase()}`">
              {{ currentRole }}
            </span>
          </span>
        </div>

        <div class="setting-row readonly">
          <span class="row-label">所屬血盟</span>
          <span class="row-value">{{ currentClan }}</span>
        </div>
      </div>
    </section>

    <!-- 主題色系 -->
    <section class="settings-section">
      <div class="section-head">
        <span class="section-title">🎨 主題色系</span>
        <span class="section-hint">挑一個喜歡的色調,設定會記住下次自動套用</span>
      </div>
      <div class="theme-list">
        <button
          v-for="t in THEMES"
          :key="t.key"
          class="theme-item"
          :class="{ active: themeStore.current === t.key }"
          :style="{
            '--p1': t.preview.light,
            '--p2': t.preview.deep,
          }"
          @click="pickTheme(t.key)"
        >
          <span class="theme-swatch"></span>
          <span class="theme-emoji">{{ t.emoji }}</span>
          <span class="theme-text">
            <span class="theme-name">{{ t.label }}</span>
            <span class="theme-desc">{{ t.desc }}</span>
          </span>
          <span class="theme-check" :class="{ on: themeStore.current === t.key }">✓</span>
        </button>
      </div>
    </section>

    <!-- 血盟操作 -->
    <section class="settings-section">
      <div class="section-head">
        <span class="section-title danger-title">危險區</span>
        <span class="section-hint">不可逆的操作,請慎重</span>
      </div>
      <div class="settings-card danger-card">
        <button
          class="setting-row danger-row"
          :disabled="isLeader || submittingLeave"
          @click="openLeaveConfirm"
        >
          <div class="row-info">
            <span class="row-label danger">退出血盟</span>
            <span class="row-sub">退出後餘額退還血盟金庫,需重新申請加入</span>
          </div>
          <span v-if="isLeader" class="row-locked">會長無法退出</span>
          <span v-else class="row-arrow danger">›</span>
        </button>
      </div>
    </section>

    <!-- Edit Name Modal -->
    <div v-if="showEditNameModal" class="modal-mask" @click.self="closeEditName">
      <div class="modal-card">
        <div class="modal-title">修改顯示名稱</div>
        <p class="modal-sub">2-20 字,血盟內不重複</p>

        <div class="field">
          <input
            v-model="editNameValue"
            class="field-input"
            type="text"
            placeholder="輸入新名稱"
            maxlength="20"
            @keyup.enter="submitEditName"
          />
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" :disabled="submittingName" @click="closeEditName">
            取消
          </button>
          <button class="btn-confirm" :disabled="submittingName" @click="submitEditName">
            {{ submittingName ? '更新中…' : '確認更新' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st-container {
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

/* Section */
.settings-section {
  margin-bottom: 22px;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 6px 8px;
  gap: 10px;
}
.section-title {
  font-size: 0.85rem;
  color: #e2e8f0;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.section-title.danger-title {
  color: #f87171;
}
.section-hint {
  font-size: 0.75rem;
  color: #64748b;
}

/* === 主題選擇 (垂直清單,每張全寬) === */
.theme-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.theme-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 64px;
  padding: 12px 16px;
  background: rgba(22, 24, 34, 0.95);
  border: 2px solid #24263a;
  border-radius: 14px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
  color: #e2e8f0;
}
.theme-item:hover {
  border-color: var(--p1);
}
.theme-item.active {
  border-color: var(--p1);
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--p1) 12%, transparent) 0%,
    rgba(22, 24, 34, 0.95) 60%);
}
.theme-swatch {
  width: 6px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--p1), var(--p2));
}
.theme-emoji {
  font-size: 1.6rem;
  line-height: 1;
  flex-shrink: 0;
}
.theme-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.theme-name {
  font-size: 0.98rem;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: 0.5px;
}
.theme-desc {
  font-size: 0.78rem;
  color: #94a3b8;
}
.theme-item.active .theme-name {
  color: var(--p1);
}
.theme-check {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: transparent;
  font-size: 0.85rem;
  font-weight: 900;
  border-radius: 50%;
  transition: all 0.15s ease;
}
.theme-check.on {
  background: linear-gradient(135deg, var(--p1), var(--p2));
  border-color: transparent;
  color: var(--c-on);
}

.settings-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 14px;
  overflow: hidden;
}
.settings-card.danger-card {
  border-color: rgba(239, 68, 68, 0.25);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s;
  box-sizing: border-box;
}
.setting-row:last-child {
  border-bottom: none;
}
.setting-row:not(.readonly):not(.danger-row):not(:disabled):hover {
  background: rgba(var(--c-light-rgb), 0.04);
}
.setting-row:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.setting-row.readonly {
  cursor: default;
}

/* 危險動作 row(退出血盟):整列紅底,看起來就是危險按鈕 */
.setting-row.danger-row {
  min-height: 64px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: none;
}
.setting-row.danger-row:not(:disabled):hover {
  background: rgba(239, 68, 68, 0.18);
}

.row-label {
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
}
.row-label.danger {
  color: #f87171;
}
.row-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}
.row-sub {
  color: #64748b;
  font-size: 0.78rem;
}
.row-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--c-light);
  font-size: 0.95rem;
  font-weight: 700;
}
.row-arrow {
  color: rgba(255, 255, 255, 0.4);
  font-size: 1.2rem;
  font-weight: 300;
  line-height: 1;
}
.row-arrow.danger {
  color: #f87171;
}
.row-locked {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Role chip */
.role-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
}
.role-leader {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.role-officer {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
}
.role-member {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.12);
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
  margin: 0 0 4px;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--c-light);
}
.modal-sub {
  text-align: center;
  margin: 0 0 16px;
  font-size: 0.78rem;
  color: #94a3b8;
}
.field {
  margin-bottom: 14px;
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
.field-input::placeholder {
  color: #475569;
}
.field-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.modal-actions {
  display: flex;
  gap: 10px;
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
  font-family: inherit;
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
  .st-container {
    padding: 24px 14px 80px;
  }
  .setting-row {
    padding: 14px 14px;
  }
}
</style>
