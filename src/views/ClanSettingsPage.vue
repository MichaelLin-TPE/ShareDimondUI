<script setup lang="ts">
import { useAuction } from '@/composables/clanSetting.ts'
import { computed } from 'vue'

const {
  handleSave,
  handleSaveRate,
  handleUpdateBalance,
  settings,
  selectedCurrency,
  clanCurrencies,
  toggleCurrency,
  balance,
  balanceAction,
  balanceAmount,
  balanceRemark,
} = useAuction()

// 給 dropdown 用的可選幣別清單：
// 1. 優先用後端 /clan-currencies 的資料（可區分 enabled/disabled）
// 2. 若還沒拿到，fallback 到 balance store 的 balanceList（讓畫面不會空白）
const enabledCurrencies = computed<{ currencyName: string }[]>(() => {
  if (clanCurrencies.value.length > 0) {
    return clanCurrencies.value
      .filter((c) => c.enabled)
      .map((c) => ({ currencyName: c.currencyName }))
  }
  return (balance.balanceList || []).map((b) => ({ currencyName: b.currency }))
})
</script>

<template>
  <div class="cs-page">
    <!-- Header -->
    <header class="cs-header">
      <h1 class="cs-title">🛡️ 血盟設置</h1>
      <p class="cs-sub">管理公會核心規則、幣別與金庫</p>
    </header>

    <div class="cs-grid">
      <!-- ─── 公告 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">📢</span>
          <div>
            <h3>血盟公告</h3>
            <p>盟友登入後會看到的歡迎訊息</p>
          </div>
        </div>
        <textarea
          v-model="settings.announcement"
          placeholder="輸入想對盟友說的話..."
          class="cs-textarea"
          rows="4"
        ></textarea>
        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSave">💾 儲存公告</button>
        </div>
      </section>

      <!-- ─── 競標規則 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">⚔️</span>
          <div>
            <h3>競標規則</h3>
            <p>調整參與時間、競標時長與分潤比例</p>
          </div>
        </div>

        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>參與時間</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.participationMinutes"
                type="number"
                class="cs-input"
                min="1"
              />
              <span class="cs-suffix">分鐘</span>
            </div>
            <p class="cs-hint">開單後可參與「+1 分紅」的時間長度</p>
          </div>

          <div class="cs-field">
            <label>競標時間</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.auctionMinutes"
                type="number"
                class="cs-input"
                min="1"
              />
              <span class="cs-suffix">分鐘</span>
            </div>
            <p class="cs-hint">參與時間結束後，競標出價的時間</p>
          </div>

          <div class="cs-field">
            <label>血盟基金抽成</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="settings.fundPercentage"
                type="number"
                class="cs-input"
                min="0"
                max="100"
              />
              <span class="cs-suffix">%</span>
            </div>
            <p class="cs-hint">每次分紅自動撥入血盟金庫的比例</p>
          </div>

          <div class="cs-field">
            <label>固定金額單得標方式</label>
            <div
              class="cs-toggle"
              :class="{ active: settings.autoDecideWinner }"
              @click="settings.autoDecideWinner = !settings.autoDecideWinner"
            >
              <div class="cs-toggle-track">
                <div class="cs-toggle-handle"></div>
              </div>
              <span class="cs-toggle-text">
                {{ settings.autoDecideWinner ? '🎲 系統自動決定' : '✋ 手動分配' }}
              </span>
            </div>
            <p class="cs-hint">
              {{
                settings.autoDecideWinner
                  ? '到時間後系統隨機抽出得標者'
                  : '會長/幹部手動指定得標者'
              }}
            </p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSave">💾 儲存競標規則</button>
        </div>
      </section>

      <!-- ─── 幣別管理 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">💱</span>
          <div>
            <h3>幣別管理</h3>
            <p>啟用/關閉幣別，並設定基準幣與匯率</p>
          </div>
        </div>

        <!-- 幣別列表 -->
        <div class="cs-currency-list">
          <div
            v-for="item in clanCurrencies"
            :key="item.currencyName"
            class="cs-currency-item"
            :class="{ disabled: !item.enabled, base: item.baseCurrency }"
          >
            <div class="cs-currency-left">
              <span class="cs-currency-name">{{ item.currencyName }}</span>
              <span v-if="item.baseCurrency" class="cs-currency-badge base">基準</span>
              <span v-else-if="!item.enabled" class="cs-currency-badge off">已關閉</span>
              <span v-else class="cs-currency-badge on">啟用中</span>
            </div>
            <button
              class="cs-toggle-btn"
              :class="{ on: item.enabled, off: !item.enabled }"
              :disabled="item.baseCurrency"
              :title="item.baseCurrency ? '基準幣無法關閉，請先變更基準幣' : ''"
              @click="toggleCurrency(item)"
            >
              <span class="cs-toggle-dot"></span>
            </button>
          </div>

          <div v-if="clanCurrencies.length === 0" class="cs-empty">
            尚無幣別資料
          </div>
        </div>

        <div class="cs-divider"></div>

        <!-- 基準幣 + 匯率 -->
        <div class="cs-fields-2col">
          <div class="cs-field">
            <label>基準幣別</label>
            <select v-model="settings.baseCurrency" class="cs-input">
              <option v-for="c in enabledCurrencies" :key="c.currencyName" :value="c.currencyName">
                {{ c.currencyName }}
              </option>
            </select>
            <p class="cs-hint">作為計價單位的主要貨幣</p>
          </div>

          <div class="cs-field">
            <label>匯率</label>
            <div class="cs-rate-row">
              <span class="cs-rate-label">1 {{ settings.baseCurrency || '基準' }} =</span>
              <input
                v-model.number="settings.exchangeRate"
                type="number"
                class="cs-input cs-rate-input"
                min="1"
                placeholder="100"
              />
              <span class="cs-rate-label">其他幣別</span>
            </div>
            <p class="cs-hint">非基準幣兌換時的固定比例</p>
          </div>
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleSaveRate">💾 儲存幣別與匯率</button>
        </div>
      </section>

      <!-- ─── 金庫調整 ─── -->
      <section class="cs-card cs-card--full">
        <div class="cs-card-head">
          <span class="cs-card-icon">🏦</span>
          <div>
            <h3>金庫調整</h3>
            <p>手動增減血盟金庫餘額（會記錄事件）</p>
          </div>
        </div>

        <div class="cs-fields-3col">
          <div class="cs-field">
            <label>選擇幣別</label>
            <select v-model="selectedCurrency" class="cs-input">
              <option value="" disabled>請選擇</option>
              <option v-for="c in enabledCurrencies" :key="c.currencyName" :value="c.currencyName">
                {{ c.currencyName }}
              </option>
            </select>
          </div>

          <div class="cs-field">
            <label>調整方式</label>
            <div class="cs-action-toggle">
              <button
                class="cs-action-btn"
                :class="{ active: balanceAction === 'add' }"
                @click="balanceAction = 'add'"
              >
                ➕ 增加
              </button>
              <button
                class="cs-action-btn minus"
                :class="{ active: balanceAction === 'minus' }"
                @click="balanceAction = 'minus'"
              >
                ➖ 扣除
              </button>
            </div>
          </div>

          <div class="cs-field">
            <label>金額</label>
            <div class="cs-input-wrap">
              <input
                v-model.number="balanceAmount"
                type="number"
                class="cs-input"
                min="1"
                placeholder="0"
              />
              <span class="cs-suffix">{{ selectedCurrency || '幣別' }}</span>
            </div>
          </div>
        </div>

        <div class="cs-field">
          <label>調整原因 <span class="cs-required">*</span></label>
          <input
            v-model="balanceRemark"
            type="text"
            class="cs-input"
            placeholder="例如：補入活動分紅、發獎勵等"
          />
        </div>

        <div class="cs-actions">
          <button class="cs-btn-primary" @click="handleUpdateBalance">💸 確認調整</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cs-page {
  padding: 32px 20px 48px;
  max-width: 980px;
  margin: 0 auto;
  color: #e2e8f0;
}

