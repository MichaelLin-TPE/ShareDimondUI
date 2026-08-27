<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const authStore = useAuthStore()
const sharedLists = useSharedListsStore()
const API = 'https://api.gameshare-system.com'

interface DistRow {
  id: number
  leaderName: string
  totalAmount: number
  recipientCount: number
  detail: string
  poolBefore: number
  poolAfter: number
  currencyCode: string
  createdAt: string
}

const balance = ref(0)
const currency = ref('')
const loading = ref(false)
const distributing = ref(false)
const history = ref<DistRow[]>([])

const members = ref<{ memberId: number; memberName: string }[]>([])
const amounts = ref<Record<number, number | null>>({})

function headers() {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

const totalToDistribute = computed(() =>
  Object.values(amounts.value).reduce((s: number, v) => s + (Number(v) > 0 ? Math.floor(Number(v)) : 0), 0),
)
const remaining = computed(() => balance.value - totalToDistribute.value)
const overBudget = computed(() => totalToDistribute.value > balance.value)

async function loadInfo() {
  loading.value = true
  try {
    const res = await fetch(`${API}/jackpot/distribute/info`, { headers: headers() })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message || '讀取失敗')
      return
    }
    balance.value = Number(data.balance) || 0
    currency.value = data.currency || ''
  } catch {
    useAlert.error('讀取失敗')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  try {
    const res = await fetch(`${API}/jackpot/distribute/history`, { headers: headers() })
    if (!res.ok) return
    history.value = await res.json()
  } catch {
    /* ignore */
  }
}

async function loadMembers() {
  await sharedLists.loadMembers()
  members.value = sharedLists.members.map((m) => ({ memberId: m.memberId, memberName: m.memberName }))
}

// 平均分配整個池給有填金額(>0)或勾選的人 — 這裡簡化為:平均分給所有成員
function splitEvenlyAmong(ids: number[]) {
  if (!ids.length || balance.value <= 0) return
  const each = Math.floor(balance.value / ids.length)
  const next: Record<number, number | null> = {}
  ids.forEach((id) => (next[id] = each))
  amounts.value = next
}

const checked = ref<Set<number>>(new Set())
function toggleCheck(id: number) {
  const s = new Set(checked.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  checked.value = s
}
function splitToChecked() {
  splitEvenlyAmong([...checked.value])
}
function clearAll() {
  amounts.value = {}
  checked.value = new Set()
}

async function distribute() {
  const items = Object.entries(amounts.value)
    .map(([memberId, amount]) => ({ memberId: Number(memberId), amount: Math.floor(Number(amount) || 0) }))
    .filter((i) => i.amount > 0)
  if (!items.length) {
    useAlert.error('請至少給一位成員填入金額')
    return
  }
  if (overBudget.value) {
    useAlert.error('分配總額超過彩金池餘額')
    return
  }
  const total = items.reduce((s, i) => s + i.amount, 0)
  if (!window.confirm(`確定把彩金池 $${total} ${currency.value} 分配給 ${items.length} 位成員?\n此動作會全血盟公告、記入個人帳戶,無法撤銷。`))
    return
  distributing.value = true
  try {
    const res = await fetch(`${API}/jackpot/distribute`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message || '分配失敗')
      return
    }
    useAlert.success(data.message || '分配成功')
    clearAll()
    await Promise.all([loadInfo(), loadHistory()])
  } catch {
    useAlert.error('分配失敗')
  } finally {
    distributing.value = false
  }
}

function fmtDate(s: string) {
  return s ? s.replace('T', ' ').slice(0, 19) : ''
}

onMounted(() => {
  loadInfo()
  loadHistory()
  loadMembers()
})
</script>

