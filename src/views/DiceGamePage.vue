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

// 骰面 emoji(1~6)
const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

const loading = ref(true)
const rolling = ref(false)

const config = ref({ currency: '', enabled: false, betAmount: 10, maxPayout: 1000000 })
const betMultipliers = ref<number[]>([1, 2, 3, 5, 10])
const selectedMultiplier = ref(1)
const walletBalance = ref(0)
const jackpotBalance = ref(0)
const clientSeed = ref('')

const dice = ref<number[]>([1, 1, 1])
const banker = ref({ hasBanker: false, bankerName: '', bankroll: 0, isMe: false })

// 下注玩法
type BetType = 'BIG' | 'SMALL' | 'SUM' | 'SINGLE' | 'TRIPLE'
const betType = ref<BetType>('BIG')
const singlePick = ref(1) // 猜點數 1~6
const sumPick = ref(10) // 和(總點) 4~17
const sumOptions = Array.from({ length: 14 }, (_, i) => i + 4) // 4..17

interface PayRow {
  type: string
  label: string
  desc: string
  multiplier: number
  probability: number
}
const paytable = ref<PayRow[]>([])

const lastResult = ref<{
  win: boolean
  payout: number
  poolWin: number
  multiplier: number
  message: string
  betLabel: string
} | null>(null)
const fair = ref<{ serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number } | null>(null)
const showFair = ref(false)

// 豹子中彩金池尊榮動畫
const showJackpot = ref(false)
const jackpotWin = ref(0)
function triggerJackpot(total: number) {
  showJackpot.value = true
  jackpotWin.value = 0
  const dur = 1400
  const t0 = Date.now()
  const tick = () => {
    const p = Math.min(1, (Date.now() - t0) / dur)
    const eased = 0.5 - Math.cos(p * Math.PI) / 2
    jackpotWin.value = Math.floor(total * eased)
    if (p < 1) requestAnimationFrame(tick)
    else jackpotWin.value = total
  }
  requestAnimationFrame(tick)
}

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
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

const effectiveBet = computed(() => Number(config.value.betAmount || 0) * selectedMultiplier.value)

const pick = computed(() =>
  betType.value === 'SINGLE' ? singlePick.value : betType.value === 'SUM' ? sumPick.value : 0,
)

const eligible = computed(
  () =>
    config.value.enabled &&
    banker.value.hasBanker &&
    !banker.value.isMe &&
    walletBalance.value >= effectiveBet.value &&
    effectiveBet.value <= banker.value.bankroll,
)
const canRoll = computed(() => !rolling.value && eligible.value)

function ineligibleReason(): string {
  if (!config.value.enabled) return '骰寶目前未開放'
  if (!banker.value.hasBanker) return '目前沒有莊家，先坐莊或等人坐莊'
  if (banker.value.isMe) return '你是莊家，不能玩自己的莊'
  if (effectiveBet.value > banker.value.bankroll)
    return `下注額不可超過莊家本金 ${fmt(banker.value.bankroll)}，請降低倍率`
  if (walletBalance.value < effectiveBet.value) return '餘額不足'
  return ''
}

const betTypeLabel = (t: BetType): string =>
  ({ BIG: '大', SMALL: '小', SUM: '和(猜總點)', SINGLE: '猜點數', TRIPLE: '豹子' }[t])

// 顯示用:目前選的玩法說明
const currentDesc = computed(() => {
  switch (betType.value) {
    case 'BIG':
      return '總點 11–17 贏（出豹子則輸）· 賠 1:1'
    case 'SMALL':
      return '總點 4–10 贏（出豹子則輸）· 賠 1:1'
    case 'SUM':
      return `押總點 = ${sumPick.value}，` + sumPayHint(sumPick.value)
    case 'SINGLE':
      return `押點數 ${singlePick.value}：中 1 顆 1:1、2 顆 2:1、3 顆 12:1`
    case 'TRIPLE':
      return '任意三顆相同 → 獨得整個彩金池（莊家退回本金）'
  }
  return ''
})
function sumPayHint(t: number): string {
  const row = paytable.value.find((r) => r.type === 'SUM' + t)
  if (!row) return ''
  return '賠 ' + (row.multiplier - 1) + ':1'
}

