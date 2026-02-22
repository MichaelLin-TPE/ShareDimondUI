<script setup lang="ts">
import { useAuction } from '@/composables/withdraw.ts'
// 靜態資料
const {
  balance,
  memberList,
  amount,
  handleWithdraw,
  selectedMemberId,
  balanceTool,
  selectedCurrency,
} = useAuction()
</script>

<template>
  <div class="withdraw-container">
    <div class="withdraw-form">
      <div class="input-group">
        <label>審核對象 (幹部/會長)</label>
        <select class="styled-select" v-model="selectedMemberId">
          <option v-for="admin in memberList" :key="admin.memberId" :value="admin.memberId">
            [{{ admin.memberRole }}] {{ admin.memberName }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>選擇幣種</label>
        <div class="currency-radio-group">
          <label
            v-for="item in balanceTool.balanceList"
            :key="item.currency"
            class="currency-option"
          >
            <input type="radio" v-model="selectedCurrency" :value="item.currency" name="currency" />
            <span class="custom-radio"></span>
            <span class="currency-name">{{ item.currency }}</span>
          </label>
        </div>
      </div>

      <div class="input-group">
        <label>提領金額</label>
        <div class="amount-wrapper">
          <input type="number" v-model="amount" placeholder="輸入金幣數量" class="withdraw-input" />
        </div>
      </div>

      <button class="withdraw-btn" @click="handleWithdraw">送出申請給幹部</button>

      <div class="status-tip"><span class="dot pulse"></span> 申請後請靜候幹部於系統內核准撥款</div>
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

.withdraw-container {
  padding: 16px;
  max-width: 500px;
  margin: 0 auto;
}

/* 遊戲感金幣卡片 */
.balance-card {
  background: linear-gradient(135deg, #2a2d3e 0%, #161822 100%);
  border: 1px solid #ffd166; /* 金色邊框強調 */
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.balance-label {
  color: #ffd166;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.balance-amount {
  color: #ffffff;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 1px;
}

.balance-icon {
  font-size: 40px;
  filter: drop-shadow(0 0 10px rgba(255, 209, 102, 0.4));
}

/* 表單容器 */
.withdraw-form {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 20px;
  padding: 24px;
}

.input-group {
  margin-bottom: 24px;
}

.input-group label {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin-bottom: 10px;
}

/* 下拉選單與輸入框 */
.styled-select,
.styled-textarea {
  width: 100%;
  background: #1d1f2d;
  border: 1px solid #2d3047;
  border-radius: 12px;
  padding: 12px;
  color: #fff;
  font-size: 15px;
  outline: none;
}

.styled-textarea {
  resize: none;
  font-family: inherit;
}

.amount-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 2px solid #2d3047;
}

.withdraw-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 12px 0;
  color: #ffd166;
  font-size: 26px;
  font-weight: 700;
  outline: none;
}

.all-in-btn {
  background: rgba(255, 209, 102, 0.1);
  border: 1px solid #ffd166;
  color: #ffd166;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

/* 提交按鈕 */
.withdraw-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(90deg, #ffd166, #e6b800);
  border: none;
  border-radius: 14px;
  color: #0f111a;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: 0 4px 15px rgba(255, 209, 102, 0.2);
}

.withdraw-btn:active {
  transform: scale(0.97);
}

/* 狀態提示 */
.status-tip {
  margin-top: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #00ff88;
  border-radius: 50%;
}

.pulse {
  animation: shadow-pulse 1.5s infinite;
}

@keyframes shadow-pulse {
  0% {
    box-shadow: 0 0 0 0px rgba(0, 255, 136, 0.4);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(0, 255, 136, 0);
  }
}
</style>
