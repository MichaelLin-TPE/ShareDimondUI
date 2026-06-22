<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()

const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
type BetType = 'BIG' | 'SMALL' | 'SUM' | 'SINGLE' | 'TRIPLE'

const loading = ref(true)
const config = ref({ currency: '', enabled: false, betAmount: 10, maxPayout: 1000000 })
const betMultipliers = ref<number[]>([1, 2, 3, 5, 10])
const selectedMultiplier = ref(1)

interface BetView {
  memberId: number
  userName: string
  betType: string
  pick: number
  amount: number
  payout: number
  poolWin: number
  win: boolean
  settled: boolean
  mine: boolean
}
interface RoundState {
  status: string
  roundId: number | null
  deadlineEpochMs: number
  dice: number[] | null
  bets: BetView[]
  online: string[]
  poolBalance: number
  poolWin: number
  bankerName: string | null
  bankroll: number | null
  diceEnabled: boolean
  currency: string
  myBalance: number | null
  serverSeed?: string
  serverSeedHash?: string
  clientSeed?: string
  nonce?: number
}
const state = ref<RoundState | null>(null)

interface PayRow {
  type: string
  label: string
  desc: string
  multiplier: number
  probability: number
}
const paytable = ref<PayRow[]>([])

// 下注選擇
const betType = ref<BetType>('BIG')
const singlePick = ref(1)
const sumPick = ref(10)
const sumOptions = Array.from({ length: 14 }, (_, i) => i + 4)
const placing = ref(false)

// 倒數
const nowMs = ref(Date.now())
let tickTimer: number | undefined

// 骰子動畫
const displayDice = ref<number[]>([1, 1, 1])
const rolling = ref(false)
let lastSettledRoundId = -1
let animTimer: number | undefined

// 音效(Web Audio 合成,免音檔) + 震動
const soundOn = ref(localStorage.getItem('dice_sound') !== 'off')
function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('dice_sound', soundOn.value ? 'on' : 'off')
  if (soundOn.value) ensureAudio()
}
let audioCtx: AudioContext | null = null
function ensureAudio(): AudioContext | null {
  if (!soundOn.value) return null
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}
function noiseBurst(ctx: AudioContext, t: number, dur: number, freq: number, gainVal: number) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 1.3
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gainVal, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(ctx.destination)
  src.start(t)
  src.stop(t + dur)
}
function tone(ctx: AudioContext, t: number, freq: number, dur: number, gainVal: number, type: OscillatorType) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gainVal, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(t)
  o.stop(t + dur)
}
function playShake() {
  const ctx = ensureAudio()
  if (!ctx) return
  let t = ctx.currentTime
  for (let i = 0; i < 11; i++) {
    noiseBurst(ctx, t, 0.05, 1100 + Math.random() * 900, 0.22)
    t += 0.17 - i * 0.007 // 稍微加速,像搖盅
  }
}
function playWin() {
  const ctx = ensureAudio()
  if (!ctx) return
  const t = ctx.currentTime
  ;[523, 659, 784].forEach((f, i) => tone(ctx, t + i * 0.1, f, 0.26, 0.16, 'triangle'))
}
function playJackpot() {
  const ctx = ensureAudio()
  if (!ctx) return
  const t = ctx.currentTime
  ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
    tone(ctx, t + i * 0.12, f, 0.32, 0.18, 'sawtooth'),
  )
}
function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* 不支援就算了 */
  }
}