// ---- API ----
async function loadConfig() {
  const res = await fetch(`${API}/dice/config`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  config.value = {
    currency: d.currency ?? '',
    enabled: !!d.enabled,
    betAmount: Number(d.betAmount),
    maxPayout: Number(d.maxPayout),
  }
  if (Array.isArray(d.betMultipliers) && d.betMultipliers.length) {
    betMultipliers.value = d.betMultipliers
    if (!betMultipliers.value.includes(selectedMultiplier.value)) {
      selectedMultiplier.value = betMultipliers.value[0] ?? 1
    }
  }
  paytable.value = Array.isArray(d.paytable)
    ? d.paytable.map(
        (r: { type: string; label: string; desc: string; multiplier: number; probability: number }): PayRow => ({
          type: r.type,
          label: r.label,
          desc: r.desc,
          multiplier: Number(r.multiplier),
          probability: Number(r.probability),
        }),
      )
    : []
}

async function loadWallet() {
  const res = await fetch(`${API}/getBalance`, { headers: headers() })
  if (!res.ok) return
  const data: { memberBalanceResponseList?: Balance[] } = await res.json()
  const list = data.memberBalanceResponseList ?? []
  balanceStore.setBalanceList(list)
  const w = list.find((b) => b.currency === config.value.currency)
  walletBalance.value = w ? Number(w.balance) : 0
}

async function loadJackpot() {
  const res = await fetch(`${API}/slot/jackpot-pools`, { headers: headers() })
  if (!res.ok) return
  const list: { currencyCode: string; balance: number }[] = await res.json()
  const pool = list.find((p) => p.currencyCode === config.value.currency)
  jackpotBalance.value = pool ? Number(pool.balance) : 0
}

async function loadBank() {
  const res = await fetch(`${API}/slot/bank`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  banker.value = {
    hasBanker: !!d.hasBanker,
    bankerName: d.bankerName ?? '',
    bankroll: Number(d.bankroll ?? 0),
    isMe: !!d.isMe,
  }
}

async function loadAll() {
  loading.value = true
  try {
    await loadConfig()
    await Promise.all([loadWallet(), loadJackpot(), loadBank()])
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 坐莊 / 搶莊 / 下莊 — 與拉霸共用同一座莊家
async function takeBank() {
  const challenge = banker.value.hasBanker
  const hint = challenge
    ? `本金必須大於現任莊家 ${fmt(banker.value.bankroll)}`
    : '輸入你要投入的本金（= 最多可輸的金額）'
  const input = await useAlert.inputDialog(hint, challenge ? '搶莊' : '我要坐莊')
  const amount = Number(input)
  if (!amount || amount <= 0) return
  if (challenge && amount <= banker.value.bankroll) {
    useAlert.error(`搶莊本金必須大於現任莊家 ${fmt(banker.value.bankroll)}`)
    return
  }
  try {
    const res = await fetch(`${API}/slot/bank/take`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ amount }),
    })
    const d = await res.json()
    if (!res.ok) return useAlert.error(d.message ?? '坐莊失敗')
    useAlert.success(d.message)
    await Promise.all([loadBank(), loadWallet()])
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

async function leaveBank() {
  const ok = await useAlert.confirm('確定要下莊？剩餘本金會退回你的錢包')
  if (!ok?.isConfirmed) return
  try {
    const res = await fetch(`${API}/slot/bank/leave`, { method: 'POST', headers: headers() })
    const d = await res.json()
    if (!res.ok) return useAlert.error(d.message ?? '下莊失敗')
    useAlert.success(d.message)
    await Promise.all([loadBank(), loadWallet()])
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

// ---- 擲骰 ----
let animTimer: number | undefined
function startAnim() {
  animTimer = window.setInterval(() => {
    dice.value = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 6))
  }, 80)
}
function stopAnim() {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = undefined
  }
}

async function roll() {
  if (!canRoll.value) {
    const r = ineligibleReason()
    if (r) useAlert.error(r)
    return
  }
  rolling.value = true
  lastResult.value = null
  startAnim()
  try {
    const res = await fetch(`${API}/dice/roll`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        betType: betType.value,
        pick: pick.value,
        betMultiplier: selectedMultiplier.value,
        clientSeed: clientSeed.value || undefined,
      }),
    })
    const d = await res.json()
    if (!res.ok) {
      stopAnim()
      rolling.value = false
      useAlert.error(d.message ?? '擲骰失敗')
      return
    }
    // 轉一下再停,讓骰子有滾動感
    await delay(700)
    stopAnim()
    dice.value = Array.isArray(d.dice) ? d.dice.map((x: number) => Number(x)) : [1, 1, 1]

    walletBalance.value = Number(d.balanceAfter)
    jackpotBalance.value = Number(d.poolBalance)
    lastResult.value = {
      win: !!d.win,
      payout: Number(d.payout),
      poolWin: Number(d.poolWin || 0),
      multiplier: Number(d.multiplier),
      message: d.message ?? '',
      betLabel: betTypeLabel(betType.value),
    }
    fair.value = {
      serverSeed: d.serverSeed,
      serverSeedHash: d.serverSeedHash,
      clientSeed: d.clientSeed,
      nonce: Number(d.nonce),
    }
    if (d.jackpot && Number(d.poolWin || 0) > 0) {
      triggerJackpot(Number(d.poolWin))
    }
    await loadBank()
  } catch (e) {
    console.error(e)
    stopAnim()
    useAlert.error('連線失敗')
  } finally {
    rolling.value = false
  }
}

