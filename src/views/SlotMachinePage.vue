<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBalanceStore } from '@/stores/balanceTool'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import type { Balance } from '@/types/balance'

const API = 'https://api.gameshare-system.com'

const authStore = useAuthStore()
const balanceStore = useBalanceStore()

const isLeader = computed(() => authStore.member?.role === 'LEADER')

// ---- 狀態 ----
const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣']

const loading = ref(true)
const spinning = ref(false)

const config = ref({
  currency: '',
  enabled: true,
  betAmount: 10,
  jackpotShareOfEdge: 0.2,
  fundFloor: 0,
  maxPayout: 1000000,
  rtp: 0,
  houseEdge: 0,
})

const walletBalance = ref(0)
const jackpotBalance = ref(0)
const reels = ref<string[]>(['🍒', '🔔', '7️⃣'])
const clientSeed = ref('')

// 下注倍率
const betMultipliers = ref<number[]>([1, 2, 3, 5])
const selectedMultiplier = ref(1)
const effectiveBet = computed(() => Number(config.value.betAmount || 0) * selectedMultiplier.value)

const lastResult = ref<{ win: boolean; payout: number; multiplier: number; message: string } | null>(null)
const fair = ref<{ serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number } | null>(null)
const showFair = ref(false)

// ---- 工具 ----
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
// 一律不顯示小數點（虛擬幣為整數）
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

// 機率 → 「每 N 把」
function oddsText(p: number): string {
  if (!p || p <= 0) return ''
  return '每 ' + Math.round(1 / p).toLocaleString('en-US') + ' 把'
}

const canSpin = computed(
  () => !spinning.value && config.value.enabled && walletBalance.value >= effectiveBet.value,
)

interface PayRow {
  reels: string
  label: string
  mult: string
  odds: string
}

// 後端動態賠率表（含機率）；未載入前用靜態 fallback
const paytable = ref<PayRow[]>([])
const STATIC_PAYTABLE: PayRow[] = [
  { reels: '7️⃣ 7️⃣ 7️⃣', label: '頭獎', mult: '×170', odds: '' },
  { reels: '⭐ ⭐ ⭐', label: '', mult: '×48', odds: '' },
  { reels: '🔔 🔔 🔔', label: '', mult: '×17', odds: '' },
  { reels: '🍋 🍋 🍋', label: '', mult: '×10', odds: '' },
  { reels: '🍒 🍒 🍒', label: '', mult: '×5', odds: '' },
  { reels: '🍒 🍒 ·', label: '回本', mult: '×1', odds: '' },
]
const displayPaytable = computed<PayRow[]>(() =>
  paytable.value.length ? paytable.value : STATIC_PAYTABLE,
)

