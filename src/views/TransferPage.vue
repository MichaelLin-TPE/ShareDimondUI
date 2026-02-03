<template>
  <div class="transfer-container">
    <div class="transfer-card">
      <h2 class="title">快速轉帳</h2>

      <div class="input-group">
        <label>收款對象</label>
        <select class="styled-select">
          <option value="" disabled selected>請選擇接收者</option>
          <option v-for="user in mockUsers" :key="user.id" :value="user.id">
            {{ user.name }} ({{ user.role }})
          </option>
        </select>
      </div>

      <div class="input-group">
        <label>轉帳金額</label>
        <div class="amount-input-wrapper">
          <span class="currency-symbol">$</span>
          <input type="number" placeholder="0" class="amount-input" />
        </div>
      </div>

      <button class="submit-btn" @click="handleTransfer">確認送出</button>

      <p class="notice">※ 請確認對象與金額，轉帳後無法撤回</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 靜態資料
const mockUsers = [
  { id: 1, name: '櫻木花道', role: '大前鋒' },
  { id: 2, name: '流川楓', role: '小前鋒' },
  { id: 3, name: '赤木剛憲', role: '中鋒' },
]

const handleTransfer = () => {
  alert('功能開發中！')
}
</script>

<style scoped>
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