// 中獎尊榮動畫
const celebration = ref<{ show: boolean; tier: 'jackpot' | 'win'; amount: number; title: string } | null>(
  null,
)
let celeTimer: number | undefined
function closeCelebration() {
  if (celebration.value) celebration.value.show = false
}
function showMyResult() {
  const myBets = (state.value?.bets ?? []).filter((b) => b.mine && b.settled)
  if (!myBets.length) return
  const poolWin = myBets.reduce((s, b) => s + Number(b.poolWin || 0), 0)
  const ret = myBets.reduce((s, b) => s + Number(b.payout || 0) + Number(b.poolWin || 0), 0)
  const stake = myBets.reduce((s, b) => s + Number(b.amount || 0), 0)
  const net = ret - stake
  if (poolWin > 0) {
    celebration.value = { show: true, tier: 'jackpot', amount: ret, title: '豹子！獨得彩金池' }
    playJackpot()
    vibrate([0, 80, 40, 80, 40, 120, 60, 220])
  } else if (net > 0) {
    celebration.value = { show: true, tier: 'win', amount: net, title: '恭喜中獎' }
    playWin()
    vibrate([0, 60, 40, 110])
  } else {
    return
  }
  if (celeTimer) clearTimeout(celeTimer)
  celeTimer = window.setTimeout(closeCelebration, 4500)
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
const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const effectiveBet = computed(() => Number(config.value.betAmount || 0) * selectedMultiplier.value)
const pick = computed(() =>
  betType.value === 'SINGLE' ? singlePick.value : betType.value === 'SUM' ? sumPick.value : 0,
)
const betTypeLabel = (t: string): string =>
  ({ BIG: '大', SMALL: '小', SUM: '和', SINGLE: '點數', TRIPLE: '豹子' })[t] ?? t

const countdown = computed(() => {
  const s = state.value
  if (!s || s.status !== 'BETTING') return 0
  return Math.max(0, Math.ceil((s.deadlineEpochMs - nowMs.value) / 1000))
})
const closing = computed(() => state.value?.status === 'BETTING' && countdown.value <= 0)
const bankerIsMe = computed(
  () => !!state.value?.bankerName && state.value?.bankerName === authStore.member?.userName,
)
const hasBanker = computed(() => !!state.value?.bankerName)

const phaseText = computed(() => {
  const s = state.value
  if (!s) return ''
  if (!s.diceEnabled) return '骰寶目前未開放'
  if (rolling.value) return '開骰中…'
  if (s.status === 'BETTING') return closing.value ? '封盤，開骰中…' : `下注中 ${countdown.value}s`
  if (s.status === 'SETTLED') return '本局結束 · 有人下注就開新局'
  return '等待開局 · 下注即開始'
})

const canBet = computed(
  () =>
    !!state.value?.diceEnabled &&
    hasBanker.value &&
    !bankerIsMe.value &&
    !closing.value &&
    !placing.value &&
    Number(state.value?.myBalance || 0) >= effectiveBet.value,
)
function cantBetReason(): string {
  const s = state.value
  if (!s?.diceEnabled) return '骰寶目前未開放'
  if (!hasBanker.value) return '目前沒有莊家，先坐莊或等人坐莊'
  if (bankerIsMe.value) return '你是莊家，不能玩自己的莊'
  if (closing.value) return '本局已封盤，等待開骰'
  if (Number(s?.myBalance || 0) < effectiveBet.value) return '餘額不足'
  return ''
}

const myBetsTotal = computed(() =>
  (state.value?.bets ?? []).filter((b) => b.mine).reduce((sum, b) => sum + Number(b.amount), 0),
)

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

let fetching = false
async function fetchRound() {
  if (fetching) return
  fetching = true
  try {
    const res = await fetch(`${API}/dice/round`, { headers: headers() })
    if (!res.ok) return
    const d: RoundState = await res.json()
    state.value = d
    // 新的一局結算 → 播開骰動畫
    if (d.status === 'SETTLED' && d.dice && d.roundId && d.roundId !== lastSettledRoundId) {
      lastSettledRoundId = d.roundId
      void animateRoll(d.dice)
    } else if (d.status !== 'SETTLED' && d.dice == null && !rolling.value) {
      // 下注中,骰子待命
    }
  } catch (e) {
    console.error(e)
  } finally {
    fetching = false
  }
}

async function animateRoll(finalDice: number[]) {
  rolling.value = true
  // 搖盅:音效 + 震動 + 視覺
  playShake()
  vibrate([0, 40, 30, 40, 30, 40, 30, 50, 40, 60, 50, 80])
  if (animTimer) clearInterval(animTimer)
  animTimer = window.setInterval(() => {
    displayDice.value = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 6))
  }, 80)
  await delay(1500)
  if (animTimer) clearInterval(animTimer)
  displayDice.value = finalDice.slice()
  rolling.value = false
  // 開盅後短暫停頓再揭曉中獎動畫
  await delay(250)
  showMyResult()
}