const total = computed(() => dice.value.reduce((s, d) => s + d, 0))

onMounted(loadAll)
</script>

<template>
  <div class="dice-page">
    <div v-if="loading" class="loading">載入中…</div>

    <template v-else>
      <!-- 標頭 + 彩金池 -->
      <div class="topbar">
        <h2 class="title">🎲 骰寶 <span class="sub">猜點數</span></h2>
        <div class="pool">
          <span class="pool-label">💰 彩金池</span>
          <span class="pool-amt">{{ fmt(jackpotBalance) }} {{ config.currency }}</span>
        </div>
      </div>
      <p class="pool-hint">擲出<b>豹子（三顆相同）</b>即獨得整個彩金池！與拉霸共用同一池與莊家。</p>

      <!-- 莊家列 -->
      <div class="banker-bar">
        <template v-if="banker.hasBanker">
          <span class="banker-info">
            🏦 莊家 <b>{{ banker.bankerName }}</b> · 本金 {{ fmt(banker.bankroll) }} {{ config.currency }}
          </span>
          <button v-if="banker.isMe" class="btn btn-leave" @click="leaveBank">下莊</button>
          <button v-else class="btn btn-take" @click="takeBank">搶莊</button>
        </template>
        <template v-else>
          <span class="banker-info muted">目前沒有莊家</span>
          <button class="btn btn-take" @click="takeBank">我要坐莊</button>
        </template>
      </div>

      <!-- 骰盅 -->
      <div class="dice-arena" :class="{ rolling }">
        <div v-for="(d, i) in dice" :key="i" class="die" :class="{ spin: rolling }">{{ FACES[d] }}</div>
      </div>
      <div class="total-row">
        <span class="total-tag">總點 {{ total }}</span>
        <span v-if="dice[0] === dice[1] && dice[1] === dice[2]" class="triple-tag">豹子！</span>
        <span v-else-if="total >= 11 && total <= 17" class="bs-tag big">大</span>
        <span v-else class="bs-tag small">小</span>
      </div>

      <!-- 結果 -->
      <transition name="pop">
        <div v-if="lastResult" class="result" :class="{ win: lastResult.win }">
          <b>{{ lastResult.message }}</b>
          <span v-if="lastResult.poolWin > 0"> 🏆 彩金池 +{{ fmt(lastResult.poolWin) }}</span>
          <span v-else-if="lastResult.payout > 0"> 派彩 {{ fmt(lastResult.payout) }} {{ config.currency }}</span>
        </div>
      </transition>

      <!-- 下注玩法 -->
      <div class="bet-types">
        <button
          v-for="t in (['BIG', 'SMALL', 'SUM', 'SINGLE', 'TRIPLE'] as BetType[])"
          :key="t"
          class="bet-btn"
          :class="{ active: betType === t, [t.toLowerCase()]: true }"
          @click="betType = t"
        >
          {{ betTypeLabel(t) }}
        </button>
      </div>

      <!-- 子選項:猜點數 1-6 -->
      <div v-if="betType === 'SINGLE'" class="pick-row">
        <span class="pick-label">點數</span>
        <button
          v-for="n in 6"
          :key="n"
          class="pick-btn"
          :class="{ active: singlePick === n }"
          @click="singlePick = n"
        >
          {{ FACES[n] }}
        </button>
      </div>
      <!-- 子選項:和(總點) 4-17 -->
      <div v-if="betType === 'SUM'" class="pick-row wrap">
        <span class="pick-label">總點</span>
        <button
          v-for="n in sumOptions"
          :key="n"
          class="pick-btn sum"
          :class="{ active: sumPick === n }"
          @click="sumPick = n"
        >
          {{ n }}
        </button>
      </div>

      <p class="bet-desc">{{ currentDesc }}</p>

      <!-- 下注倍率 -->
      <div class="mult-row">
        <span class="pick-label">倍率</span>
        <button
          v-for="m in betMultipliers"
          :key="m"
          class="pick-btn"
          :class="{ active: selectedMultiplier === m }"
          @click="selectedMultiplier = m"
        >
          ×{{ m }}
        </button>
      </div>

      <div class="bet-summary">
        本注 <b>{{ fmt(effectiveBet) }}</b> {{ config.currency }} · 餘額 {{ fmt(walletBalance) }}
      </div>

      <button class="roll-btn" :disabled="!canRoll" @click="roll">
        {{ rolling ? '擲骰中…' : '🎲 擲骰！' }}
      </button>
      <p v-if="!eligible && !rolling" class="ineligible">{{ ineligibleReason() }}</p>

      <!-- 賠率表 -->
      <div class="paytable">
        <h3>賠率表</h3>
        <div class="pt-grid">
          <div v-for="r in paytable" :key="r.type" class="pt-row">
            <span class="pt-label">{{ r.label }}</span>
            <span class="pt-mult">{{ r.multiplier >= 999999 ? '🏆 彩金池' : '×' + r.multiplier }}</span>
            <span class="pt-odds">{{ r.probability > 0 ? '每 ' + Math.round(1 / r.probability) + ' 把' : '' }}</span>
          </div>
        </div>
      </div>

      <!-- provably-fair -->
      <div v-if="fair" class="fair">
        <button class="fair-toggle" @click="showFair = !showFair">
          🔒 公平性驗證 {{ showFair ? '▲' : '▼' }}
        </button>
        <div v-if="showFair" class="fair-body">
          <div>serverSeed: <code>{{ fair.serverSeed }}</code></div>
          <div>hash: <code>{{ fair.serverSeedHash }}</code></div>
          <div>clientSeed: <code>{{ fair.clientSeed }}</code> · nonce: {{ fair.nonce }}</div>
          <input v-model="clientSeed" class="seed-input" placeholder="自訂 clientSeed (可選)" />
        </div>
      </div>
    </template>

    <!-- 豹子中彩金池尊榮動畫 -->
    <transition name="fade">
      <div v-if="showJackpot" class="jackpot-overlay" @click="showJackpot = false">
        <div class="jackpot-card">
          <div class="jackpot-dice">🎲🎲🎲</div>
          <div class="jackpot-title">豹子！獨得彩金池</div>
          <div class="jackpot-amt">{{ fmt(jackpotWin) }} {{ config.currency }}</div>
          <button class="btn btn-take" @click.stop="showJackpot = false">太爽啦！</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dice-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  color: #e2e8f0;
}
.loading {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.title {
  margin: 0;
  font-size: 1.4rem;
  color: var(--c-light);
}
.title .sub {
  font-size: 0.9rem;
  color: #94a3b8;
}
.pool {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
}
.pool-label {
  font-size: 0.72rem;
  color: #94a3b8;
}
.pool-amt {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fbbf24;
  font-variant-numeric: tabular-nums;
}
.pool-hint {
  margin: 6px 0 14px;
  font-size: 0.8rem;
  color: #94a3b8;
}
.banker-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 16px;
  font-size: 0.85rem;
}
.banker-info.muted {
  color: #94a3b8;
}
.dice-arena {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 18px 0;
}
.die {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.6rem;
  line-height: 1;
  color: #f8fafc;
  background: #0f172a;
  border: 2px solid #334155;
  border-radius: 16px;
  box-shadow: inset 0 -4px 8px rgba(0, 0, 0, 0.4);
}
.die.spin {
  animation: die-shake 0.4s linear infinite;
  border-color: var(--c-light);
  color: var(--c-light);
}
@keyframes die-shake {
  0% { transform: translateY(0) rotate(0); }
  25% { transform: translateY(-6px) rotate(-12deg); }
  50% { transform: translateY(0) rotate(10deg); }
  75% { transform: translateY(-4px) rotate(-6deg); }
  100% { transform: translateY(0) rotate(0); }
}
.total-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
}
.total-tag {
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-weight: 700;
}
.bs-tag,
.triple-tag {
  padding: 3px 12px;
  border-radius: 999px;
  font-weight: 800;
}
.bs-tag.big {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}
.bs-tag.small {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
}
.triple-tag {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: #1a1305;
}
.result {
  text-align: center;
  padding: 10px;
  border-radius: 10px;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 0.95rem;
}
.result.win {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
}
.bet-types {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.bet-btn {
  padding: 12px 4px;
  border-radius: 10px;
  border: 1px solid #2e3147;
  background: #0f111a;
  color: #cbd5e1;
  font-weight: 800;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.15s;
}
.bet-btn.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}
.bet-btn.triple.active {
  border-color: #fbbf24;
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
}
.pick-row,
.mult-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.pick-row.wrap {
  flex-wrap: wrap;
}
.pick-label {
  font-size: 0.8rem;
  color: #94a3b8;
  flex-shrink: 0;
  width: 36px;
}
.pick-btn {
  min-width: 38px;
  height: 38px;
  padding: 0 8px;
  border-radius: 9px;
  border: 1px solid #2e3147;
  background: #0f111a;
  color: #cbd5e1;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.pick-btn.sum {
  min-width: 34px;
  height: 34px;
}
.pick-btn.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}
.bet-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  margin: 4px 0 12px;
  min-height: 1.2em;
}
.bet-summary {
  text-align: center;
  font-size: 0.9rem;
  margin-bottom: 10px;
  color: #cbd5e1;
}
.roll-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
  font-size: 1.1rem;
  font-weight: 900;
  cursor: pointer;
  transition: filter 0.2s;
}
.roll-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.roll-btn:not(:disabled):hover {
  filter: brightness(1.08);
}
.ineligible {
  text-align: center;
  color: #f59e0b;
  font-size: 0.8rem;
  margin-top: 8px;
}
.btn {
  padding: 6px 14px;
  border-radius: 9px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-take {
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
}
.btn-leave {
  background: #334155;
  color: #f1f5f9;
}
.paytable {
  margin-top: 22px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.paytable h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: var(--c-light);
}
.pt-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pt-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  align-items: center;
  font-size: 0.82rem;
  padding: 3px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
}
.pt-label {
  color: #e2e8f0;
  font-weight: 700;
}
.pt-mult {
  color: #fbbf24;
  font-weight: 700;
}
.pt-odds {
  color: #64748b;
  font-size: 0.75rem;
}
.fair {
  margin-top: 14px;
}
.fair-toggle {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.8rem;
}
.fair-body {
  font-size: 0.72rem;
  color: #94a3b8;
  word-break: break-all;
  line-height: 1.6;
}
.fair-body code {
  color: #cbd5e1;
}
.seed-input {
  width: 100%;
  margin-top: 6px;
  padding: 6px 8px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #fff;
  box-sizing: border-box;
}
.jackpot-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.jackpot-card {
  text-align: center;
  padding: 32px 28px;
  border-radius: 20px;
  background: linear-gradient(160deg, #1e1e2e, #0f0f1a);
  border: 2px solid #fbbf24;
  box-shadow: 0 0 40px rgba(245, 158, 11, 0.5);
}
.jackpot-dice {
  font-size: 3rem;
}
.jackpot-title {
  font-size: 1.4rem;
  font-weight: 900;
  color: #fbbf24;
  margin: 8px 0;
}
.jackpot-amt {
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
  margin-bottom: 16px;
  font-variant-numeric: tabular-nums;
}
.pop-enter-active {
  transition: all 0.3s ease;
}
.pop-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (max-width: 480px) {
  .die {
    width: 58px;
    height: 58px;
    font-size: 2.8rem;
  }
  .bet-btn {
    font-size: 0.8rem;
    padding: 10px 2px;
  }
}
</style>
