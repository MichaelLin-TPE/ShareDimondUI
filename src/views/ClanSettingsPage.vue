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
  </div>
</template>

<script setup lang="ts">
import { useAuction } from '@/composables/clanSetting.ts'

const { handleSave, settings } = useAuction()
</script>

<style scoped>
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

.setting-label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: block;
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
