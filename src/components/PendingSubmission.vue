<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useBiddingTreasureStore, type RawTreasure } from '@/stores/biddingTreasure.ts'
import { useAuthStore } from '@/stores/auth.ts'
import { isSubmitted, parseRemark } from '@/composables/remarkOptions.ts'

const biddingStore = useBiddingTreasureStore()
const authStore = useAuthStore()
let unsubscribeWS: (() => void) | null = null

// 還沒結束 / 已作廢的單子不算「待繳交」
const EXCLUDED_STATUS = new Set(['ATTENDANCE_WAITING', 'BIDDING', 'CANCELED', 'FAILED'])

// 判斷某筆道具目前在誰身上(給人了就算在收到的會員身上,否則在開單者身上)
function holderOf(t: RawTreasure): string {
  const parsed = parseRemark(t.remark)
  if (parsed.choice === 'give' && parsed.memberName) return parsed.memberName
  return t.ticketOwerName || '(未知)'
}

interface PendingItem {
  itemName: string
  count: number
}
interface PendingGroup {
  member: string
  total: number
  items: PendingItem[]
}

const groups = computed<PendingGroup[]>(() => {
  const map = new Map<string, Map<string, number>>()
  for (const t of biddingStore.rawTreasures) {
    if (EXCLUDED_STATUS.has(t.status)) continue
    if (isSubmitted(t.remark, t.checkFromRepository)) continue
    const member = holderOf(t)
    if (!map.has(member)) map.set(member, new Map())
    const items = map.get(member)!
    items.set(t.itemName, (items.get(t.itemName) ?? 0) + 1)
  }
  const result: PendingGroup[] = []
  for (const [member, items] of map) {
    const itemList = [...items].map(([itemName, count]) => ({ itemName, count }))
    itemList.sort((a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName))
    const total = itemList.reduce((s, i) => s + i.count, 0)
    result.push({ member, total, items: itemList })
  }
  result.sort((a, b) => b.total - a.total || a.member.localeCompare(b.member))
  return result
})

const totalPending = computed(() => groups.value.reduce((s, g) => s + g.total, 0))

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
  <div class="ps-wrap">
    <div class="ps-head">
      <h2>📦 待繳交清單</h2>
      <span class="ps-total" v-if="totalPending > 0">共 {{ totalPending }} 件未繳</span>
    </div>

    <p class="ps-hint">統計每位會員身上尚未繳交至倉庫的道具。備註已標記「已繳倉庫」或幹部已確認存倉者不列入。</p>

    <div v-if="groups.length === 0" class="ps-empty">
      <span class="ps-empty-icon">✅</span>
      <p>太棒了,目前沒有待繳交的道具!</p>
    </div>

    <div v-else class="ps-grid">
      <div v-for="g in groups" :key="g.member" class="ps-card">
        <div class="ps-card-head">
          <span class="ps-member">🧍 {{ g.member }}</span>
          <span class="ps-count">{{ g.total }} 件</span>
        </div>
        <div class="ps-items">
          <span v-for="it in g.items" :key="it.itemName" class="ps-item">
            {{ it.itemName }}<b>×{{ it.count }}</b>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ps-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.ps-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: #f8fafc;
}
.ps-total {
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
.ps-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.5;
}

.ps-empty {
  text-align: center;
  padding: 48px 16px;
  color: #94a3b8;
}
.ps-empty-icon {
  font-size: 2.4rem;
  display: block;
  margin-bottom: 10px;
}
.ps-empty p {
  margin: 0;
  font-size: 0.95rem;
}

.ps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.ps-card {
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ps-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #2a3447;
  padding-bottom: 10px;
}
.ps-member {
  font-size: 1rem;
  font-weight: 800;
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ps-count {
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--c-light);
}
.ps-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ps-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #0f172a;
  border: 1px solid #334155;
  font-size: 0.85rem;
  color: #cbd5e1;
}
.ps-item b {
  color: var(--c-light);
  font-weight: 800;
}

@media (max-width: 768px) {
  .ps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
