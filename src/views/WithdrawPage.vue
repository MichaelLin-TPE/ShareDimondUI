<script setup lang="ts">
import { useAuction } from '@/composables/withdraw.ts'
// 靜態資料
const { balance, memberList, amount, handleWithdraw, selectedMemberId } =
  useAuction()
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

      <div class="input-group">
        <label>提領金額</label>
        <div class="amount-wrapper">
          <input type="number" v-model="amount" placeholder="輸入金幣數量" class="withdraw-input" />
          <button class="all-in-btn" @click="amount = balance">全部提領</button>
        </div>
      </div>

      <button class="withdraw-btn" @click="handleWithdraw">送出申請給幹部</button>

      <div class="status-tip"><span class="dot pulse"></span> 申請後請靜候幹部於系統內核准撥款</div>
    </div>
  </div>
</template>

<style scoped>
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