async function placeBet() {
  if (!canBet.value) {
    const r = cantBetReason()
    if (r) useAlert.error(r)
    return
  }
  ensureAudio() // 用使用者點擊手勢解鎖音訊,稍後開骰才出得了聲
  placing.value = true
  try {
    const res = await fetch(`${API}/dice/bet`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        betType: betType.value,
        pick: pick.value,
        betMultiplier: selectedMultiplier.value,
      }),
    })
    const d = await res.json()
    if (!res.ok) {
      useAlert.error(d.message ?? '下注失敗')
      return
    }
    await fetchRound()
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  } finally {
    placing.value = false
  }
}

// 莊家(共用拉霸)
async function takeBank() {
  const challenge = hasBanker.value
  const hint = challenge
    ? `本金必須大於現任莊家 ${fmt(state.value?.bankroll)}`
    : '輸入你要投入的本金（= 最多可輸的金額）'
  const input = await useAlert.inputDialog(hint, challenge ? '搶莊' : '我要坐莊')
  const amount = Number(input)
  if (!amount || amount <= 0) return
  try {
    const res = await fetch(`${API}/slot/bank/take`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ amount }),
    })
    const d = await res.json()
    if (!res.ok) return useAlert.error(d.message ?? '坐莊失敗')
    useAlert.success(d.message)
    await fetchRound()
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
    await fetchRound()
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

// WS + 心跳
let ws: StompHandle | null = null
let heartbeat: number | undefined
onMounted(async () => {
  loading.value = true
  await loadConfig()
  await fetchRound()
  loading.value = false

  const clanId = authStore.member?.clanId
  if (clanId) {
    ws = createReconnectingStomp(`/topic/dice/${clanId}`, (body) => {
      if (body === 'DICE_UPDATED') fetchRound()
    })
  }
  // 倒數 ticker
  tickTimer = window.setInterval(() => (nowMs.value = Date.now()), 250)
  // 心跳(維持在線 + 兜底刷新,即使 WS 斷線)
  heartbeat = window.setInterval(fetchRound, 8000)
})
onUnmounted(() => {
  if (ws) ws.disconnect()
  if (tickTimer) clearInterval(tickTimer)
  if (heartbeat) clearInterval(heartbeat)
  if (animTimer) clearInterval(animTimer)
  if (celeTimer) clearTimeout(celeTimer)
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  // 通知離開遊戲室
  fetch(`${API}/dice/leave`, { method: 'POST', headers: headers() }).catch(() => {})
})

const total = computed(() => displayDice.value.reduce((s, d) => s + d, 0))
const isTriple = computed(() => displayDice.value[0] === displayDice.value[1] && displayDice.value[1] === displayDice.value[2])
</script>

