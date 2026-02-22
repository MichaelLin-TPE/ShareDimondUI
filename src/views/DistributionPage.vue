<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAlert } from '@/utils/alerts.ts'

// 1. 資料定義
const totalFund = ref(50000)
const members = ref([
  { id: 1, name: '會長大人', role: 'LEADER', amount: 0 },
  { id: 2, name: '戰力天花板', role: 'OFFICER', amount: 0 },
  { id: 3, name: '肝帝一號', role: 'MEMBER', amount: 0 },
  { id: 4, name: '萌新小號', role: 'MEMBER', amount: 0 },
])

// 2. 計算邏輯
const allocatedAmount = computed(() => {
  return members.value.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
})

const remainingFund = computed(() => totalFund.value - allocatedAmount.value)

// 3. 按鈕動作
const handleDistributeEvenly = () => {
  const evenAmount = Math.floor(totalFund.value / members.value.length)
  members.value.forEach((m) => (m.amount = evenAmount))
}

const handleConfirm = async () => {
  if (allocatedAmount.value > totalFund.value) {
    useAlert.error('撥款總額不能超過現有基金！')
    return
  }

  const result = await useAlert.confirm(`準備撥款共 ${allocatedAmount.value} 鑽石，確定發放？`)
  if (result?.isConfirmed) {
    useAlert.success('💰 基金撥款成功！')
  }
}
</script>

<template>
  <div class="fund-page">
    <div class="content-wrapper">
      <header class="page-header">
        <h1 class="title">💰 基金撥款</h1>
      </header>

      <div class="header-card">
        <div class="info-item">
          <span class="label">血盟總基金</span>
          <span class="value gold">{{ totalFund.toLocaleString() }}</span>
        </div>
        <div class="info-item">
          <span class="label">剩餘可分配</span>
          <span class="value" :class="{ 'text-danger': remainingFund < 0 }">
            {{ remainingFund.toLocaleString() }}
          </span>
        </div>
      </div>

      <div class="list-container">
        <div v-for="member in members" :key="member.id" class="member-item">
          <div class="member-info">
            <span class="name">{{ member.name }}</span>
            <span class="role-tag" :class="member.role.toLowerCase()">{{ member.role }}</span>
          </div>

          <div class="input-group">
            <input
              type="number"
              v-model.number="member.amount"
              class="fund-input"
              placeholder="0"
            />
            <span class="unit">鑽</span>
          </div>
        </div>
      </div>

      <div class="footer-actions">
        <button class="btn-primary" @click="handleConfirm">
          💸 確認發放 ({{ allocatedAmount }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 頁面背景 */
.fund-page {
  background: #0f111a;
  min-height: 100vh;
  color: #ffffff;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}

/* 核心容器：限制最大寬度，避免滿版 */
.content-wrapper {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 24px;
  text-align: center;
}

.title {
  font-size: 1.6rem;
  font-weight: bold;
}

/* 總量卡片 */
.header-card {
  background: linear-gradient(135deg, #1e2030, #2d3047);
  border-radius: 20px;
  padding: 24px 16px;
  display: flex;
  justify-content: space-around;
  margin-bottom: 24px;
  border: 1px solid #3d405b;
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  color: #aaa;
  font-size: 0.85rem;
  margin-bottom: 6px;
}

.value {
  font-size: 1.4rem;
  font-weight: 800;
}

.gold {
  color: #ffd166;
}
.text-danger {
  color: #ff4d4d;
}

/* 列表 */
.list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 32px; /* 留空間給底部固定按鈕 */
}

.member-item {
  background: #1a1c26;
  padding: 16px 20px;
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #2d3047;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 1.1rem;
}

.role-tag {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: bold;
}
.role-tag.leader {
  background: rgba(255, 77, 77, 0.2);
  color: #ff4d4d;
}
.role-tag.officer {
  background: rgba(255, 209, 102, 0.2);
  color: #ffd166;
}
.role-tag.member {
  background: rgba(170, 170, 170, 0.2);
  color: #aaa;
}

.fund-input {
  background: #0f111a;
  border: 1px solid #3d405b;
  color: #ffd166;
  padding: 10px;
  border-radius: 10px;
  width: 90px;
  text-align: right;
  font-size: 1.1rem;
  font-weight: bold;
}

/* 底部按鈕 */
.footer-actions {
  /* 刪除 position: fixed; */
  /* 刪除 bottom, left, transform 等定位屬性 */
  width: 100%;
  padding: 0 0 40px 0; /* 底部留白即可 */
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: transparent; /* 既然不固定在底部，就不需要漸層遮罩了 */
}

button {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #ffd166, #e6b800);
  color: #0f111a;
}
</style>
