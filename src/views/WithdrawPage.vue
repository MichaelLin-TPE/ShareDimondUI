<script setup lang="ts">
import { useAuction } from '@/composables/withdraw.ts'
import MemberSelect from '@/components/MemberSelect.vue'

const {
  balanceTool,
  amount,
  handleWithdraw,
  selectedMemberId,
  selectedCurrency,
  memberList,
  submitting,
} = useAuction()
</script>

<template>
  <div class="withdraw-container">
    <div class="withdraw-card">
      <div class="title-wrap">
        <h2 class="title">📤 申請提款</h2>
        <p class="subtitle">送出後由幹部 / 會長審核撥款,凍結金額至審核完成</p>
      </div>

      <div class="field">
        <label>審核對象 <span class="hint-tag">幹部 / 會長</span></label>
        <MemberSelect
          v-model="selectedMemberId"
          :members="memberList"
          placeholder="選擇審核者"
        />
      </div>

      <div class="field">
        <label>選擇幣別</label>
        <div class="currency-grid">
          <label
            v-for="item in balanceTool.balanceList"
            :key="item.currency"
            class="currency-chip"
            :class="{ active: selectedCurrency === item.currency }"
          >
            <input
              type="radio"
              v-model="selectedCurrency"
              :value="item.currency"
              name="currency"
            />
            <span>{{ item.currency }}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label>提領金額</label>
        <div class="amount-wrapper">
          <span class="currency-prefix">$</span>
          <input
            v-model="amount"
            type="number"
            inputmode="decimal"
            placeholder="輸入金額"
            class="amount-input"
          />
        </div>
      </div>

      <button class="submit-btn" @click="handleWithdraw" :disabled="submitting">
        {{ submitting ? '送出中…' : '送出申請給幹部' }}
      </button>

      <div class="status-tip">
        <span class="dot pulse"></span>
        申請後請靜候審核,撥款會即時通知
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 統一規範(同 LoginView / CreateGuild / TransferPage)===
   主色: var(--c-light) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.withdraw-container {
  padding: 32px 16px 80px;
  display: flex;
  justify-content: center;
}

.withdraw-card {
  width: 100%;
  max-width: 460px;
  padding: 28px 24px 24px;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}

/* Header */
.title-wrap {
  text-align: center;
  margin-bottom: 22px;
}
.title {
  margin: 0 0 4px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow:
    0 0 8px rgba(var(--c-light-rgb), 0.45),
    0 2px 12px rgba(var(--c-deep-rgb), 0.2);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.5;
}

/* Fields */
.field {
  margin-bottom: 16px;
}
.field label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #e2e8f0;
  font-weight: 600;
}
.hint-tag {
  font-size: 0.72rem;
  color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 700;
}

/* 幣別 chip */
.currency-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.currency-chip {
  position: relative;
  cursor: pointer;
  display: block;
}
.currency-chip input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.currency-chip span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #94a3b8;
  font-size: 0.92rem;
  font-weight: 600;
  transition: all 0.15s;
}
.currency-chip:hover span {
  border-color: #3a3f5c;
  color: #e2e8f0;
}
.currency-chip.active span {
  background: rgba(var(--c-light-rgb), 0.12);
  border-color: var(--c-light);
  color: var(--c-light);
}

/* 金額輸入 */
.amount-wrapper {
  display: flex;
  align-items: center;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 0 14px;
  transition: all 0.15s;
}
.amount-wrapper:focus-within {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.currency-prefix {
  color: var(--c-light);
  font-size: 1rem;
  font-weight: 800;
  margin-right: 6px;
}
.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  height: 42px;
  padding: 0;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
  width: 100%;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}
.amount-input::placeholder {
  color: #475569;
}
.amount-input:focus,
.amount-input:invalid,
.amount-input:valid {
  outline: none;
  box-shadow: none;
  border: none;
}
.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.amount-input[type='number'] {
  -moz-appearance: textfield;
}

/* 送出按鈕 */
.submit-btn {
  width: 100%;
  height: 48px;
  margin-top: 8px;
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
}
.submit-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}
.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

/* 狀態提示 */
.status-tip {
  margin-top: 14px;
  font-size: 0.78rem;
  color: #64748b;
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
  flex-shrink: 0;
}
.pulse {
  animation: dot-pulse 1.5s infinite;
}
@keyframes dot-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.5);
  }
  100% {
    box-shadow: 0 0 0 8px rgba(0, 255, 136, 0);
  }
}

@media (max-width: 480px) {
  .withdraw-container {
    padding: 24px 14px 80px;
  }
  .withdraw-card {
    padding: 24px 18px 22px;
    border-radius: 20px;
  }
}
</style>
