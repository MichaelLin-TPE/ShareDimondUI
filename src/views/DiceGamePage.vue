<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
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
  remainingMs: number
  dice: number[] | null
  bets: BetView[]
  online: string[]
  poolBalance: number
  poolWin: number
  bankerName: string | null
  bankroll: number | null
  remainingCapacity: number | null
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

// 開獎紀錄(看路) + 排行榜
interface RecentRound {
  dice: number[]
  total: number
  kind: 'BIG' | 'SMALL' | 'TRIPLE'
}
interface RankRow {
  rank: number
  userName: string
  net: number
  spins: number
  me: boolean
}
const recentRounds = ref<RecentRound[]>([])
const leaderboard = ref<RankRow[]>([])

// 聊天室
interface ChatMsg {
  userName: string
  text: string
  ts: number
}
const chatMessages = ref<ChatMsg[]>([])
const chatDraft = ref('')
const chatOpen = ref(false) // 手機抽屜開關
const chatSending = ref(false)
const chatScroll = ref<HTMLElement | null>(null)
const myName = computed(() => authStore.member?.userName ?? '')

// 下注選擇
const betType = ref<BetType>('BIG')
const singlePick = ref(1)
const sumPick = ref(10)
const sumOptions = Array.from({ length: 14 }, (_, i) => i + 4)
// 和(總點)下拉選單,順便帶賠率,例如「10 點 · 6:1」
const sumSelectOptions = computed(() =>
  sumOptions.map((n) => {
    const row = paytable.value.find((r) => r.type === 'SUM' + n)
    const pay = row && row.multiplier > 1 ? ` · ${row.multiplier - 1}:1` : ''
    return { value: n, label: `${n} 點${pay}` }
  }),
)
const placing = ref(false)

// 倒數
const nowMs = ref(Date.now())
let tickTimer: number | undefined

// 骰子動畫
const displayDice = ref<number[]>([1, 1, 1])
const rolling = ref(false)
let lastSettledRoundId = -1
// 只有「這次連線現場看到的結算局」才顯示結果/動畫;重整後為 null → 不重播、桌面清空
const liveResultRoundId = ref<number | null>(null)
let initialized = false
let resultClearTimer: number | undefined
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
function playLose() {
  const ctx = ensureAudio()
  if (!ctx) return
  const t = ctx.currentTime
  // 兩個下降的低音,像「噢～」殘念
  ;[330, 247].forEach((f, i) => tone(ctx, t + i * 0.14, f, 0.28, 0.12, 'sine'))
}
function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* 不支援就算了 */
  }
}

// 中獎尊榮動畫
const celebration = ref<{
  show: boolean
  tier: 'jackpot' | 'win' | 'lose'
  amount: number
  title: string
} | null>(null)
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
  let closeMs = 4500
  if (poolWin > 0) {
    celebration.value = { show: true, tier: 'jackpot', amount: ret, title: '豹子中彩金池！' }
    playJackpot()
    vibrate([0, 80, 40, 80, 40, 120, 60, 220])
  } else if (net > 0) {
    celebration.value = { show: true, tier: 'win', amount: net, title: '恭喜中獎' }
    playWin()
    vibrate([0, 60, 40, 110])
  } else if (net < 0) {
    // 輸:殘念動畫(低調、較快關閉)
    celebration.value = { show: true, tier: 'lose', amount: -net, title: '殘念～下次再來' }
    playLose()
    vibrate([0, 130])
    closeMs = 1800
  } else {
    return // net == 0(保本,例如豹子退本但池空),不打擾
  }
  if (celeTimer) clearTimeout(celeTimer)
  celeTimer = window.setTimeout(closeCelebration, closeMs)
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

// 下注金額(可由倍率快選帶入,也可自訂);最小 = 基準注
const betAmountInput = ref<number | null>(null)
const minBet = computed(() => Number(config.value.betAmount || 0))
const effectiveBet = computed(() => Math.floor(Number(betAmountInput.value) || 0))
function setMult(m: number) {
  betAmountInput.value = Number(config.value.betAmount || 0) * m
}
const pick = computed(() =>
  betType.value === 'SINGLE' ? singlePick.value : betType.value === 'SUM' ? sumPick.value : 0,
)

