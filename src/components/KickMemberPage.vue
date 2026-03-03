<script setup lang="ts">
import { useAuction } from '@/composables/kickMemberPage.ts'

const {
  searchQuery,
  showModal,
  confirmKick,
  selectedMember,
  filteredMembers,
  handleKick,
  roleLabels,
} = useAuction()
</script>
<template>
  <div class="admin-container">
    <div class="header-section">
      <h2 class="title">🚪 成員除名管理</h2>
      <p class="subtitle">移除不再活躍或違反規則的成員，此動作無法撤銷</p>
    </div>

    <div class="search-bar mb-6">
      <input v-model="searchQuery" type="text" placeholder="搜尋成員名稱..." class="search-input" />
    </div>

    <div class="management-card">
      <table class="member-table">
        <thead>
          <tr>
            <th>成員資訊</th>
            <th>角色</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in filteredMembers" :key="member.memberId">
            <td>
              <div class="member-profile">
                <div class="avatar-sm" :class="member.memberRole.toLowerCase()">
                  {{ member.memberName.charAt(0) }}
                </div>
                <div class="name-info">
                  <span class="name-text">{{ member.memberName }}</span>
                  <span class="id-tag">ID: {{ member.memberId }}</span>
                </div>
              </div>
            </td>
            <td>
              <span :class="['role-badge', member.memberRole.toLowerCase()]">
                {{ roleLabels[member.memberRole] }}
              </span>
            </td>
            <td class="text-right">
              <button
                v-if="member.memberRole !== 'LEADER'"
                class="kick-btn"
                @click="confirmKick(member)"
              >
                剔除成員
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="boss-container kick-modal">
        <div class="boss-title">確認除名？</div>
        <div class="warning-content">
          確定要將
          <span class="highlight">{{ selectedMember?.memberName }}</span> 移出血盟嗎？<br />
          該成員將失去所有權限且無法參與分紅,他的錢包金額將會充公至血盟基金。
        </div>
        <div class="modal-footer">
          <button class="danger-confirm-btn" @click="handleKick">確定剔除</button>
          <button class="cancel-btn" @click="showModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 容器與基本設定 */
.admin-container {
  padding: 40px 24px;
  max-width: 1100px;
  margin: 0 auto;
  color: #e2e8f0;
}

.header-section {
  margin-bottom: 32px;
}

.title {
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

/* 搜尋列優化 */
.search-bar {
  margin-bottom: 24px;
}

.search-input {
  width: 100%;
  background: #1a1c26;
  border: 1px solid #2d3047;
  border-radius: 16px;
  padding: 14px 24px;
  color: white;
  font-size: 15px;
  transition: all 0.3s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.search-input:focus {
  border-color: #6366f1;
  background: #1f2230;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  outline: none;
}

/* 核心管理卡片 */
.management-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

.member-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.member-table th {
  background: rgba(255, 255, 255, 0.02);
  padding: 18px 24px;
  text-align: left;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid #24263a;
}

.member-table td {
  padding: 20px 24px;
  border-bottom: 1px solid #1f2130;
  vertical-align: middle;
}

.member-table tr:last-child td {
  border-bottom: none;
}

.member-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

/* 成員資訊區塊 (防止跑版的關鍵) */
.member-profile {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px; /* 確保名字不會被擠扁 */
}

.avatar-sm {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  background: #2d3047;
  color: #fff;
  flex-shrink: 0; /* 防止頭像被擠壓 */
}

/* 根據角色變色 */
.avatar-sm.leader {
  background: linear-gradient(135deg, #ff4d4d, #d90429);
}
.avatar-sm.officer {
  background: linear-gradient(135deg, #ffd166, #e6b800);
  color: #1a1c26;
}
.avatar-sm.member {
  background: #4f46e5;
}

.name-info {
  display: flex;
  flex-direction: column;
}

.name-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.id-tag {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  font-family: monospace;
}

/* 角色標籤 Badge */
.role-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.05);
}

.role-badge.leader {
  color: #ff4d4d;
  border: 1px solid rgba(255, 77, 77, 0.3);
}
.role-badge.officer {
  color: #ffd166;
  border: 1px solid rgba(255, 209, 102, 0.3);
}
.role-badge.member {
  color: #a5b4fc;
  border: 1px solid rgba(165, 180, 252, 0.3);
}

/* 時間文字 */
.time-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

/* 剔除按鈕 - 換成有層次感的設計 */
.kick-btn {
  background: transparent;
  color: #ff4d4f;
  border: 1px solid rgba(255, 77, 79, 0.4);
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.kick-btn:hover {
  background: rgba(255, 77, 79, 0.1);
  border-color: #ff4d4f;
  box-shadow: 0 0 15px rgba(255, 77, 79, 0.2);
}

/* 彈窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(8, 9, 15, 0.85); /* 更深邃的底色 */
  backdrop-filter: blur(10px); /* 強力模糊增加高級感 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

.boss-title {
  color: #ff4d4d !important; /* 鮮紅色標題 */
  font-size: 1.6rem !important;
  font-weight: 800;
  letter-spacing: 3px;
  margin-bottom: 24px !important;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 77, 77, 0.2) !important;
}

/* 彈窗容器 - 延續你的 boss-container 但優化邊距 */
.kick-modal {
  background: #161822 !important;
  border: 1px solid rgba(255, 77, 77, 0.4) !important; /* 紅色霓虹邊框 */
  box-shadow:
    0 0 30px rgba(255, 77, 77, 0.15),
    0 20px 40px rgba(0, 0, 0, 0.6);
  padding: 32px !important;
  max-width: 420px !important;
  width: 90%;
  border-radius: 24px !important;
}
.warning-content {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
  line-height: 1.8;
  margin: 20px 0;
  text-align: center;
}

.highlight {
  display: block;
  font-size: 1.5rem;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  margin: 10px 0;
}

.modal-footer {
  display: flex;
  flex-direction: column; /* 改為縱向排列，讓確認按鈕更顯眼 */
  gap: 12px;
  margin-top: 30px;
}

.danger-confirm-btn {
  width: 100%;
  background: linear-gradient(135deg, #ff4d4d 0%, #cf1322 100%);
  color: white;
  border: none;
  padding: 16px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 77, 77, 0.3);
}

.danger-confirm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 77, 77, 0.5);
  filter: brightness(1.1);
}
.cancel-btn {
  width: 100%;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 14px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 響應式微調 */
@media (max-width: 768px) {
  .member-table th:nth-child(3),
  .member-table td:nth-child(3) {
    display: none; /* 手機版隱藏加入時間，防止跑版 */
  }
}
</style>