// ---- API ----
async function loadConfig() {
  const res = await fetch(`${API}/slot/config`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  config.value = {
    currency: d.currency ?? '',
    enabled: d.enabled,
    betAmount: Number(d.betAmount),
    jackpotShareOfEdge: Number(d.jackpotShareOfEdge),
    fundFloor: Number(d.fundFloor),
    maxPayout: Number(d.maxPayout),
    rtp: Number(d.rtp),
    houseEdge: Number(d.houseEdge),
  }
  if (Array.isArray(d.betMultipliers) && d.betMultipliers.length) {
    betMultipliers.value = d.betMultipliers
    if (!betMultipliers.value.includes(selectedMultiplier.value)) {
      selectedMultiplier.value = betMultipliers.value[0] ?? 1
    }
  }
  paytable.value = Array.isArray(d.paytable)
    ? d.paytable.map(
        (r: { reels: string; label?: string; multiplier: number; probability: number }): PayRow => ({
          reels: r.reels,
          label: r.label || '',
          mult: '×' + r.multiplier,
          odds: oddsText(r.probability),
        }),
      )
    : []
}

async function loadJackpot() {
  const res = await fetch(`${API}/slot/jackpot-pools`, { headers: headers() })
  if (!res.ok) return
  const list: { currencyCode: string; balance: number }[] = await res.json()
  const pool = list.find((p) => p.currencyCode === config.value.currency)
  jackpotBalance.value = pool ? Number(pool.balance) : 0
}

async function loadWallet() {
  const res = await fetch(`${API}/getBalance`, { headers: headers() })
  if (!res.ok) return
  // /getBalance 回傳 { memberBalanceResponseList, clanBalanceResponseList }
  const data: { memberBalanceResponseList?: Balance[]; clanBalanceResponseList?: Balance[] } =
    await res.json()
  const list = data.memberBalanceResponseList ?? []
  balanceStore.setBalanceList(list)
  const w = list.find((b) => b.currency === config.value.currency)
  walletBalance.value = w ? Number(w.balance) : 0
}

async function loadAll() {
  loading.value = true
  try {
    await loadConfig()
    await Promise.all([loadWallet(), loadJackpot()])
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

let animTimer: number | undefined
function startAnim() {
  animTimer = window.setInterval(() => {
    reels.value = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!)
  }, 70)
}
function stopAnim() {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = undefined
  }
}

async function spin() {
  if (!canSpin.value) {
    if (!config.value.enabled) useAlert.error('拉霸機目前未開放')
    else if (walletBalance.value < effectiveBet.value) useAlert.error('餘額不足')
    return
  }
  spinning.value = true
  lastResult.value = null
  startAnim()
  try {
    const [res] = await Promise.all([
      fetch(`${API}/slot/spin`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          clientSeed: clientSeed.value || undefined,
          betMultiplier: selectedMultiplier.value,
        }),
      }),
      delay(900),
    ])
    const d = await res.json()
    stopAnim()
    if (!res.ok) {
      useAlert.error(d.message ?? '拉霸失敗')
      return
    }
    reels.value = d.reels
    walletBalance.value = Number(d.balanceAfter)
    jackpotBalance.value = Number(d.jackpotBalance)
    lastResult.value = {
      win: d.win,
      payout: Number(d.payout),
      multiplier: Number(d.multiplier),
      message: d.message,
    }
    fair.value = {
      serverSeed: d.serverSeed,
      serverSeedHash: d.serverSeedHash,
      clientSeed: d.clientSeed,
      nonce: d.nonce,
    }
    // 同步 store 餘額
    const list = balanceStore.balanceList.map((b) =>
      b.currency === config.value.currency ? { ...b, balance: String(d.balanceAfter) } : b,
    )
    balanceStore.setBalanceList(list)
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗，請稍後再試')
  } finally {
    stopAnim()
    spinning.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="slot-container">
    <div class="title-wrap">
      <h2 class="title">🎰 拉霸機</h2>
      <p class="subtitle">用 {{ config.currency || '基準幣' }} 試手氣 · 贏的賠付來自公積金</p>
    </div>

    <!-- 上方資訊卡 -->
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">我的餘額</div>
        <div class="stat-value">{{ fmt(walletBalance) }}</div>
        <div class="stat-unit">{{ config.currency }}</div>
      </div>
      <div class="stat-card jackpot">
        <div class="stat-label">🏆 彩金池</div>
        <div class="stat-value">{{ fmt(jackpotBalance) }}</div>
        <div class="stat-unit">{{ config.currency }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本次下注</div>
        <div class="stat-value">{{ fmt(effectiveBet) }}</div>
        <div class="stat-unit">{{ config.currency }} · ×{{ selectedMultiplier }}</div>
      </div>
    </section>

    <!-- 機台 -->
    <section class="machine" :class="{ win: lastResult?.win }">
      <div class="reels">
        <div v-for="(s, i) in reels" :key="i" class="reel" :class="{ rolling: spinning }">
          {{ s }}
        </div>
      </div>

      <div class="result-line">
        <template v-if="loading">載入中…</template>
        <template v-else-if="spinning">轉動中…</template>
        <template v-else-if="lastResult">
          <span :class="lastResult.win ? 'res-win' : 'res-lose'">
            {{ lastResult.message }}
            <template v-if="lastResult.payout > 0">
              （×{{ lastResult.multiplier }}，+{{ fmt(lastResult.payout) }} {{ config.currency }}）
            </template>
          </span>
        </template>
        <template v-else>拉一把試試 👇</template>
      </div>

      <div class="mult-row">
        <span class="mult-label">倍率</span>
        <div class="mult-group">
          <button
            v-for="m in betMultipliers"
            :key="m"
            class="mult-btn"
            :class="{ active: selectedMultiplier === m }"
            :disabled="spinning"
            @click="selectedMultiplier = m"
          >
            {{ m }}x
          </button>
        </div>
      </div>

      <button class="spin-btn" :disabled="!canSpin || loading" @click="spin">
        <span v-if="spinning">🎲 轉動中…</span>
        <span v-else>SPIN（-{{ fmt(effectiveBet) }} {{ config.currency }}）</span>
      </button>

      <p v-if="!config.enabled && !loading" class="closed-hint">⚠️ 拉霸機目前未開放</p>
    </section>

    <!-- 賠率表 -->
    <section class="card">
      <div class="card-head">
        <h3 class="card-title">賠率表</h3>
        <span class="rtp-badge" v-if="config.rtp">
          返還率 {{ (config.rtp * 100).toFixed(1) }}%
        </span>
      </div>
      <div class="paytable">
        <div v-for="row in displayPaytable" :key="row.reels" class="pay-row">
          <span class="pay-reel">{{ row.reels }}</span>
          <span class="pay-odds">{{ row.odds }}</span>
          <span v-if="row.label" class="pay-label">{{ row.label }}</span>
          <span class="pay-mult">{{ row.mult }}</span>
        </div>
      </div>
    </section>

    <!-- 公平驗證 -->
    <section class="card" v-if="fair">
      <button class="collapse-head" @click="showFair = !showFair">
        <span>🔒 本局公平驗證 (provably fair)</span>
        <span>{{ showFair ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showFair" class="fair-body">
        <p class="fair-note">
          結果 = HMAC-SHA256(serverSeed, clientSeed:nonce)，可自行重算驗證未被竄改。
        </p>
        <div class="fair-row"><span>serverSeed</span><code>{{ fair.serverSeed }}</code></div>
        <div class="fair-row"><span>hash</span><code>{{ fair.serverSeedHash }}</code></div>
        <div class="fair-row"><span>clientSeed</span><code>{{ fair.clientSeed }}</code></div>
        <div class="fair-row"><span>nonce</span><code>{{ fair.nonce }}</code></div>
      </div>
    </section>

    <p v-if="isLeader" class="leader-link">⚙️ 下注額與輸贏分配請到「血盟設置 → 拉霸機設定」調整</p>
  </div>
</template>

<style scoped>
.slot-container {
  padding: 24px 18px 60px;
  max-width: 560px;
  margin: 0 auto;
}

.title-wrap {
  text-align: center;
  margin-bottom: 18px;
}
.title {
  margin: 0 0 4px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow: 0 0 6px rgba(var(--c-light-rgb), 0.45), 0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* 資訊卡 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 12px 10px;
  text-align: center;
}
.stat-card.jackpot {
  border-color: rgba(var(--c-light-rgb), 0.45);
  box-shadow: 0 0 14px rgba(var(--c-deep-rgb), 0.2);
}
.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #f1f5f9;
  line-height: 1.1;
}
.stat-unit {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 2px;
}

/* 機台 */
.machine {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 16px;
  padding: 22px 18px;
  margin-bottom: 18px;
  transition: box-shadow 0.3s;
}
.machine.win {
  box-shadow: 0 0 24px rgba(var(--c-light-rgb), 0.5);
  border-color: var(--c-light);
}
.reels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.reel {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  line-height: 1;
  background: #0e0f13;
  border: 1px solid #24263a;
  border-radius: 12px;
  user-select: none;
}
.reel.rolling {
  filter: blur(1px);
  opacity: 0.9;
}
.result-line {
  text-align: center;
  min-height: 24px;
  margin-bottom: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #cbd5e1;
}
.res-win {
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.5);
}
.res-lose {
  color: #94a3b8;
}
.mult-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.mult-label {
  font-size: 0.8rem;
  color: #94a3b8;
  flex: 0 0 auto;
}
.mult-group {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
}
.mult-btn {
  flex: 1 1 0;
  height: 38px;
  border: 1px solid #24263a;
  border-radius: 8px;
  background: #0e0f13;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
}
.mult-btn:hover:not(:disabled):not(.active) {
  color: #fff;
  border-color: rgba(var(--c-light-rgb), 0.4);
}
.mult-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-color: transparent;
}
.mult-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin-btn {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  color: var(--c-on);
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.4);
  transition: transform 0.1s, opacity 0.2s;
}
.spin-btn:active:not(:disabled) {
  transform: scale(0.98);
}
.spin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.closed-hint {
  text-align: center;
  color: #f59e0b;
  font-size: 0.85rem;
  margin: 12px 0 0;
}

/* 通用卡片 */
.card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f1f5f9;
}
.rtp-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
  border-radius: 999px;
  padding: 3px 10px;
}

/* 賠率表 */
.paytable {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pay-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}
.pay-reel {
  font-size: 1rem;
  letter-spacing: 2px;
  flex: 0 0 auto;
}
.pay-odds {
  flex: 1 1 auto;
  font-size: 0.72rem;
  color: #94a3b8;
}
.pay-label {
  flex: 0 0 auto;
  font-size: 0.68rem;
  color: var(--c-on);
  background: var(--c-light);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 700;
}
.pay-mult {
  flex: 0 0 auto;
  min-width: 48px;
  text-align: right;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--c-light);
}

/* 收合 */
.collapse-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.fair-body {
  margin-top: 12px;
}
.fair-note {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 10px;
  line-height: 1.5;
}
.fair-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.fair-row span {
  font-size: 0.72rem;
  color: #94a3b8;
}
.fair-row code {
  font-size: 0.72rem;
  color: #cbd5e1;
  word-break: break-all;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 6px;
  border-radius: 6px;
}

/* 盟主設定提示 */
.leader-link {
  text-align: center;
  font-size: 0.8rem;
  color: #64748b;
  margin: 4px 0 0;
}
</style>