// 目前玩法的最大總返還倍率(莊家賠付能力預留用)
const curMaxReturn = computed(() => {
  const t = betType.value
  if (t === 'BIG' || t === 'SMALL') return 2
  if (t === 'SINGLE') return 13
  if (t === 'TRIPLE') return 1
  const row = paytable.value.find((r) => r.type === 'SUM' + sumPick.value)
  return row ? row.multiplier : 0
})
const curNet = computed(() => Math.max(0, curMaxReturn.value - 1))
// 此注上限 = 本局莊家剩餘可承受 ÷ (賠率-1);豹子(net 0)莊家面不限
const maxBetForCurrent = computed(() => {
  if (curNet.value <= 0) return Infinity
  return Math.floor(Number(state.value?.remainingCapacity ?? 0) / curNet.value)
})
const overCap = computed(
  () => maxBetForCurrent.value !== Infinity && effectiveBet.value > maxBetForCurrent.value,
)
const belowMin = computed(() => effectiveBet.value < minBet.value)
const betTypeLabel = (t: string): string =>
  ({ BIG: '大', SMALL: '小', SUM: '和', SINGLE: '點數', TRIPLE: '豹子' })[t] ?? t

// 用伺服器給的剩餘時間換算成「本地截止時刻」,倒數只看本地經過時間 → 免裝置時鐘誤差
const localDeadlineMs = ref(0)
const countdown = computed(() => {
  const s = state.value
  if (!s || s.status !== 'BETTING') return 0
  return Math.max(0, Math.ceil((localDeadlineMs.value - nowMs.value) / 1000))
})
// 倒數剩 ≤1 秒就封盤(擋最後一秒,避免壓秒/與結算競態)
const closing = computed(() => state.value?.status === 'BETTING' && countdown.value <= 1)
const bankerIsMe = computed(
  () => !!state.value?.bankerName && state.value?.bankerName === authStore.member?.userName,
)
const hasBanker = computed(() => !!state.value?.bankerName)

// 顯示階段:重整後不顯示舊結果,SETTLED 但非現場看到的一律當 waiting
const phase = computed<'betting' | 'result' | 'waiting'>(() => {
  const s = state.value
  if (!s) return 'waiting'
  if (s.status === 'BETTING') return 'betting'
  if (s.status === 'SETTLED' && s.roundId != null && s.roundId === liveResultRoundId.value) return 'result'
  return 'waiting'
})
// 開骰中 / 結果展示中,直到桌面清空(下一場開放)前都不給下注
const revealLocked = computed(() => rolling.value || phase.value === 'result')

const phaseText = computed(() => {
  const s = state.value
  if (!s) return ''
  if (!s.diceEnabled) return '骰寶目前未開放'
  if (rolling.value) return '開骰中…'
  if (phase.value === 'betting') return closing.value ? '🔒 已封盤，準備開骰…' : `下注中 ${countdown.value}s`
  if (phase.value === 'result') return '本局結果'
  return '等待開局 · 有人下注就開始'
})

const canBet = computed(
  () =>
    !!state.value?.diceEnabled &&
    hasBanker.value &&
    !bankerIsMe.value &&
    !closing.value &&
    !revealLocked.value &&
    !placing.value &&
    !belowMin.value &&
    !overCap.value &&
    Number(state.value?.myBalance || 0) >= effectiveBet.value,
)
function cantBetReason(): string {
  const s = state.value
  if (!s?.diceEnabled) return '骰寶目前未開放'
  if (!hasBanker.value) return '目前沒有莊家，先坐莊或等人坐莊'
  if (bankerIsMe.value) return '你是莊家，不能玩自己的莊'
  if (closing.value) return '本局已封盤，等下一局再下注'
  if (revealLocked.value) return '開獎中，等下一局開放再下注'
  if (belowMin.value) return `最小下注 ${fmt(minBet.value)} ${s?.currency ?? ''}`
  if (overCap.value)
    return `此玩法本局上限約 ${fmt(maxBetForCurrent.value)}，請降低金額`
  if (Number(s?.myBalance || 0) < effectiveBet.value) return '餘額不足'
  return ''
}

