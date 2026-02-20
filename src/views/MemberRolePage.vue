<script setup lang="ts">
import { useAuction } from '@/composables/memberRole.ts'
// 靜態資料
const { memberList, setRole, roleClassMap } = useAuction()
const roleLabels: Record<string, string> = {
  leader: '會長',
  officer: '幹部',
  member: '成員',
}

const handleSave = () => {
  alert('權限更新成功！')
}
</script>

<template>
  <div class="admin-container">
    <div class="header-section">
      <h2 class="title">成員權限管理</h2>
      <p class="subtitle">僅會長可用：調整成員職位或移交會長職權</p>
    </div>

    <div class="management-card">
      <div class="search-bar">
        <input type="text" placeholder="搜尋成員 ID 或 名稱..." class="search-input" />
      </div>

      <div class="member-list">
        <div v-for="member in memberList" :key="member.memberId" class="member-item">
          <div class="member-info">
            <div class="avatar">{{ member.memberName.charAt(0) }}</div>
            <div class="details">
              <div class="name">{{ member.memberName }}</div>
              <div class="current-role" :class="roleClassMap[member.memberRole]">
                {{ roleLabels[member.memberRole] }}
              </div>
            </div>
          </div>

          <div class="role-actions">
            <button
              class="action-btn btn-member"
              :class="{ active: member.memberRole === 'MEMBER' }"
              @click="setRole(member, 'MEMBER')"
            >
              會員
            </button>

            <button
              class="action-btn btn-officer"
              :class="{ active: member.memberRole === 'OFFICER' }"
              @click="setRole(member, 'OFFICER')"
            >
              幹部
            </button>

            <button
              class="action-btn btn-leader"
              :class="{ active: member.memberRole === 'LEADER' }"
              @click="setRole(member, 'LEADER')"
            >
              會長
            </button>
          </div>
        </div>
      </div>

      <div class="footer-actions">
        <button class="save-btn" @click="handleSave">儲存並更新權限</button>
      </div>
    </div>

    <div class="warning-box">
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">
        注意：若將其他成員設為「會長」，您將立即失去管理權限並降職為一般成員。
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================
   Layout
========================= */
.admin-container {
  padding: 40px 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 24px;
}

.title {
  color: #fff;
  font-size: 24px;
  margin-bottom: 4px;
}

.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

/* =========================
   Card
========================= */
.management-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

/* =========================
   Search
========================= */
.search-bar {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid #24263a;
}

.search-input {
  width: 100%;
  background: #0f111a;
  border: 1px solid #2d3047;
  border-radius: 10px;
  padding: 10px 16px;
  color: #fff;
  outline: none;
}

/* =========================
   Member List
========================= */
.member-list {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid #24263a;
}

.member-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  font-size: 18px;
}

.name {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

/* =========================
   Current Role Badge
========================= */
.current-role {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px;
  display: inline-block;
}

.current-role.member {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
}

.current-role.officer {
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
}

.current-role.leader {
  background: rgba(255, 209, 102, 0.2);
  color: #ffd166;
}

/* =========================
   Role Buttons
========================= */
.role-actions {
  display: flex;
  gap: 10px;
  flex-wrap: nowrap; /* 不換行 */
  flex-shrink: 0; /* 不被擠扁 */
}

.details {
  min-width: 0;
}

.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px; /* 你要更短/更長自己調 */
}

/* Base button */
.action-btn {
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid #2d3047;
  background: #0f111a;
  color: #aaa;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  color: #fff;
}

/* ---------- Active common ---------- */
.action-btn.active {
  color: #fff;
  border-color: transparent;
}

/* ---------- Member ---------- */
.btn-member.active {
  background: #2d3047;
}

/* ---------- Officer ---------- */
.btn-officer.active {
  background: linear-gradient(135deg, #ffd166, #e6b800);
  color: #0f111a;
  box-shadow: 0 4px 15px rgba(255, 209, 102, 0.3);
}

/* ---------- Leader ---------- */
.btn-leader.active {
  background: linear-gradient(135deg, #ff4d4d, #d90429);
  color: #fff;
  box-shadow: 0 4px 15px rgba(255, 77, 77, 0.3);
}

.btn-leader:hover {
  background: #ff4d4d;
  border-color: #ff4d4d;
  color: #fff;
}

/* =========================
   Footer
========================= */
.footer-actions {
  padding: 32px;
  display: flex;
  justify-content: center;
}

.save-btn {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 18px;
  font-size: 18px;
  letter-spacing: 2px;
}

/* =========================
   Warning
========================= */
.warning-box {
  margin-top: 20px;
  background: rgba(255, 77, 77, 0.1);
  border: 1px solid rgba(255, 77, 77, 0.3);
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.warning-text {
  color: #ff8888;
  font-size: 12px;
}
</style>
