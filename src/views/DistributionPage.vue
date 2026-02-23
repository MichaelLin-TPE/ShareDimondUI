<script setup lang="ts">
import { useAuction } from '@/composables/shareAmount.ts'
// 1. 資料定義
const {
  handleConfirm,
  allocatedAmount,
  memberList,
  clanBalanceResponseList,
  getRemaining,
  balance,
  selectedCurrency,
} = useAuction()
</script>

<template>
  <div class="fund-page">
    <div class="content-wrapper">
      <header class="page-header">
        <h1 class="title">💰 基金撥款</h1>
      </header>

      <div class="header-card">
        <template v-for="(item, index) in clanBalanceResponseList" :key="index">
          <div class="info-item">
            <span class="label">血盟總 ({{ item.currency }})</span>
            <span class="value gold">{{ item.balance.toLocaleString() }}</span>
          </div>

          <div class="info-item">
            <span class="label">剩餘 ({{ item.currency }})</span>
            <span class="value" :class="{ 'text-danger': Number(getRemaining(item)) < 0 }">
              {{ getRemaining(item).toLocaleString() }}
            </span>
          </div>
        </template>
      </div>

      <div class="form-group">
        <label>選擇幣種</label>
        <div class="currency-radio-group">
          <label v-for="item in balance.balanceList" :key="item.currency" class="currency-option">
            <input type="radio" v-model="selectedCurrency" :value="item.currency" name="currency" />
            <span class="custom-radio"></span>
            <span class="currency-name">{{ item.currency }}</span>
          </label>
        </div>
      </div>

      <div class="list-container">
        <div v-for="member in memberList" :key="member.memberId" class="member-item">
          <div class="member-info">
            <span class="name">{{ member.memberName }}</span>
            <span class="role-tag" :class="member.memberRole.toLowerCase()">{{
              member.memberRole
            }}</span>
          </div>

          <div class="input-group">
            <input
              type="number"
              v-model.number="member.memberAmount"
              class="fund-input"
              placeholder="0"
            />
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
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: #e0e0e0; /* 淺灰色標籤 */
  margin-bottom: 8px;
  font-size: 0.95rem;
  font-weight: 500;
}

.currency-radio-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 保持三行 */
  gap: 15px;
  margin-top: 10px;
}

/* 調整父容器，確保對齊 */
.currency-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  min-width: 0; /* 👈 防止 flex 子元素溢出 */
}

/* 隱藏預設 input */
.currency-option input {
  display: none;
}

/* 自定義圓圈：核心修正 */
.custom-radio {
  width: 18px; /* 固定寬度 */
  height: 18px; /* 固定高度 */
  flex: 0 0 18px; /* 👈 強制設定 flex-basis 為 18px，防止任何擠壓 */
  border: 2px solid #555;
  border-radius: 50%; /* 絕對圓角 */
  margin-right: 10px;
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  box-sizing: border-box; /* 確保 18px 包含 border */
  display: inline-block; /* 👈 確保它是區塊元素 */
}

/* 文字樣式 */
.currency-name {
  color: #ccc;
  font-size: 14px;
  white-space: nowrap; /* 防止文字換行擠壓圓圈 */
}

/* 選中狀態：外圈變色 */
.currency-option input:checked + .custom-radio {
  border-color: #7e57c2;
  box-shadow: 0 0 8px rgba(126, 87, 194, 0.5);
}

/* 選中狀態：內心實心圓 */
.currency-option input:checked + .custom-radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #88d3ce;
  border-radius: 50%;
  /* 確保內心圓也不會變形 */
  display: block;
}

/* 選中後的文字顏色 */
.currency-option input:checked ~ .currency-name {
  color: #fff;
}

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
.role-tag.會長 {
  background: rgba(255, 77, 77, 0.2);
  color: #ff4d4d;
}
.role-tag.幹部 {
  background: rgba(255, 209, 102, 0.2);
  color: #ffd166;
}
.role-tag.成員 {
  background: rgba(170, 170, 170, 0.2);
  color: #aaa;
}

.fund-input {
  background: #0f111a;
  border: 1px solid #3d405b;
  color: #ffd166;
  padding: 10px;
  border-radius: 10px;
  width: 150px;
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