<template>
  <div class="dice-page">
    <div v-if="loading" class="loading">載入中…</div>

    <template v-else-if="state">
      <!-- 標頭 + 彩金池 -->
      <div class="topbar">
        <h2 class="title">
          🎲 骰寶賭桌
          <button class="mute-btn" :title="soundOn ? '靜音' : '開聲音'" @click="toggleSound">
            {{ soundOn ? '🔊' : '🔇' }}
          </button>
        </h2>
        <div class="pool">
          <span class="pool-label">💰 彩金池</span>
          <span class="pool-amt">{{ fmt(state.poolBalance) }} {{ state.currency }}</span>
        </div>
      </div>

      <!-- 在線名單 -->
      <div class="room">
        <span class="room-label">🟢 遊戲室（{{ state.online.length }}）</span>
        <span v-for="n in state.online" :key="n" class="room-chip" :class="{ me: n === authStore.member?.userName }">
          {{ n === authStore.member?.userName ? '你' : n }}
        </span>
        <span v-if="!state.online.length" class="room-empty">目前只有你</span>
      </div>

      <!-- 莊家列 -->
      <div class="banker-bar">
        <template v-if="hasBanker">
          <span class="banker-info">🏦 莊家 <b>{{ state.bankerName }}</b> · 本金 {{ fmt(state.bankroll) }} {{ state.currency }}</span>
          <button v-if="bankerIsMe" class="btn btn-leave" @click="leaveBank">下莊</button>
          <button v-else class="btn btn-take" @click="takeBank">搶莊</button>
        </template>
        <template v-else>
          <span class="banker-info muted">目前沒有莊家</span>
          <button class="btn btn-take" @click="takeBank">我要坐莊</button>
        </template>
      </div>

      <!-- 階段 + 倒數 -->
      <div class="phase" :class="{ betting: state.status === 'BETTING' && !closing, rolling }">
        <span class="phase-text">{{ phaseText }}</span>
        <div v-if="state.status === 'BETTING' && !closing" class="cd-bar">
          <div class="cd-fill" :style="{ width: (countdown / 30) * 100 + '%' }"></div>
        </div>
      </div>

      <!-- 骰盅 -->
      <div class="dice-arena" :class="{ shaking: rolling }">
        <div v-for="(d, i) in displayDice" :key="i" class="die" :class="{ spin: rolling }">{{ FACES[d] }}</div>
      </div>
      <div v-if="state.status === 'SETTLED' && !rolling" class="total-row">
        <span class="total-tag">總點 {{ total }}</span>
        <span v-if="isTriple" class="triple-tag">豹子！</span>
        <span v-else-if="total >= 11 && total <= 17" class="bs-tag big">大</span>
        <span v-else class="bs-tag small">小</span>
        <span v-if="state.poolWin > 0" class="pool-win-tag">🏆 彩金池 {{ fmt(state.poolWin) }}</span>
      </div>

      <!-- 本局下注 -->
      <div class="bets-board">
        <div class="bets-head">
          本局下注（{{ state.bets.length }}）<span v-if="myBetsTotal > 0" class="my-total">· 我押 {{ fmt(myBetsTotal) }}</span>
        </div>
        <div v-if="!state.bets.length" class="bets-empty">還沒有人下注，下第一注即開局！</div>
        <div v-else class="bets-list">
          <div v-for="(b, i) in state.bets" :key="i" class="bet-chip" :class="{ mine: b.mine, won: b.settled && b.win, lost: b.settled && !b.win }">
            <span class="bet-who">{{ b.mine ? '你' : b.userName }}</span>
            <span class="bet-what">{{ betTypeLabel(b.betType) }}{{ b.betType === 'SUM' || b.betType === 'SINGLE' ? b.pick : '' }}</span>
            <span class="bet-amt">{{ fmt(b.amount) }}</span>
            <span v-if="b.settled" class="bet-res">
              {{ b.poolWin > 0 ? '🏆+' + fmt(b.poolWin) : b.win ? '+' + fmt(b.payout) : '✕' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 下注玩法 -->
      <div class="bet-types">
        <button
          v-for="t in (['BIG', 'SMALL', 'SUM', 'SINGLE', 'TRIPLE'] as BetType[])"
          :key="t"
          class="bet-btn"
          :class="{ active: betType === t, triple: t === 'TRIPLE' }"
          @click="betType = t"
        >
          {{ betTypeLabel(t) === '點數' ? '猜點數' : t === 'SUM' ? '和' : betTypeLabel(t) }}
        </button>
      </div>

      <div v-if="betType === 'SINGLE'" class="pick-row">
        <span class="pick-label">點數</span>
        <button v-for="n in 6" :key="n" class="pick-btn" :class="{ active: singlePick === n }" @click="singlePick = n">{{ FACES[n] }}</button>
      </div>
      <div v-if="betType === 'SUM'" class="pick-row wrap">
        <span class="pick-label">總點</span>
        <button v-for="n in sumOptions" :key="n" class="pick-btn sum" :class="{ active: sumPick === n }" @click="sumPick = n">{{ n }}</button>
      </div>

      <div class="mult-row">
        <span class="pick-label">倍率</span>
        <button v-for="m in betMultipliers" :key="m" class="pick-btn" :class="{ active: selectedMultiplier === m }" @click="selectedMultiplier = m">×{{ m }}</button>
      </div>

      <div class="bet-summary">本注 <b>{{ fmt(effectiveBet) }}</b> {{ state.currency }} · 餘額 {{ fmt(state.myBalance) }}</div>
      <button class="roll-btn" :disabled="!canBet" @click="placeBet">
        {{ placing ? '下注中…' : closing ? '封盤中…' : '🪙 下注' }}
      </button>
      <p v-if="!canBet && !placing" class="ineligible">{{ cantBetReason() }}</p>

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

      <!-- 公平性 -->
      <div v-if="state.serverSeed" class="fair">
        <div>🔒 上局公平性 · nonce {{ state.nonce }}</div>
        <div>serverSeed: <code>{{ state.serverSeed }}</code></div>
      </div>
    </template>

    <!-- 中獎尊榮動畫 -->
    <transition name="cele">
      <div
        v-if="celebration?.show"
        class="cele-overlay"
        :class="celebration.tier"
        @click="closeCelebration"
      >
        <div class="cele-rays"></div>
        <div class="cele-card">
          <div class="cele-emoji">{{ celebration.tier === 'jackpot' ? '🎲🎲🎲' : '🎉' }}</div>
          <div class="cele-title">{{ celebration.title }}</div>
          <div class="cele-amt">+{{ fmt(celebration.amount) }} {{ state?.currency }}</div>
          <button class="btn btn-take cele-btn" @click.stop="closeCelebration">收下！</button>
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
}
.title {
  margin: 0;
  font-size: 1.4rem;
  color: var(--c-light);
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
.room {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.room-label {
  font-size: 0.78rem;
  color: #4ade80;
  font-weight: 700;
}
.room-chip {
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.78rem;
}
.room-chip.me {
  background: rgba(var(--c-light-rgb), 0.18);
  border-color: var(--c-light);
  color: var(--c-light);
  font-weight: 700;
}
.room-empty {
  font-size: 0.78rem;
  color: #64748b;
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
  margin-bottom: 12px;
  font-size: 0.85rem;
}
.banker-info.muted {
  color: #94a3b8;
}
.phase {
  text-align: center;
  margin-bottom: 8px;
}
.phase-text {
  font-weight: 800;
  color: #94a3b8;
}
.phase.betting .phase-text {
  color: var(--c-light);
}
.phase.rolling .phase-text {
  color: #fbbf24;
}
.cd-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 6px;
}
.cd-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-light), var(--c-deep));
  transition: width 0.25s linear;
}
.dice-arena {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 14px 0;
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
  25% { transform: translateY(-7px) rotate(-14deg); }
  50% { transform: translateY(0) rotate(12deg); }
  75% { transform: translateY(-5px) rotate(-7deg); }
  100% { transform: translateY(0) rotate(0); }
}
.total-row {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.total-tag,
.bs-tag,
.triple-tag,
.pool-win-tag {
  padding: 3px 12px;
  border-radius: 999px;
  font-weight: 800;
}
.total-tag {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.bs-tag.big {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}
.bs-tag.small {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
}
.triple-tag,
.pool-win-tag {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: #1a1305;
}
.bets-board {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.bets-head {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 8px;
  font-weight: 700;
}
.my-total {
  color: var(--c-light);
}
.bets-empty {
  font-size: 0.82rem;
  color: #64748b;
  text-align: center;
  padding: 6px 0;
}
.bets-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bet-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.78rem;
}
.bet-chip.mine {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
}
.bet-chip.won {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.14);
}
.bet-chip.lost {
  opacity: 0.5;
}
.bet-who {
  font-weight: 700;
  color: #cbd5e1;
}
.bet-what {
  color: var(--c-light);
  font-weight: 700;
}
.bet-amt {
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}
.bet-res {
  font-weight: 800;
  color: #4ade80;
}
.bet-chip.lost .bet-res {
  color: #94a3b8;
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
  font-size: 0.9rem;
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
  width: 36px;
  flex-shrink: 0;
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
  margin-top: 20px;
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
  margin-top: 12px;
  font-size: 0.7rem;
  color: #64748b;
  word-break: break-all;
  line-height: 1.5;
}
.fair code {
  color: #94a3b8;
}
.mute-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
  vertical-align: middle;
  opacity: 0.7;
}
.mute-btn:hover {
  opacity: 1;
}

