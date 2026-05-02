<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuction } from '@/composables/memberRole.ts'
import { useAlert } from '@/utils/alerts.ts'

const { changedMemberIds, memberList, setRole, roleClassMap, updateRolesApi } = useAuction()

const roleLabels: Record<string, string> = {
  LEADER: '會長',
  OFFICER: '幹部',
  MEMBER: '成員',
}

const keyword = ref('')
const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return memberList.value
  return memberList.value.filter((m) =>
    String(m.memberName).toLowerCase().includes(k),
  )
})

const changedCount = computed(() => changedMemberIds.value.size)

const handleSave = async () => {
  const leaderCount = memberList.value.filter((m) => m.memberRole === 'LEADER').length

  if (leaderCount === 0) {
    useAlert.error('血盟必須擁有一位會長!')
    return
  }
  if (leaderCount > 1) {
    useAlert.error('會長只能有一位,請先將其他成員降職')
    return
  }

  const payload = memberList.value
    .filter((m) => changedMemberIds.value.has(m.memberId))
    .map((m) => ({ memberId: m.memberId, role: m.memberRole }))

  if (payload.length === 0) {
    useAlert.error('資料未變動,無需儲存')
    return
  }

  try {
    await updateRolesApi(payload)
    changedMemberIds.value.clear()
  } catch (error) {
    useAlert.error('更新失敗,請稍後再試。' + error)
  }
}
</script>

<template>
  <div class="role-container">
    <div class="title-wrap">
      <h2 class="title">👑 成員權限管理</h2>
      <p class="subtitle">調整成員職位或移交會長職權,僅會長可用</p>
    </div>

    <div class="search-bar">
      <input
        v-model="keyword"
        type="text"
        placeholder="🔍 搜尋成員名稱..."
        class="search-input"
      />
      <span v-if="changedCount > 0" class="changed-pill">
        待儲存 {{ changedCount }}
      </span>
    </div>

    <div v-if="filteredList.length === 0" class="empty-card">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">沒有符合條件的成員</div>
    </div>

    <div v-else class="member-list">
      <div
        v-for="member in filteredList"
        :key="member.memberId"
        class="member-card"
        :class="{ changed: changedMemberIds.has(member.memberId) }"
      >
        <div class="member-head">
          <div class="avatar">{{ member.memberName.charAt(0) }}</div>
          <div class="info">
            <div class="name">{{ member.memberName }}</div>
            <div class="current-role" :class="roleClassMap[member.memberRole]">
              {{ roleLabels[member.memberRole] }}
            </div>
          </div>
          <span v-if="changedMemberIds.has(member.memberId)" class="dot-changed" title="已變更"></span>
        </div>

        <div class="role-segments">
          <button
            type="button"
            class="seg-btn seg-member"
            :class="{ active: member.memberRole === 'MEMBER' }"
            @click="setRole(member, 'MEMBER')"
          >
            會員
          </button>
          <button
            type="button"
            class="seg-btn seg-officer"
            :class="{ active: member.memberRole === 'OFFICER' }"
            @click="setRole(member, 'OFFICER')"
          >
            幹部
          </button>
          <button
            type="button"
            class="seg-btn seg-leader"
            :class="{ active: member.memberRole === 'LEADER' }"
            @click="setRole(member, 'LEADER')"
          >
            會長
          </button>
        </div>
      </div>
    </div>

    <div class="footer-actions">
      <button
        class="save-btn"
        :disabled="changedCount === 0"
        @click="handleSave"
      >
        {{ changedCount > 0 ? `儲存並更新 ${changedCount} 位成員` : '儲存並更新權限' }}
      </button>
    </div>

    <div class="warning-box">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">
        若將其他成員設為「會長」,你將立即失去管理權限並降職為一般成員
      </span>
    </div>
  </div>
</template>

<style scoped>
/* === 統一規範 ===
   主色: var(--c-light) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.role-container {
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

/* Search */
.search-bar {
  position: relative;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-input {
  flex: 1;
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
}
.search-input::placeholder {
  color: #475569;
}
.search-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.changed-pill {
  flex-shrink: 0;
  padding: 6px 12px;
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
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
  padding: 14px 16px;
  transition: all 0.18s;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.member-card:hover {
  border-color: rgba(var(--c-light-rgb), 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.member-card.changed {
  border-color: rgba(var(--c-light-rgb), 0.45);
  background: rgba(var(--c-light-rgb), 0.04);
}

.member-head {
  display: flex;
  align-items: center;
  gap: 12px;
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
.current-role {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.current-role.member {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}
.current-role.officer {
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}
.current-role.leader {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.dot-changed {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-light);
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.7);
}

/* 角色分段控制 (segmented control) — 三段填滿整列 */
.role-segments {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  overflow: hidden;
}
.seg-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 44px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 0;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s;
}
.seg-btn:hover:not(.active) {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.04);
}

/* Active 各色 */
.seg-member.active {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}
.seg-officer.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.seg-leader.active {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.35);
}

/* Footer */
.footer-actions {
  margin-top: 22px;
}
.save-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
  transition: all 0.2s;
}
.save-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}
.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  background: #1e2233;
  color: #94a3b8;
  box-shadow: none;
}

/* Warning */
.warning-box {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 12px;
}
.warning-icon {
  flex-shrink: 0;
  font-size: 1rem;
}
.warning-text {
  color: #f87171;
  font-size: 0.78rem;
  line-height: 1.5;
}

/* Mobile */
@media (max-width: 480px) {
  .role-container {
    padding: 24px 14px 80px;
  }
  .seg-btn {
    font-size: 0.85rem;
  }
}
</style>
