<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '@/composables/transfer.ts'
import SearchableSelect from '@/components/SearchableSelect.vue'

const {
  handleTransfer,
  memberList,
  selectedMemberId,
  inputAmount,
  balance,
  selectedCurrency,
  submitting,
} = useAuction()

interface MemberOpt { memberId: number; memberName: string; memberRole: string }
const memberSelectOptions = computed(() =>
  (memberList.value as MemberOpt[]).map((m) => ({
    value: String(m.memberId),
    label: `${m.memberName} (${m.memberRole})`,
  })),
)
const memberIdStr = computed({
  get: () => String(selectedMemberId.value ?? ''),
  set: (v: string) => {
    selectedMemberId.value = v
  },
})
</script>

<template>
  <div class="transfer-container">
    <div class="transfer-card">
      <div class="title-wrap">
        <h2 class="title">💸 快速轉帳</h2>
        <p class="subtitle">血盟內成員間互轉,送出後立即扣款</p>
      </div>

      <div class="field">
        <label>收款對象</label>
        <SearchableSelect
          v-model="memberIdStr"
          :options="memberSelectOptions"
          placeholder="輸入名稱搜尋接收者..."
        />
      </div>

      <div class="field">
        <label>選擇幣別</label>
        <div class="currency-grid">
          <label
            v-for="item in balance.balanceList"
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
        <label>轉帳金額</label>
        <div class="amount-wrapper">
          <span class="currency-prefix">$</span>
          <input
            v-model.number="inputAmount"
            type="number"
            inputmode="decimal"
            placeholder="0"
            class="amount-input"
          />
        </div>
      </div>

      <button class="submit-btn" @click="handleTransfer" :disabled="submitting">
        {{ submitting ? '送出中…' : '確認送出' }}
      </button>

      <p class="notice">⚠ 請確認對象與金額,轉帳後無法撤回</p>
    </div>
  </div>
</template>

<style scoped>
/* === 統一規範(同 CreateGuild / LoginView)===
   主色: #ffd166 (金) / linear-gradient(135deg, #ffd166, #f59e0b)
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

.transfer-container {
  padding: 32px 16px 80px;
  display: flex;
  justify-content: center;
}

.transfer-card {
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
  color: #818cf8;
  text-shadow:
    0 0 8px rgba(99, 102, 241, 0.45),
    0 2px 12px rgba(79, 70, 229, 0.2);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* Fields */
.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #e2e8f0;
  font-weight: 600;
}

/* 幣別 chip 群 */
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
  background: rgba(99, 102, 241, 0.12);
  border-color: #818cf8;
  color: #818cf8;
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
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.currency-prefix {
  color: #818cf8;
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

/* 送出按鈕(同設計系統的主動作按鈕) */
.submit-btn {
  width: 100%;
  height: 48px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0f111a;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);
  transition: all 0.2s;
}
.submit-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(245, 158, 11, 0.4);
}
.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.notice {
  margin: 14px 0 0;
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
}

@media (max-width: 480px) {
  .transfer-container {
    padding: 24px 14px 80px;
  }
  .transfer-card {
    padding: 24px 18px 22px;
    border-radius: 20px;
  }
}
</style>