/* 搖盅:整個骰盅左右晃 */
.dice-arena.shaking {
  animation: cup-shake 0.28s ease-in-out infinite;
}
@keyframes cup-shake {
  0%, 100% { transform: translateX(0) rotate(0); }
  25% { transform: translateX(-7px) rotate(-1.5deg); }
  75% { transform: translateX(7px) rotate(1.5deg); }
}

/* === 中獎尊榮動畫 === */
.cele-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  overflow: hidden;
}
.cele-overlay.win {
  background: radial-gradient(circle at center, rgba(16, 64, 40, 0.92), rgba(5, 10, 16, 0.95));
}
.cele-overlay.jackpot {
  background: radial-gradient(circle at center, rgba(80, 55, 8, 0.94), rgba(8, 6, 2, 0.96));
}
.cele-rays {
  position: absolute;
  width: 200vmax;
  height: 200vmax;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.07) 0deg 6deg,
    transparent 6deg 12deg
  );
  animation: rays-spin 9s linear infinite;
}
.cele-overlay.jackpot .cele-rays {
  background: repeating-conic-gradient(
    from 0deg,
    rgba(251, 191, 36, 0.18) 0deg 6deg,
    transparent 6deg 12deg
  );
}
@keyframes rays-spin {
  to { transform: rotate(360deg); }
}
.cele-card {
  position: relative;
  text-align: center;
  padding: 30px 34px;
  border-radius: 22px;
  background: linear-gradient(160deg, #1e1e2e, #0f0f1a);
  animation: cele-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.cele-overlay.win .cele-card {
  border: 2px solid #4ade80;
  box-shadow: 0 0 40px rgba(34, 197, 94, 0.45);
}
.cele-overlay.jackpot .cele-card {
  border: 2px solid #fbbf24;
  box-shadow: 0 0 50px rgba(245, 158, 11, 0.6);
}
@keyframes cele-pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.cele-emoji {
  font-size: 3.2rem;
  animation: cele-bounce 0.9s ease-in-out infinite;
}
@keyframes cele-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.08); }
}
.cele-title {
  font-size: 1.5rem;
  font-weight: 900;
  margin: 10px 0 4px;
}
.cele-overlay.win .cele-title {
  color: #4ade80;
}
.cele-overlay.jackpot .cele-title {
  color: #fbbf24;
  text-shadow: 0 0 16px rgba(245, 158, 11, 0.7);
}
.cele-amt {
  font-size: 2.2rem;
  font-weight: 900;
  color: #fff;
  font-variant-numeric: tabular-nums;
  margin-bottom: 18px;
}
.cele-btn {
  padding: 10px 28px;
  font-size: 1rem;
}
.cele-enter-active {
  transition: opacity 0.3s ease;
}
.cele-leave-active {
  transition: opacity 0.4s ease;
}
.cele-enter-from,
.cele-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dice-arena.shaking,
  .cele-rays,
  .cele-emoji,
  .die.spin {
    animation: none;
  }
}

@media (max-width: 480px) {
  .die {
    width: 58px;
    height: 58px;
    font-size: 2.8rem;
  }
  .bet-btn {
    font-size: 0.78rem;
    padding: 10px 2px;
  }
}
</style>
