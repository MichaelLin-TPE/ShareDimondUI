<script setup lang="ts">
import { useAuction } from '@/composables/createGuild.ts'
// 靜態資料
const { newCurrency, removeCurrency, addCurrency, submit, form } = useAuction()
</script>

<template>
  <div class="guild-create-page">
    <div class="guild-card">
      <h2 class="title">建立公會</h2>

      <!-- 公會名稱 -->
      <div class="form-group">
        <label>公會名稱</label>
        <input v-model="form.guildName" placeholder="請輸入公會名稱" class="input" />
      </div>

      <!-- 分紅幣別（動態） -->
      <div class="form-group">
        <label>分紅幣別</label>

        <div class="currency-input">
          <input v-model="newCurrency" placeholder="輸入需要分紅的幣別" class="input" />
          <button class="add-button" @click="addCurrency">新增</button>
        </div>

        <div class="currency-list">
          <div v-for="(c, index) in form.currencies" :key="index" class="currency-item">
            <span class="currency-name">{{ c }}</span>
            <span class="remove" @click="removeCurrency(index)">✕</span>
          </div>
        </div>
      </div>

      <!-- 公會公告 -->
      <div class="form-group">
        <label>公會公告</label>
        <textarea
          v-model="form.notice"
          placeholder="輸入公會公告內容（例如分紅規則）"
          class="textarea"
        />
      </div>

      <!-- 創建者（遊戲角色名） -->
      <div class="form-group">
        <label>創建者遊戲名稱</label>
        <input v-model="form.creatorGameName" placeholder="輸入會長的遊戲角色名稱" class="input" />
      </div>

      <!-- 創建者（帳號） -->
      <div class="form-group">
        <label>創建者帳號</label>
        <input v-model="form.account" placeholder="輸入帳號" class="input" />
      </div>

      <!-- 創建者（密碼） -->
      <div class="form-group">
        <label>創建者密碼</label>
        <input v-model="form.password" placeholder="輸入密碼" class="input" type="password" />
      </div>

      <!-- 創建者（密碼） -->
      <div class="form-group">
        <label>創建者郵件</label>
        <input v-model="form.email" placeholder="輸入Email" class="input" type="email" />
      </div>

      <!-- 提交 -->
      <button class="submit-btn" @click="submit">創建公會</button>
    </div>
  </div>
</template>

<style>
/* =========================
   Layout
========================= */

.guild-create-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.guild-card {
  width: 420px;
  padding: 28px;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 20px;
  border: 1px solid #2e3147;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
}

/* =========================
   Title
========================= */

.title {
  text-align: center;
  color: #fff;
  margin-bottom: 24px;
  letter-spacing: 2px;
}

/* =========================
   Form
========================= */

.form-group {
  margin-bottom: 18px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* =========================
   Inputs
========================= */

.input,
.textarea {
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 0 12px;
  color: #fff;
}

.input {
  height: 44px;
  line-height: 44px;
}

.textarea {
  min-height: 90px;
  padding: 10px 12px;
  resize: none;
}

.input:focus,
.textarea:focus {
  outline: none;
  border-color: #6c7cff;
  box-shadow: 0 0 8px rgba(108, 124, 255, 0.4);
}

/* =========================
   Currency Input Row
========================= */
*,
*::before,
*::after {
  box-sizing: border-box;
}
.currency-input {
  display: flex;
  align-items: stretch; /* 改為 stretch 讓兩者等高，或維持 center 但確保高度一致 */
  gap: 10px;
  width: 100%;
}

.currency-input .input {
  flex: 1; /* 讓輸入框自動填滿剩餘空間 */
  height: 44px;
  margin: 0; /* 移除可能的預設邊距 */
}

.currency-input button {
  height: 44px;
  width: 30%;
  padding: 0 20px; /* 給按鈕一點左右寬度 */
  margin: 0; /* 👈 移除原本的 margin-bottom */
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap; /* 防止文字換行 */
}

.currency-input button {
  font-size: 13px;
  border-radius: 10px;
  border: 1px solid #2e3147;
  background: linear-gradient(135deg, #7a6cff, #8f7cff);
  color: #fff;
  cursor: pointer;
}

.currency-input button:hover {
  filter: brightness(1.1);
}

/* =========================
   Currency List
========================= */

.currency-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.currency-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e2233;
  border: 1px solid #3a3f5c;
  padding: 8px 12px;
  border-radius: 10px;
}

.currency-name {
  color: #fff;
  font-size: 13px;
  letter-spacing: 1px;
}

.remove {
  color: #ff6c6c;
  cursor: pointer;
  font-size: 14px;
}

/* =========================
   Submit Button
========================= */

.submit-btn {
  width: 100%;
  margin-top: 20px;
  height: 48px;

  background: linear-gradient(135deg, #ffb347, #ffcc33);
  color: #000;
  border: none;
  border-radius: 14px;

  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
}

.submit-btn:hover {
  filter: brightness(1.1);
}
</style>