<template>
  <div class="jd-wrap">
    <div class="jd-head">
      <h1>🎁 彩金分配區</h1>
      <p class="jd-sub">把彩金池分配給成員(可含自己)。</p>
    </div>

    <!-- 透明說明 -->
    <div class="jd-note">
      <b>💡 為什麼公開透明?</b>
      彩金池是全血盟下注抽水累積的<b>公共資金</b>。這裡的每一筆分配都會:
      <ol>
        <li>記入收款人的<b>個人帳戶</b>(對方看得到)</li>
        <li>發<b>全血盟公告</b>(所有成員都收到通知、看得到「誰分了多少給誰」)</li>
        <li>留存<b>分配紀錄</b>(下方永久可查、任何成員都能看)</li>
      </ol>
      杜絕黑箱 — 分了什麼,全盟都看得見。
      <p class="jd-note-warn">
        ⚠️ 彩金池是<b>拉霸 / 妞妞 / 骰寶等遊戲共用</b>的池子(遊戲下注抽水進池、也從這池中頭獎)。
        分配出去的錢就<b>不會再進遊戲頭獎</b>,可只分一部分、保留其餘(例:池 500 萬,只分 100 萬給大家,其餘 400 萬留在池裡繼續讓遊戲抽獎)。
      </p>
    </div>

    <!-- 池餘額 -->
    <div class="jd-pool">
      <span class="jd-pool-label">目前彩金池餘額</span>
      <span class="jd-pool-amt">${{ balance.toLocaleString() }} <span class="jd-cur">{{ currency }}</span></span>
    </div>

    <!-- 分配設定 -->
    <div class="jd-card">
      <div class="jd-card-head">
        <b>分配給成員</b>
        <div class="jd-actions">
          <button class="jd-btn ghost" @click="splitToChecked" :disabled="!checked.size">平均分給勾選者</button>
          <button class="jd-btn ghost" @click="clearAll">清空</button>
        </div>
      </div>

      <div v-if="loading" class="jd-state">載入中…</div>
      <div v-else class="jd-list">
        <div v-for="m in members" :key="m.memberId" class="jd-row">
          <label class="jd-check">
            <input type="checkbox" :checked="checked.has(m.memberId)" @change="toggleCheck(m.memberId)" />
            <span class="jd-name">{{ m.memberName }}</span>
          </label>
          <input
            v-model.number="amounts[m.memberId]"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            class="jd-amt"
          />
        </div>
      </div>

      <div class="jd-summary" :class="{ over: overBudget }">
        <span>合計分配 <b>${{ totalToDistribute.toLocaleString() }}</b></span>
        <span>分配後池餘 <b>${{ remaining.toLocaleString() }}</b></span>
      </div>
      <p v-if="overBudget" class="jd-warn">⚠️ 分配總額超過彩金池餘額,請調低</p>

      <button
        class="jd-btn primary jd-distribute"
        :disabled="distributing || overBudget || totalToDistribute <= 0"
        @click="distribute"
      >
        {{ distributing ? '分配中…' : '確認分配' }}
      </button>
    </div>

    <!-- 分配紀錄(透明) -->
    <div class="jd-card">
      <div class="jd-card-head"><b>📜 分配紀錄</b><span class="jd-muted">(全盟公開)</span></div>
      <div v-if="!history.length" class="jd-state">還沒有任何分配紀錄</div>
      <div v-else class="jd-hist">
        <div v-for="h in history" :key="h.id" class="jd-hist-row">
          <div class="jd-hist-top">
            <span class="jd-hist-total">分配 ${{ Number(h.totalAmount).toLocaleString() }} {{ h.currencyCode }}</span>
            <span class="jd-muted small">{{ fmtDate(h.createdAt) }}</span>
          </div>
          <div class="jd-hist-detail">{{ h.detail }}</div>
          <div class="jd-muted small">
            由「{{ h.leaderName }}」分配給 {{ h.recipientCount }} 人 · 池 ${{ Number(h.poolBefore).toLocaleString() }} → ${{ Number(h.poolAfter).toLocaleString() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jd-wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 4px 40px;
}
.jd-head h1 {
  color: #f1f5f9;
  font-size: 1.4rem;
  margin: 0 0 4px;
}
.jd-sub {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0 0 16px;
}
.jd-note {
  background: rgba(var(--c-deep-rgb), 0.25);
  border: 1px solid #2e3147;
  border-radius: 12px;
  padding: 14px 16px;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.6;
  margin-bottom: 16px;
}
.jd-note b {
  color: var(--c-light);
}
.jd-note ol {
  margin: 8px 0 6px;
  padding-left: 20px;
}
.jd-note li {
  margin: 3px 0;
}
.jd-note-warn {
  margin: 10px 0 0;
  padding: 10px 12px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 10px;
  color: #fca5a5;
  font-size: 0.83rem;
  line-height: 1.55;
}
.jd-note-warn b {
  color: #fecaca;
}
.jd-pool {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(var(--c-light-rgb), 0.18), rgba(var(--c-deep-rgb), 0.28));
  border: 1px solid var(--c-mid);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.jd-pool-label {
  color: #cbd5e1;
  font-size: 0.9rem;
}
.jd-pool-amt {
  color: #fde68a;
  font-size: 1.5rem;
  font-weight: 800;
}
.jd-cur {
  font-size: 0.9rem;
  color: #cbd5e1;
  font-weight: 600;
}
.jd-card {
  background: #141726;
  border: 1px solid #2e3147;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.jd-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #e2e8f0;
  margin-bottom: 10px;
}
.jd-actions {
  display: flex;
  gap: 8px;
}
.jd-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
}
.jd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 8px 12px;
}
.jd-check {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.jd-name {
  color: #e2e8f0;
  font-size: 0.92rem;
}
.jd-amt {
  width: 130px;
  background: #1a1d2e;
  border: 1px solid #2e3147;
  border-radius: 8px;
  color: #f1f5f9;
  padding: 7px 10px;
  text-align: right;
  font-size: 0.95rem;
}
.jd-summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  color: #cbd5e1;
  font-size: 0.92rem;
}
.jd-summary b {
  color: #f1f5f9;
}
.jd-summary.over b {
  color: #f87171;
}
.jd-warn {
  color: #f87171;
  font-size: 0.85rem;
  margin: 6px 0 0;
}
.jd-btn {
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 8px 14px;
  transition: opacity 0.15s;
}
.jd-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.jd-btn.ghost {
  background: transparent;
  border: 1px solid #2e3147;
  color: #cbd5e1;
}
.jd-btn.primary {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: #fff;
}
.jd-distribute {
  width: 100%;
  margin-top: 14px;
  padding: 12px;
  font-size: 1rem;
}
.jd-state {
  color: #94a3b8;
  text-align: center;
  padding: 20px 0;
  font-size: 0.9rem;
}
.jd-muted {
  color: #94a3b8;
}
.small {
  font-size: 0.8rem;
}
.jd-hist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.jd-hist-row {
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  padding: 10px 12px;
}
.jd-hist-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.jd-hist-total {
  color: #fde68a;
  font-weight: 700;
}
.jd-hist-detail {
  color: #e2e8f0;
  font-size: 0.88rem;
  line-height: 1.5;
  margin-bottom: 4px;
}
</style>
