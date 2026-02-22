<script setup lang="ts">
import { useAuction } from '@/composables/transfer.ts'
// 靜態資料
const { handleTransfer, memberList, selectedMemberId, inputAmount, balance, selectedCurrency } =
  useAuction()
</script>

<template>
  <div class="transfer-container">
    <div class="transfer-card">
      <h2 class="title">快速轉帳</h2>

      <div class="input-group">
        <label>收款對象</label>
        <select v-model="selectedMemberId" class="styled-select">
          <option value="" disabled selected>請選擇接收者</option>
          <option v-for="user in memberList" :key="user.memberId" :value="user.memberId">
            {{ user.memberName }} ({{ user.memberRole }})
          </option>
        </select>
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

      <div class="input-group">
        <label>轉帳金額</label>
        <div class="amount-input-wrapper">
          <span class="currency-symbol">$</span>
          <input v-model.number="inputAmount" type="number" placeholder="0" class="amount-input" />
        </div>
      </div>

      <button class="submit-btn" @click="handleTransfer">確認送出</button>

      <p class="notice">※ 請確認對象與金額，轉帳後無法撤回</p>
    </div>
  </div>
</template>

<style scoped>
/* --- Form Groups --- */
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

.transfer-container {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.transfer-card {
  width: 100%;
  max-width: 450px;
  background: linear-gradient(180deg, #161822, #0f111a);
  border: 1px solid #24263a;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.title {
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
}

/* 輸入框群組 */
.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  color: #ffd166;
  font-size: 14px;
  margin-bottom: 8px;
  font-weight: 500;
}

/* 下拉選單樣式 */
.styled-select {
  width: 100%;
  background: #1d1f2d;
  border: 1px solid #2d3047;
  border-radius: 10px;
  padding: 12px;
  color: #ffffff;
  font-size: 16px;
  outline: none;
  appearance: none; /* 移除原生箭頭 */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffd166' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 15px center;
}

/* 金額輸入框 */
.amount-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 15px;
  color: #ffd166;
  font-size: 18px;
  font-weight: bold;
}

.amount-input {
  width: 100%;
  background: #1d1f2d;
  border: 1px solid #2d3047;
  border-radius: 10px;
  padding: 12px 12px 12px 35px;
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.2s;
}

.amount-input:focus {
  border-color: #ffd166;
}

/* 送出按鈕 */
.submit-btn {
  width: 100%;
  background: linear-gradient(90deg, #ffd166, #e6b800);
  border: none;
  border-radius: 12px;
  padding: 14px;
  color: #0f111a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 10px;
  box-shadow: 0 4px 15px rgba(255, 209, 102, 0.3);
  transition:
    transform 0.1s,
    opacity 0.2s;
}

.submit-btn:active {
  transform: scale(0.98);
}

.submit-btn:hover {
  opacity: 0.9;
}

.notice {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  margin-top: 16px;
}
</style>
