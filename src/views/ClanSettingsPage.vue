<template>
  <div class="admin-container">
    <div class="header-section">
      <h2 class="title">🛡️ 血盟設置</h2>
      <p class="subtitle">管理血盟核心規則、公告與拍賣參數</p>
    </div>

    <div class="management-card p-8">
      <div class="setting-group mb-8">
        <label class="setting-label">血盟碎碎念 (佈告欄)</label>
        <textarea
          v-model="settings.announcement"
          placeholder="輸入想對盟友說的話..."
          class="setting-textarea"
          rows="4"
        ></textarea>
      </div>

      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">參與時間設置 (分鐘)</label>
          <div class="input-wrapper">
            <input type="number" v-model="settings.participationMinutes" class="setting-input" />
            <span class="unit-tag">MIN</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">競標時間設置 (分鐘)</label>
          <div class="input-wrapper">
            <input type="number" v-model="settings.auctionMinutes" class="setting-input" />
            <span class="unit-tag">MIN</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">血盟基金百分比</label>
          <div class="input-wrapper">
            <input
              type="number"
              v-model="settings.fundPercentage"
              class="setting-input"
              max="100"
              min="0"
            />
            <span class="unit-tag">%</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">固定金額單得標人決定方式</label>
          <div
            class="toggle-container"
            @click="settings.autoDecideWinner = !settings.autoDecideWinner"
          >
            <div class="toggle-track" :class="{ active: settings.autoDecideWinner }">
              <div class="toggle-handle"></div>
            </div>
            <span class="toggle-text">
              {{ settings.autoDecideWinner ? '系統自動決定' : '手動分配' }}
            </span>
          </div>
        </div>
      </div>

      <div class="footer-actions mt-8">
        <button class="save-btn" @click="handleSave">更新血盟設置</button>
      </div>
    </div>

    <div class="management-card p-8">
      <div class="header-section" style="margin-bottom: 20px">
        <h3 class="title" style="font-size: 20px">💱 幣別與匯率設置</h3>
        <p class="subtitle">設定系統轉換計算用的基準幣別與預設比值</p>
      </div>

      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">基準幣別</label>
          <div class="input-wrapper">
            <input
              type="text"
              v-model="settings.baseCurrency"
              class="setting-input"
              placeholder="例如: 元寶"
            />
            <span class="unit-tag">幣別</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">基準比值</label>
          <div class="input-wrapper">
            <input
              type="number"
              v-model="settings.exchangeRate"
              class="setting-input"
              placeholder="例如: 330"
            />
            <span class="unit-tag">比值</span>
          </div>
        </div>
      </div>

      <div class="footer-actions mt-8">
        <button class="save-btn" @click="handleSaveRate">更新匯率設置</button>
      </div>
    </div>
    <div class="management-card p-8">
      <div class="settings-grid">
        <div class="form-group">
          <label>選擇幣種</label>
          <div class="currency-radio-group">
            <label v-for="item in balance.balanceList" :key="item.currency" class="currency-option">
              <input
                type="radio"
                v-model="selectedCurrency"
                :value="item.currency"
                name="currency"
              />
              <span class="custom-radio"></span>
              <span class="currency-name">{{ item.currency }}</span>
            </label>
          </div>
        </div>
      </div>
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label_balance">增加公積金填這</label>
          <div class="input-wrapper">
            <input type="number" v-model="settings.addClanBalance" class="setting-input" />
            <span class="unit-tag">{{ selectedCurrency }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label_balance">增加公積金原因</label>
          <div class="input-wrapper">
            <input type="text" v-model="settings.addRemark" class="setting-input" />
            <span class="unit-tag">原因</span>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label_balance">減少公積金填這</label>
          <div class="input-wrapper">
            <input type="number" v-model="settings.minusClanBalance" class="setting-input" />
            <span class="unit-tag">{{ selectedCurrency }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label_balance">減少公積金原因</label>
          <div class="input-wrapper">
            <input type="text" v-model="settings.minusRemark" class="setting-input" />
            <span class="unit-tag">原因</span>
          </div>
        </div>
      </div>

      <div class="footer-actions mt-8">
        <button class="save-btn" @click="handleUpdateBalance">更新血盟基金</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuction } from '@/composables/clanSetting.ts'

const { handleSave, settings, balance, selectedCurrency, handleUpdateBalance, handleSaveRate } =
  useAuction()
</script>

<style scoped>
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

/* 引用你原本 Page 的變數與結構 */
.admin-container {
  padding: 40px 24px;
  max-width: 800px;
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

.management-card {
  background: #161822;
  border: 1px solid #24263a;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  padding: 40px;
  margin-top: 15px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}
.setting-label_balance,
.setting-label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
  margin-top: 10px;
}

/* 輸入框風格 (與搜尋框一致) */
.setting-textarea,
.setting-input {
  width: 100%;
  background: #0f111a;
  border: 1px solid #2d3047;
  border-radius: 12px;
  padding: 12px 16px;
  color: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.setting-textarea:focus,
.setting-input:focus {
  border-color: #6366f1;
}

/* 單位標籤設計 */
.input-wrapper {
  position: relative;
}
.unit-tag {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-weight: bold;
}

/* 自定義開關 (Toggle Switch) */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle-track {
  width: 50px;
  height: 26px;
  background: #2d3047;
  border-radius: 50px;
  position: relative;
  transition: background 0.3s;
}

.toggle-track.active {
  background: linear-gradient(135deg, #00ff88, #059669); /* 延續幹部綠色系 */
}

.toggle-handle {
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: left 0.3s;
}

.active .toggle-handle {
  left: 27px;
}

.toggle-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

/* 儲存按鈕 (延續原本按鈕樣式) */
.save-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
}
</style>
