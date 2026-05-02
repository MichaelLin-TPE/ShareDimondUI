<script setup lang="ts">
import type { ItemPriceGroup } from '@/composables/itemPrice.ts'
import { useItemPrice } from '@/composables/itemPrice.ts'

const {
  filteredList,
  groupedList,
  keyword,
  loading,
  submitting,
  showEditModal,
  editTarget,
  editValue,
  openEdit,
  closeEdit,
  submitEdit,
  formatPrice,
} = useItemPrice()

const totalOngoing = (group: ItemPriceGroup) =>
  group.rows.reduce((sum, r) => sum + (r.ongoingBiddingCount || 0), 0)
</script>

<template>
  <div class="item-price-container">
    <div class="header-section">
      <h2 class="title">💎 物品定價管理</h2>
      <p class="subtitle">每個物品 × 幣別獨立定價,改價將連動進行中競標單</p>
    </div>

    <div class="search-bar">
      <input
        v-model="keyword"
        type="text"
        placeholder="🔍 搜尋道具或幣別..."
        class="search-input"
      />
      <span class="result-count" v-if="!loading">
        {{ groupedList.length }} 物品 / {{ filteredList.length }} 條定價
      </span>
    </div>

    <div v-if="loading" class="loading">載入中...</div>

    <div v-else-if="filteredList.length === 0" class="empty">沒有符合條件的物品</div>

    <div v-else class="grid-list">
      <div
        v-for="group in groupedList"
        :key="group.itemId"
        class="grid-card"
        :class="{ 'has-ongoing': totalOngoing(group) > 0 }"
      >
        <div class="card-header">
          <span class="card-name" :title="group.itemName">{{ group.itemName }}</span>
          <span
            v-if="totalOngoing(group) > 0"
            class="card-ongoing"
            :title="`${totalOngoing(group)} 張進行中`"
          >
            ⚠ {{ totalOngoing(group) }}
          </span>
        </div>

        <div class="cur-list">
          <div
            v-for="row in group.rows"
            :key="row.currency"
            class="cur-row"
            :class="{ 'row-active': row.ongoingBiddingCount > 0 }"
            @click="openEdit(row)"
          >
            <span class="cur-chip">{{ row.currency }}</span>
            <div class="cur-price-block">
              <span class="cur-price" :class="{ unset: row.currentPrice == null }">
                {{ formatPrice(row.currentPrice) }}
              </span>
              <span class="cur-last">最近 {{ formatPrice(row.lastFinalPrice) }}</span>
            </div>
            <span v-if="row.ongoingBiddingCount > 0" class="cur-ongoing">
              ⚠ {{ row.ongoingBiddingCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 編輯 Modal -->
    <div v-if="showEditModal" class="modal-mask" @click.self="closeEdit">
      <div class="modal-card">
        <div class="modal-title">
          更改 {{ editTarget?.itemName }}
          <span class="modal-chip">{{ editTarget?.currency }}</span>
          的底價
        </div>

        <div class="modal-row">
          <span class="row-label">目前底價</span>
          <span class="row-value">{{ formatPrice(editTarget?.currentPrice ?? null) }}</span>
        </div>
        <div class="modal-row">
          <span class="row-label">最近成交</span>
          <span class="row-value">{{ formatPrice(editTarget?.lastFinalPrice ?? null) }}</span>
        </div>

        <div class="modal-input-group">
          <label class="input-label">新的底價</label>
          <div class="amount-wrapper">
            <span class="currency-prefix">$</span>
            <input
              v-model="editValue"
              type="number"
              inputmode="decimal"
              placeholder="輸入新的價格"
              class="amount-input"
            />
          </div>
        </div>

        <div
          v-if="editTarget && editTarget.ongoingBiddingCount > 0"
          class="modal-warning"
        >
          ⚠ 此修改將立即影響 {{ editTarget.ongoingBiddingCount }} 張進行中競標單的底價
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" @click="closeEdit" :disabled="submitting">取消</button>
          <button class="btn-confirm" @click="submitEdit" :disabled="submitting">
            {{ submitting ? '更新中…' : '確認更新' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-price-container {
  padding: 24px 16px 80px;
  max-width: 1100px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 16px;
}
.title {
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
}
.subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin: 0;
}

/* 搜尋 */
.search-bar {
  margin-bottom: 14px;
  position: relative;
}
.search-input {
  width: 100%;
  background: #1d1f2d;
  border: 1px solid #2d3047;
  border-radius: 10px;
  padding: 10px 14px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: #818cf8;
}
.result-count {
  display: block;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  text-align: right;
}

.loading,
.empty {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  padding: 32px 0;
  font-size: 13px;
}

/* 網格列表 */
.grid-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  align-items: start;
}

.grid-card {
  background: linear-gradient(180deg, #1a1d2b 0%, #14161f 100%);
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 12px 14px 8px;
  transition:
    border-color 0.15s,
    box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}
.grid-card.has-ongoing {
  border-color: rgba(244, 96, 96, 0.35);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
}
.card-name {
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.card-ongoing {
  flex: 0 0 auto;
  background: rgba(244, 96, 96, 0.15);
  border: 1px solid rgba(244, 96, 96, 0.5);
  color: #ff8a8a;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

/* 幣別細列(卡內) */
.cur-list {
  display: flex;
  flex-direction: column;
}
.cur-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.cur-row:hover {
  background: rgba(99, 102, 241, 0.06);
}
.cur-row.row-active {
  background: rgba(244, 96, 96, 0.05);
}

.cur-chip {
  flex: 0 0 auto;
  display: inline-block;
  padding: 2px 9px;
  background: rgba(126, 87, 194, 0.18);
  border: 1px solid rgba(126, 87, 194, 0.5);
  color: #c2a9ee;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  min-width: 44px;
  text-align: center;
}

.cur-price-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cur-price {
  color: #818cf8;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.3px;
  line-height: 1.1;
}
.cur-price.unset {
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  font-weight: 500;
}
.cur-last {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  line-height: 1.3;
  margin-top: 1px;
}

.cur-ongoing {
  flex: 0 0 auto;
  background: rgba(244, 96, 96, 0.15);
  border: 1px solid rgba(244, 96, 96, 0.5);
  color: #ff8a8a;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
}

/* 手機 */
@media (max-width: 480px) {
  .grid-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* Modal */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-card {
  width: 100%;
  max-width: 380px;
  background: linear-gradient(180deg, #1a1d2b 0%, #11131a 100%);
  border: 1px solid #2d3047;
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.modal-title {
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.modal-chip {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(126, 87, 194, 0.18);
  border: 1px solid rgba(126, 87, 194, 0.5);
  color: #c2a9ee;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.modal-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.7);
}
.row-label {
  color: rgba(255, 255, 255, 0.4);
}
.row-value {
  color: #818cf8;
  font-weight: 600;
}

.modal-input-group {
  margin-top: 16px;
  margin-bottom: 12px;
}
.input-label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 8px;
}
.amount-wrapper {
  display: flex;
  align-items: center;
  background: #14161f;
  border: 1px solid #2d3047;
  border-radius: 10px;
  padding: 0 12px;
  transition: border-color 0.2s;
}
.amount-wrapper:focus-within {
  border-color: #818cf8;
}
.currency-prefix {
  color: #818cf8;
  font-size: 18px;
  font-weight: 700;
  margin-right: 6px;
}
.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 12px 0;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  width: 100%;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}
.amount-input:focus,
.amount-input:hover,
.amount-input:active,
.amount-input:invalid,
.amount-input:valid {
  outline: none;
  box-shadow: none;
  border: none;
}
/* 殺掉某些瀏覽器(Firefox / Safari)在 number input 上加的紅/綠驗證提示 */
.amount-input:-moz-ui-invalid,
.amount-input:-moz-ui-valid {
  box-shadow: none;
}
/* 隱藏 number input 上下調整箭頭 */
.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.amount-input[type='number'] {
  -moz-appearance: textfield;
}

.modal-warning {
  background: rgba(244, 96, 96, 0.12);
  border: 1px solid rgba(244, 96, 96, 0.35);
  border-radius: 10px;
  padding: 10px 12px;
  color: #ff8a8a;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  gap: 10px;
}
.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}
.btn-cancel {
  background: #2a2d3e;
  color: rgba(255, 255, 255, 0.7);
}
.btn-confirm {
  background: linear-gradient(90deg, #ffd166, #e6b800);
  color: #0f111a;
}
.btn-cancel:disabled,
.btn-confirm:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
