<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useBiddingTreasureStore } from '@/stores/biddingTreasure.ts'
import { useAuthStore } from '@/stores/auth.ts'
import { REMARK_WAREHOUSE } from '@/composables/remarkOptions.ts'

const biddingStore = useBiddingTreasureStore()
const authStore = useAuthStore()
let unsubscribeWS: (() => void) | null = null

// 作廢的單子不算庫存;其餘只要備註是「已繳倉庫」就視為現有庫存
const EXCLUDED_STATUS = new Set(['CANCELED', 'FAILED'])
const isWarehouse = (remark?: string) => (remark || '').trim() === REMARK_WAREHOUSE

interface StockItem {
  itemName: string
  count: number
}

// 全盟彙總:把所有「已繳倉庫」的道具,依物品名統計件數
const stocks = computed<StockItem[]>(() => {
  const map = new Map<string, number>()
  for (const t of biddingStore.rawTreasures) {
    if (EXCLUDED_STATUS.has(t.status)) continue
    if (!isWarehouse(t.remark)) continue
    const name = t.itemName || '(未知)'
    map.set(name, (map.get(name) ?? 0) + 1)
  }
  // 依物品名排序(穩定),不依件數 — 入庫/出庫後件數會變,但位置維持不動
  return [...map]
    .map(([itemName, count]) => ({ itemName, count }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName))
})

const totalPieces = computed(() => stocks.value.reduce((s, i) => s + i.count, 0))
const totalKinds = computed(() => stocks.value.length)

onMounted(() => {
  biddingStore.refresh()
  const clanId = authStore?.member?.clanId
  if (clanId) unsubscribeWS = biddingStore.subscribe(clanId)
})
onUnmounted(() => {
  unsubscribeWS?.()
  unsubscribeWS = null
})
</script>

<template>
  <div class="inv-wrap">
    <div class="inv-head">
      <h2>🗃️ 目前庫存</h2>
      <span class="inv-total" v-if="totalPieces > 0">
        {{ totalKinds }} 種 · 共 {{ totalPieces }} 件
      </span>
    </div>

    <p class="inv-hint">
      統計所有已繳交至倉庫(備註「已繳倉庫」)的道具,依物品彙總目前持有件數。此區僅幹部以上可見。
    </p>

    <div v-if="stocks.length === 0" class="inv-empty">
      <span class="inv-empty-icon">📭</span>
      <p>目前倉庫沒有任何已入庫的道具。</p>
    </div>

    <div v-else class="inv-grid">
      <div v-for="s in stocks" :key="s.itemName" class="inv-tile">
        <span class="inv-item-name">{{ s.itemName }}</span>
        <span class="inv-item-count">×{{ s.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inv-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.inv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.inv-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #f8fafc;
}
.inv-total {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
  white-space: nowrap;
}
.inv-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.5;
}

.inv-empty {
  text-align: center;
  padding: 48px 16px;
  color: #94a3b8;
}
.inv-empty-icon {
  font-size: 2.4rem;
  display: block;
  margin-bottom: 10px;
}
.inv-empty p {
  margin: 0;
  font-size: 0.95rem;
}

.inv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.inv-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 12px;
  transition: border-color 0.12s, background 0.12s;
}
.inv-tile:hover {
  border-color: var(--c-light);
  background: #131c30;
}
.inv-item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-item-count {
  flex-shrink: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--c-light);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .inv-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