/* Header */
.cs-header {
  margin-bottom: 28px;
}
.cs-title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow:
    0 0 8px rgba(var(--c-light-rgb), 0.45),
    0 2px 12px rgba(var(--c-deep-rgb), 0.2);
}
.cs-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
}

/* Grid */
.cs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.cs-card--full {
  grid-column: 1 / -1;
}

/* Card */
.cs-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 18px;
  padding: 24px;
}
.cs-card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.cs-card-icon {
  font-size: 1.6rem;
  filter: drop-shadow(0 0 6px rgba(var(--c-light-rgb), 0.45));
}
.cs-card-head h3 {
  margin: 0 0 2px;
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
}
.cs-card-head p {
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
}

/* Fields */
.cs-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.cs-field label {
  font-size: 0.85rem;
  color: #e2e8f0;
  margin-bottom: 6px;
  font-weight: 600;
}
.cs-required {
  color: #f87171;
}
.cs-fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 8px;
}
.cs-fields-3col {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

/* Inputs */
.cs-input,
.cs-textarea {
  width: 100%;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 0 14px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
  font-family: inherit;
  height: 44px;
  line-height: 42px;
}
.cs-input::placeholder,
.cs-textarea::placeholder {
  color: #475569;
}
.cs-input:focus,
.cs-textarea:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.cs-textarea {
  resize: none;
  margin-bottom: 14px;
  height: auto;
  min-height: 90px;
  line-height: 1.5;
  padding: 12px 14px;
}
select.cs-input {
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #94a3b8 50%),
    linear-gradient(135deg, #94a3b8 50%, transparent 50%);
  background-position: calc(100% - 18px) center, calc(100% - 13px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
.cs-input-wrap {
  position: relative;
}
.cs-suffix {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 600;
  pointer-events: none;
}
.cs-hint {
  margin: 4px 0 0;
  font-size: 0.7rem;
  color: #64748b;
  line-height: 1.4;
}

/* Toggle (open/manual) */
.cs-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 0 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  height: 44px;
  box-sizing: border-box;
}
.cs-toggle-track {
  width: 42px;
  height: 22px;
  background: #2e3147;
  border-radius: 100px;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
}
.cs-toggle.active .cs-toggle-track {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.cs-toggle-handle {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: left 0.25s;
}
.cs-toggle.active .cs-toggle-handle {
  left: 23px;
}
.cs-toggle-text {
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Currency list */
.cs-currency-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.cs-currency-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 12px;
  transition: all 0.15s;
}
.cs-currency-item.base {
  border-color: rgba(var(--c-light-rgb), 0.4);
  background: rgba(var(--c-light-rgb), 0.05);
}
.cs-currency-item.disabled {
  opacity: 0.55;
  background: #0a0c14;
}
.cs-currency-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-currency-name {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.5px;
}
.cs-currency-item.disabled .cs-currency-name {
  text-decoration: line-through;
  color: #64748b;
}
.cs-currency-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.cs-currency-badge.base {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
}
.cs-currency-badge.on {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
}
.cs-currency-badge.off {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

/* Toggle button (currency on/off) */
.cs-toggle-btn {
  width: 50px;
  height: 26px;
  border-radius: 100px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  padding: 0;
}
.cs-toggle-btn.on {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.cs-toggle-btn.off {
  background: #3a3f5c;
}
.cs-toggle-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.cs-toggle-dot {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: left 0.25s;
}
.cs-toggle-btn.on .cs-toggle-dot {
  left: 27px;
}

.cs-empty {
  text-align: center;
  padding: 24px;
  color: #64748b;
  font-size: 0.85rem;
}

.cs-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 18px 0 18px;
}

/* Rate row */
.cs-rate-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-rate-label {
  color: #94a3b8;
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}
.cs-rate-input {
  flex: 1;
  text-align: center;
  font-weight: 700;
  color: var(--c-light);
  min-width: 0;
}

/* Action toggle (add/minus) — 用明確 height 確保按鈕一定在框內 */
.cs-action-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 3px;
  height: 44px;
  box-sizing: border-box;
  overflow: hidden;
}
.cs-action-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 36px; /* 44(總) - 2(border) - 6(padding) = 36，剛好填滿 */
  margin: 0;
  border: 0;
  outline: 0;
  border-radius: 7px;
  background: transparent;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  line-height: 1;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
}
.cs-action-btn.active {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #fff;
}
.cs-action-btn.minus.active {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

/* Actions — 提交按鈕滿版 */
.cs-actions {
  margin-top: 18px;
}
.cs-btn-primary {
  width: 100%;
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
  transition: all 0.2s;
  font-family: inherit;
}
.cs-btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}

/* RWD */
@media (max-width: 768px) {
  .cs-page { padding: 20px 12px 32px; }
  .cs-header { margin-left: 48px; }
  .cs-fields-2col,
  .cs-fields-3col {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .cs-card { padding: 18px 16px; }
}
</style>
