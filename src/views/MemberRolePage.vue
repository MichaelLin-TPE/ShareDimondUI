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
        <div v-for="member in mockMembers" :key="member.id" class="member-item">
          <div class="member-info">
            <div class="avatar">{{ member.name.charAt(0) }}</div>
            <div class="details">
              <div class="name">{{ member.name }}</div>
              <div class="current-role" :class="member.role">
                {{ roleLabels[member.role] }}
              </div>
            </div>
          </div>

          <div class="role-actions">
            <button
              class="action-btn btn-member"
              :class="{ active: member.role === 'member' }"
              title="設為一般成員"
            >
              成員
            </button>
            <button
              class="action-btn btn-officer"
              :class="{ active: member.role === 'officer' }"
              title="設為幹部"
            >
              幹部
            </button>
            <button
              class="action-btn btn-leader"
              @click="confirmTransfer(member.name)"
              title="移交會長職位"
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

<script setup lang="ts">
const roleLabels: Record<string, string> = {
  leader: '會長',
  officer: '財務幹部',
  member: '一般成員',
}

const mockMembers = [
  { id: 1, name: '櫻木花道', role: 'member' },
  { id: 2, name: '流川楓', role: 'officer' },
  { id: 3, name: '赤木剛憲', role: 'leader' },
  { id: 4, name: '宮城良田', role: 'member' },
]

const confirmTransfer = (name: string) => {
  confirm(`確定要將會長職位移交給「${name}」嗎？此操作不可逆！`)
}

const handleSave = () => {
  alert('權限更新成功！')
}
</script>

<style scoped>
.admin-container {
  padding: 40px 24px; /* 增加上下高度感 */
  max-width: 1000px; /* 👈 從 650px 放大到 1000px */
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

/* 管理卡片 */
.management-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px; /* 稍微加圓潤一點 */
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); /* 增加陰影深淺感 */
}

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

/* 成員列表 */
.member-list {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px; /* 👈 增加內距，讓每一列更寬敞 */
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
  width: 48px; /* 👈 頭像同步加大 */
  height: 48px;
  font-size: 18px;
}

.name {
  color: #fff;
  font-size: 18px; /* 👈 名字加大 */
  font-weight: 600;
}

.current-role {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px;
  display: inline-block;
}

.current-role.leader {
  background: rgba(255, 209, 102, 0.2);
  color: #ffd166;
}
.current-role.officer {
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
}
.current-role.member {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
}

/* 按鈕組 */
.role-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #2d3047;
  background: #1d1f2d; /* 深色底 */
  color: #888; /* 灰色字 */
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: #ffd166;
  color: #fff;
}

.action-btn.active {
  background: linear-gradient(135deg, #4cc9f0, #4361ee); /* 採用你圖中的藍紫色漸層 */
  border: none;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 4px 15px rgba(67, 97, 238, 0.4); /* 增加發光感 */
}

.action-btn.btn-officer.active {
  background: linear-gradient(135deg, #ffd166, #e6b800);
  color: #0f111a;
  box-shadow: 0 4px 15px rgba(255, 209, 102, 0.3);
}

/* 特殊處理：如果是選中「會長」，可以用紅色警告色 */
.action-btn.btn-leader.active {
  background: linear-gradient(135deg, #ff4d4d, #d90429);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(255, 77, 77, 0.3);
}

.btn-leader:hover {
  background: #ff4d4d;
  color: #fff;
  border-color: #ff4d4d;
}

/* 底部送出 */
.footer-actions {
  padding: 32px;
  display: flex;
  justify-content: center;
}

.save-btn {
  width: 100%;
  max-width: 400px; /* 👈 儲存按鈕不一定要全寬，居中更美觀 */
  margin: 0 auto;
  padding: 18px;
  font-size: 18px;
  letter-spacing: 2px;
}

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