const myBetsTotal = computed(() =>
  (state.value?.bets ?? []).filter((b) => b.mine).reduce((sum, b) => sum + Number(b.amount), 0),
)

// 同一人 + 同玩法 + 同點數的注疊加成一筆,避免一直下同樣的把清單拉太長
const aggregatedBets = computed<(BetView & { key: string })[]>(() => {
  const map = new Map<string, BetView & { key: string }>()
  for (const b of state.value?.bets ?? []) {
    const key = `${b.memberId}|${b.betType}|${b.pick}`
    const ex = map.get(key)
    if (ex) {
      ex.amount += Number(b.amount)
      ex.payout += Number(b.payout)
      ex.poolWin += Number(b.poolWin)
      ex.win = ex.win || b.win
      ex.settled = ex.settled || b.settled
    } else {
      map.set(key, {
        ...b,
        key,
        amount: Number(b.amount),
        payout: Number(b.payout),
        poolWin: Number(b.poolWin),
      })
    }
  }
  return Array.from(map.values())
})

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
  }
  // 預設下注金額 = 基準注(最小注)
  if (betAmountInput.value == null || betAmountInput.value <= 0) {
    betAmountInput.value = Number(d.betAmount) || 0
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

async function loadBoards() {
  try {
    const [rr, lb] = await Promise.all([
      fetch(`${API}/dice/recent-rounds?limit=24`, { headers: headers() }),
      fetch(`${API}/dice/leaderboard?limit=10`, { headers: headers() }),
    ])
    if (rr.ok) recentRounds.value = await rr.json()
    if (lb.ok) {
      const d = await lb.json()
      leaderboard.value = Array.isArray(d)
        ? d.map((r: RankRow) => ({
            rank: r.rank,
            userName: r.userName,
            net: Number(r.net),
            spins: Number(r.spins),
            me: !!r.me,
          }))
        : []
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadChat() {
  try {
    const res = await fetch(`${API}/dice/chat`, { headers: headers() })
    if (!res.ok) return
    chatMessages.value = await res.json()
    nextTick(scrollChatToBottom)
  } catch (e) {
    console.error(e)
  }
}
function scrollChatToBottom() {
  const el = chatScroll.value
  if (el) el.scrollTop = el.scrollHeight
}
async function sendChat() {
  const text = chatDraft.value.trim()
  if (!text || chatSending.value) return
  chatSending.value = true
  try {
    const res = await fetch(`${API}/dice/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ text }),
    })
    const d = await res.json()
    if (!res.ok) {
      useAlert.error(d.message ?? '送出失敗')
      return
    }
    chatDraft.value = ''
    await loadChat()
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  } finally {
    chatSending.value = false
  }
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
    // 用「本地當下 + 伺服器剩餘時間」當截止時刻,倒數只看本地經過時間(免裝置時鐘誤差)
    localDeadlineMs.value = d.status === 'BETTING' ? Date.now() + Number(d.remainingMs || 0) : 0
    if (!initialized) {
      // 首次載入 / 重整:不重播動畫,把目前已結算局標記成「已看過」→ 桌面顯示等待,不再跑一次
      initialized = true
      if (d.status === 'SETTLED' && d.roundId) lastSettledRoundId = d.roundId
    } else if (d.status === 'SETTLED' && d.dice && d.roundId && d.roundId !== lastSettledRoundId) {
      // 現場結算 → 播開骰動畫 + 顯示結果,7 秒後自動清空(回到等待)
      lastSettledRoundId = d.roundId
      liveResultRoundId.value = d.roundId
      if (resultClearTimer) clearTimeout(resultClearTimer)
      resultClearTimer = window.setTimeout(() => {
        liveResultRoundId.value = null
      }, 7000)
      void animateRoll(d.dice)
      loadBoards() // 結算後刷新開獎紀錄 + 排行榜
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
        amount: effectiveBet.value,
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
    const res = await fetch(`${API}/dice/bank/take`, {
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
    const res = await fetch(`${API}/dice/bank/leave`, { method: 'POST', headers: headers() })
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
  loadBoards()
  loadChat()
  loading.value = false

  const clanId = authStore.member?.clanId
  if (clanId) {
    ws = createReconnectingStomp(`/topic/dice/${clanId}`, (body) => {
      if (body === 'DICE_UPDATED') fetchRound()
      else if (body === 'DICE_CHAT') loadChat()
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
  if (resultClearTimer) clearTimeout(resultClearTimer)
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
  <div class="dice-shell">
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
      <div class="phase" :class="{ betting: phase === 'betting' && !closing, rolling }">
        <span class="phase-text">{{ phaseText }}</span>
        <div v-if="phase === 'betting' && !closing" class="cd-bar">
          <div class="cd-fill" :style="{ width: (countdown / 30) * 100 + '%' }"></div>
        </div>
      </div>

      <!-- 骰盅 -->
      <div class="dice-arena" :class="{ shaking: rolling }">
        <template v-if="rolling || phase === 'result'">
          <div v-for="(d, i) in displayDice" :key="i" class="die" :class="{ spin: rolling }">{{ FACES[d] }}</div>
        </template>
        <template v-else>
          <div v-for="i in 3" :key="'idle' + i" class="die idle">🎲</div>
        </template>
      </div>
      <div v-if="phase === 'result' && !rolling" class="total-row">
        <span class="total-tag">總點 {{ total }}</span>
        <span v-if="isTriple" class="triple-tag">豹子！</span>
        <span v-else-if="total >= 11 && total <= 17" class="bs-tag big">大</span>
        <span v-else class="bs-tag small">小</span>
        <span v-if="state.poolWin > 0" class="pool-win-tag">🏆 彩金池 {{ fmt(state.poolWin) }}</span>
      </div>

      <!-- 開獎紀錄(看路) -->
      <div v-if="recentRounds.length" class="road">
        <span class="road-label">開獎</span>
        <div class="road-list">
          <span
            v-for="(r, i) in recentRounds"
            :key="i"
            class="road-chip"
            :class="r.kind.toLowerCase()"
            :title="r.dice.join('-') + ' = ' + r.total"
          >
            {{ r.kind === 'TRIPLE' ? '豹' : r.total }}
          </span>
        </div>
      </div>

      <!-- 本局下注 -->
      <div class="bets-board">
        <template v-if="phase === 'waiting'">
          <div class="bets-empty">🪑 桌面已清空 · 下第一注即開新局！</div>
        </template>
        <template v-else>
          <div class="bets-head">
            {{ phase === 'result' ? '本局結果' : '本局下注' }}（{{ aggregatedBets.length }}）<span v-if="myBetsTotal > 0" class="my-total">· 我押 {{ fmt(myBetsTotal) }}</span>
          </div>
          <div v-if="!aggregatedBets.length" class="bets-empty">還沒有人下注，下第一注即開局！</div>
          <div v-else class="bets-list">
            <div v-for="b in aggregatedBets" :key="b.key" class="bet-chip" :class="{ mine: b.mine, won: b.settled && b.win, lost: b.settled && !b.win }">
              <span class="bet-who">{{ b.mine ? '你' : b.userName }}</span>
              <span class="bet-what">{{ betTypeLabel(b.betType) }}{{ b.betType === 'SUM' || b.betType === 'SINGLE' ? b.pick : '' }}</span>
              <span class="bet-amt">{{ fmt(b.amount) }}</span>
              <span v-if="b.settled" class="bet-res">
                {{ b.poolWin > 0 ? '🏆+' + fmt(b.poolWin) : b.win ? '+' + fmt(b.payout) : '✕' }}
              </span>
            </div>
          </div>
        </template>
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

      <div v-if="betType === 'SINGLE'" class="single-pick">
        <span class="pick-label">點數</span>
        <div class="single-grid">
          <button
            v-for="n in 6"
            :key="n"
            class="die-pick"
            :class="{ active: singlePick === n }"
            @click="singlePick = n"
          >
            <span class="die-face">{{ FACES[n] }}</span>
            <span class="die-num">{{ n }} 點</span>
          </button>
        </div>
      </div>
      <div v-if="betType === 'SUM'" class="pick-row">
        <span class="pick-label">總點</span>
        <select v-model.number="sumPick" class="sum-select">
          <option v-for="o in sumSelectOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <div class="mult-row">
        <span class="pick-label">快選</span>
        <div class="mult-grid">
          <button
            v-for="m in betMultipliers"
            :key="m"
            class="mult-btn"
            :class="{ active: effectiveBet === minBet * m }"
            @click="setMult(m)"
          >
            ×{{ m }}
          </button>
        </div>
      </div>

      <!-- 自訂下注金額 -->
      <div class="amount-row">
        <span class="pick-label">金額</span>
        <input
          v-model.number="betAmountInput"
          type="number"
          class="amount-input"
          :class="{ bad: belowMin || overCap }"
          :min="minBet"
          step="1"
          placeholder="自訂下注金額"
        />
      </div>

      <div class="bet-summary">本注 <b>{{ fmt(effectiveBet) }}</b> {{ state.currency }} · 餘額 {{ fmt(state.myBalance) }}</div>
      <div class="cap-hint">
        最小 {{ fmt(minBet) }} · 此注上限
        <b :class="{ over: overCap }">{{ maxBetForCurrent === Infinity ? '不限' : fmt(maxBetForCurrent) }}</b>
        · 莊家本局還可承受 {{ fmt(state.remainingCapacity) }} {{ state.currency }}
      </div>
      <button class="roll-btn" :disabled="!canBet" @click="placeBet">
        {{ placing ? '下注中…' : closing ? '封盤中…' : revealLocked ? '開獎中…' : '🪙 下注' }}
      </button>
      <p v-if="!canBet && !placing" class="ineligible">{{ cantBetReason() }}</p>

      <!-- 賺錢排行榜 -->
      <div v-if="leaderboard.length" class="board">
        <h3>🏆 賺錢排行榜</h3>
        <div class="rank-list">
          <div v-for="r in leaderboard" :key="r.rank" class="rank-row" :class="{ me: r.me }">
            <span class="rank-no">{{ r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + r.rank }}</span>
            <span class="rank-name">{{ r.me ? '你' : r.userName }}</span>
            <span class="rank-net" :class="r.net >= 0 ? 'up' : 'down'">{{ r.net >= 0 ? '+' : '−' }}{{ fmt(Math.abs(r.net)) }}</span>
          </div>
        </div>
      </div>

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
      <div v-if="phase === 'result' && state.serverSeed" class="fair">
        <div>🔒 上局公平性 · nonce {{ state.nonce }}</div>
        <div>serverSeed: <code>{{ state.serverSeed }}</code></div>
      </div>
    </template>
    </div><!-- /.dice-page -->

    <!-- 聊天室(桌面右側 / 手機浮動抽屜) -->
    <aside class="dice-chat" :class="{ open: chatOpen }">
      <div class="chat-head">
        <span>💬 聊天室</span>
        <button class="chat-x" @click="chatOpen = false" aria-label="關閉">✕</button>
      </div>
      <div ref="chatScroll" class="chat-msgs">
        <div v-if="!chatMessages.length" class="chat-empty">還沒有人說話，來開個話題吧～</div>
        <div
          v-for="(m, i) in chatMessages"
          :key="i"
          class="chat-msg"
          :class="{ mine: m.userName === myName }"
        >
          <span class="chat-who">{{ m.userName === myName ? '我' : m.userName }}</span>
          <span class="chat-bubble">{{ m.text }}</span>
        </div>
      </div>
      <form class="chat-form" @submit.prevent="sendChat">
        <input v-model="chatDraft" class="chat-input" maxlength="100" placeholder="說點什麼…" />
        <button type="submit" class="chat-send" :disabled="chatSending || !chatDraft.trim()">送</button>
      </form>
    </aside>

    <!-- 手機:浮動聊天鈕 -->
    <button class="chat-fab" :class="{ active: chatOpen }" @click="chatOpen = !chatOpen" aria-label="聊天室">
      {{ chatOpen ? '✕' : '💬' }}
    </button>

    <!-- 中獎尊榮動畫 -->
    <transition name="cele">
      <div
        v-if="celebration?.show"
        class="cele-overlay"
        :class="celebration.tier"
        @click="closeCelebration"
      >
        <div v-if="celebration.tier !== 'lose'" class="cele-rays"></div>
        <div class="cele-card">
          <div class="cele-emoji">
            {{ celebration.tier === 'jackpot' ? '🎲🎲🎲' : celebration.tier === 'win' ? '🎉' : '💸' }}
          </div>
          <div class="cele-title">{{ celebration.title }}</div>
          <div class="cele-amt">
            {{ celebration.tier === 'lose' ? '-' : '+' }}{{ fmt(celebration.amount) }} {{ state?.currency }}
          </div>
          <button class="btn cele-btn" :class="celebration.tier === 'lose' ? 'btn-leave' : 'btn-take'" @click.stop="closeCelebration">
            {{ celebration.tier === 'lose' ? '知道了' : '收下！' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* 外層:桌面 = 賭桌 + 右側聊天室並排;手機 = 單欄 */
.dice-shell {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: center;
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}
.dice-page {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 560px;
  padding: 16px;
  color: #e2e8f0;
}

/* === 聊天室 === */
.dice-chat {
  flex: 0 0 300px;
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  max-height: 700px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--c-light);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.chat-x {
  display: none;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
}
.chat-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
}
.chat-empty {
  color: #64748b;
  font-size: 0.8rem;
  text-align: center;
  margin: auto 0;
}
.chat-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 90%;
}
.chat-msg.mine {
  align-self: flex-end;
  align-items: flex-end;
}
.chat-who {
  font-size: 0.66rem;
  color: #94a3b8;
  margin: 0 4px 1px;
}
.chat-bubble {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 5px 10px;
  font-size: 0.85rem;
  color: #e2e8f0;
  word-break: break-word;
  line-height: 1.4;
}
.chat-msg.mine .chat-bubble {
  background: rgba(var(--c-light-rgb), 0.18);
  border-color: rgba(var(--c-light-rgb), 0.4);
  color: var(--c-light);
}
.chat-form {
  display: flex;
  align-items: center; /* 不要把「送」鈕拉伸到滿高 */
  gap: 8px;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.chat-input {
  flex: 1 1 0; /* 輸入框吃滿剩餘寬度 */
  min-width: 0;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  margin: 0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 9px;
  color: #fff;
  font-size: 0.88rem;
  vertical-align: middle;
}
.chat-input:focus {
  outline: none;
  border-color: var(--c-light);
}
.chat-send {
  flex: 0 0 56px; /* 固定窄寬,不長不縮 */
  width: 56px;
  height: 40px;
  align-self: center; /* 與輸入框同一條中線 */
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  vertical-align: middle;
}
.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.chat-fab {
  display: none;
}

/* 手機:聊天室變底部抽屜 + 浮動鈕 */
@media (max-width: 880px) {
  .dice-shell {
    display: block;
    max-width: 560px;
  }
  .dice-page {
    max-width: none;
  }
  .dice-chat {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    height: 62vh;
    max-height: none;
    flex: none;
    /* 手機抽屜浮在遊戲上方,要實心深色背景,不能透明否則會看穿到後面 */
    background: #131722;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: none;
    border-radius: 16px 16px 0 0;
    transform: translateY(105%);
    transition: transform 0.3s ease;
    z-index: 1500;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6);
  }
  .dice-chat.open {
    transform: translateY(0);
  }
  .chat-x {
    display: inline-flex;
  }
  .chat-fab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
    color: var(--c-on);
    font-size: 1.4rem;
    cursor: pointer;
    z-index: 1600;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  }
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
.die.idle {
  opacity: 0.4;
  font-size: 2.4rem;
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
  /* minmax(0,1fr):強制 5 欄真正等寬,不被「猜點數」內容撐開 */
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.bet-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 46px;
  padding: 0 2px;
  border-radius: 10px;
  border: 1px solid #2e3147;
  background: #0f111a;
  color: #cbd5e1;
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
  white-space: nowrap;
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
  flex-wrap: wrap;
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

/* 倍率:等寬 grid 一排,不再滿版直排 */
.mult-grid {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(46px, 1fr));
  gap: 6px;
}
.mult-btn {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid #2e3147;
  background: #0f111a;
  color: #cbd5e1;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}
.mult-btn.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}

/* 自訂下注金額 */
.amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.amount-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 9px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}
.amount-input:focus {
  outline: none;
  border-color: var(--c-light);
}
.amount-input.bad {
  border-color: #f87171;
}

/* 和(總點)下拉選單 */
.sum-select {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 34px 0 12px;
  border-radius: 9px;
  border: 1px solid #2e3147;
  background-color: #0f111a;
  color: #e2e8f0;
  font-size: 0.92rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.sum-select:focus {
  outline: none;
  border-color: var(--c-light);
}
.sum-select option {
  background: #161822;
  color: #e2e8f0;
}

/* 猜點數:大骰面 + 數字標籤,看得清楚是幾點 */
.single-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.single-grid {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.die-pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  height: 56px;
  border: 1px solid #2e3147;
  background: #0f111a;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.die-pick .die-face {
  font-size: 1.7rem;
  line-height: 1;
  color: #e2e8f0;
}
.die-pick .die-num {
  font-size: 0.68rem;
  font-weight: 800;
  color: #94a3b8;
  letter-spacing: 0.3px;
}
.die-pick.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
}
.die-pick.active .die-face {
  color: var(--c-light);
}
.die-pick.active .die-num {
  color: var(--c-light);
}
.bet-summary {
  text-align: center;
  font-size: 0.9rem;
  margin-bottom: 4px;
  color: #cbd5e1;
}
.cap-hint {
  text-align: center;
  font-size: 0.76rem;
  color: #64748b;
  margin-bottom: 10px;
}
.cap-hint b {
  color: #94a3b8;
}
.cap-hint b.over {
  color: #f87171;
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

/* === 開獎紀錄(看路) === */
.road {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.road-label {
  flex-shrink: 0;
  font-size: 0.76rem;
  font-weight: 800;
  color: #94a3b8;
}
.road-list {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.road-chip {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
  border: 1px solid transparent;
}
.road-chip.big {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
}
.road-chip.small {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.4);
}
.road-chip.triple {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: #1a1305;
}

/* === 排行榜 === */
.board {
  margin-top: 18px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.board h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: var(--c-light);
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rank-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 8px;
  font-size: 0.84rem;
}
.rank-row.me {
  background: rgba(var(--c-light-rgb), 0.12);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
}
.rank-no {
  text-align: center;
}
.rank-name {
  color: #e2e8f0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rank-net {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rank-net.up {
  color: #4ade80;
}
.rank-net.down {
  color: #f87171;
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
.cele-overlay.lose {
  background: rgba(8, 10, 14, 0.85);
}
.cele-overlay.lose .cele-card {
  border: 1px solid #3a3f5c;
  box-shadow: none;
}
.cele-overlay.lose .cele-title {
  color: #94a3b8;
}
.cele-overlay.lose .cele-amt {
  color: #cbd5e1;
}
.cele-overlay.lose .cele-emoji {
  animation: lose-sink 0.6s ease-out;
}
@keyframes lose-sink {
  0% { transform: translateY(-10px) scale(1.1); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
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
  .bet-types {
    gap: 6px;
  }
  .bet-btn {
    height: 42px;
    font-size: 0.8rem;
    letter-spacing: 0;
  }
}
</style>
