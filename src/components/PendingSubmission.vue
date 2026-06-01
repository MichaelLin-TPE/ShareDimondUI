<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useBiddingTreasureStore } from '@/stores/biddingTreasure.ts'
import { useAuthStore } from '@/stores/auth.ts'
import { REMARK_WAREHOUSE } from '@/composables/remarkOptions.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useAlert } from '@/utils/alerts.ts'

const biddingStore = useBiddingTreasureStore()
const authStore = useAuthStore()
let unsubscribeWS: (() => void) | null = null

// 只有作廢的單子不算「待繳交」;其餘(競拍中/待結算等)只要備註不是「已繳倉庫」都算開單者身上未繳
const EXCLUDED_STATUS = new Set(['CANCELED', 'FAILED'])

// 只看備註 — 幹部有沒有勾「確認存倉」不影響,只要備註不是「已繳倉庫」就算未繳
const isSubmitted = (remark?: string) => (remark || '').trim() === REMARK_WAREHOUSE

// 權限:自己的單自己勾;幹部以上(OFFICER/LEADER)可勾所有人的單
const myName = computed(() => authStore.member?.userName ?? '')
const isOfficerUp = computed(() => {
  const r = authStore.member?.role
  return r === 'OFFICER' || r === 'LEADER'
})
const canCheck = (member: string) => isOfficerUp.value || member === myName.value

interface PendingItem {
  itemName: string
  count: number
  /** 此物品底下所有未繳的單號,勾選時整批改備註 */
  codes: string[]
}
interface PendingGroup {
  member: string
  total: number
  items: PendingItem[]
}

const groups = computed<PendingGroup[]>(() => {
  const map = new Map<string, Map<string, string[]>>()
  for (const t of biddingStore.rawTreasures) {
    if (EXCLUDED_STATUS.has(t.status)) continue
    if (isSubmitted(t.remark)) continue
    const member = t.ticketOwerName || '(未知)'
    if (!map.has(member)) map.set(member, new Map())
    const items = map.get(member)!
    if (!items.has(t.itemName)) items.set(t.itemName, [])
    items.get(t.itemName)!.push(t.treasureCode)
  }
  const result: PendingGroup[] = []
  for (const [member, items] of map) {
    const itemList = [...items].map(([itemName, codes]) => ({
      itemName,
      count: codes.length,
      codes,
    }))
    itemList.sort((a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName))
    const total = itemList.reduce((s, i) => s + i.count, 0)
    result.push({ member, total, items: itemList })
  }
  result.sort((a, b) => b.total - a.total || a.member.localeCompare(b.member))
  return result
})

const totalPending = computed(() => groups.value.reduce((s, g) => s + g.total, 0))

// 處理中的物品 key(member|itemName),避免重複點擊;勾選後該物品會在 refresh 後消失
const busy = ref<Set<string>>(new Set())
const itemKey = (member: string, itemName: string) => `${member}|${itemName}`

async function updateRemarkToWarehouse(ticketCode: string) {
  const ts = Math.floor(Date.now() / 1000).toString()
  const res = await window.fetch('https://api.gameshare-system.com/update_remark', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authStore.authToken}`,
      'Content-Type': 'application/json',
      Sign: generateSignature(ts),
      TimeStamp: ts,
    },
    body: JSON.stringify({ ticketCode, remark: REMARK_WAREHOUSE }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || '更新備註失敗')
}

async function checkItem(group: PendingGroup, item: PendingItem) {
  if (!canCheck(group.member)) return
  const key = itemKey(group.member, item.itemName)
  if (busy.value.has(key)) return
  busy.value = new Set(busy.value).add(key)
  try {
    // 整批把此物品的單改成「已繳倉庫」
    for (const code of item.codes) {
      await updateRemarkToWarehouse(code)
    }
    useAlert.success(`已將 ${item.itemName} ×${item.count} 標記為已繳倉庫`)
    await biddingStore.refresh()
  } catch (e) {
    useAlert.error(e instanceof Error ? e.message : '更新備註失敗,請再試一次')
  } finally {
    const next = new Set(busy.value)
    next.delete(key)
    busy.value = next
  }
}

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

    <p class="ps-hint">
      統計每位會員身上尚未繳交至倉庫的道具。勾選物品即把該單備註改為「已繳倉庫」,整張單全勾後即從清單消失。
      自己的單自己勾;{{ isOfficerUp ? '你是幹部以上,可代勾所有人的單。' : '幹部以上可代勾所有人的單。' }}
    </p>

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
          <label
            v-for="it in g.items"
            :key="it.itemName"
            class="ps-item"
            :class="{
              'ps-item--disabled': !canCheck(g.member),
              'ps-item--busy': busy.has(itemKey(g.member, it.itemName)),
            }"
            :title="canCheck(g.member) ? '勾選 = 已繳倉庫' : '只有本人或幹部以上可勾'"
          >
            <input
              type="checkbox"
              class="ps-check"
              :checked="busy.has(itemKey(g.member, it.itemName))"
              :disabled="!canCheck(g.member) || busy.has(itemKey(g.member, it.itemName))"
              @change="checkItem(g, it)"
            />
            <span class="ps-item-name">{{ it.itemName }}<b>×{{ it.count }}</b></span>
          </label>
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
  gap: 7px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #0f172a;
  border: 1px solid #334155;
  font-size: 0.85rem;
  color: #cbd5e1;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, opacity 0.12s;
}
.ps-item:hover:not(.ps-item--disabled):not(.ps-item--busy) {
  border-color: var(--c-light);
  background: #131c30;
}
.ps-item--disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.ps-item--busy {
  cursor: progress;
  border-color: var(--c-light);
  opacity: 0.7;
}
.ps-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--c-light);
  cursor: inherit;
}
.ps-item-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
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
