<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()

type BetType = 'STRAIGHT' | 'RED' | 'BLACK' | 'ODD' | 'EVEN' | 'LOW' | 'HIGH' | 'DOZEN' | 'COLUMN'

// ── 輪盤實體轉輪順序(順時針,歐式單零 37 格)+ 紅格 ──
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
function pocketColor(n: number): 'red' | 'black' | 'green' {
  return n === 0 ? 'green' : RED_SET.has(n) ? 'red' : 'black'
}
// 遊戲語意色(允許硬碼:輪盤格/紅黑注)
const FILL = { red: '#c8102e', black: '#161616', green: '#0f8a3c' }
function fillFor(n: number): string {
  return FILL[pocketColor(n)]
}

// ── 轉輪幾何(viewBox 0 0 300 300) ──
const CX = 150
const CY = 150
const R = 138
const SECTOR = 360 / 37
const labelR = R * 0.82
const half = ((SECTOR / 2) * Math.PI) / 180
const p1x = CX + R * Math.sin(-half)
const p1y = CY - R * Math.cos(-half)
const p2x = CX + R * Math.sin(half)
const p2y = CY - R * Math.cos(half)
// 頂端(0°)的一格扇形路徑,其餘格子用 rotate 複製
const SECTOR_PATH = `M${CX},${CY} L${p1x.toFixed(2)},${p1y.toFixed(2)} A${R},${R} 0 0 1 ${p2x.toFixed(2)},${p2y.toFixed(2)} Z`
const sectors = WHEEL_ORDER.map((n, i) => ({ n, rot: i * SECTOR, fill: fillFor(n) }))

const loading = ref(true)
const config = ref({ currency: '', enabled: false, betAmount: 10, maxPayout: 1000000, maxBet: 2000000 })
const betMultipliers = ref<number[]>([1, 2, 3, 5, 10, 100])

interface BetView {
  memberId: number
  userName: string
  betType: string
  pick: number
  amount: number
  payout: number
  win: boolean
  settled: boolean
  mine: boolean
}
interface RoundState {
  status: string
  roundId: number | null
  deadlineEpochMs: number
  remainingMs: number
  resultPocket: number | null
  resultColor: string | null
  bets: BetView[]
  online: string[]
  poolBalance: number
  bankerName: string | null
  bankroll: number | null
  remainingCapacity: number | null
  rouletteEnabled: boolean
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

interface RecentRound {
  pocket: number
  color: string
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
const chatOpen = ref(false)
const chatSending = ref(false)
const chatScroll = ref<HTMLElement | null>(null)
const myName = computed(() => authStore.member?.userName ?? '')

// 下注選擇
const betType = ref<BetType>('RED')
const straightPick = ref(17)
const dozenPick = ref(1)
const columnPick = ref(1)
const placing = ref(false)
const pick = computed(() =>
  betType.value === 'STRAIGHT'
    ? straightPick.value
    : betType.value === 'DOZEN'
      ? dozenPick.value
      : betType.value === 'COLUMN'
        ? columnPick.value
        : 0,
)

// 號碼盤(0 + 3×12):標準三行排列
const boardRows = [
  Array.from({ length: 12 }, (_, c) => 3 * (c + 1)), // 3,6,…,36
  Array.from({ length: 12 }, (_, c) => 3 * c + 2), // 2,5,…,35
  Array.from({ length: 12 }, (_, c) => 3 * c + 1), // 1,4,…,34
]
function pickStraight(n: number) {
  betType.value = 'STRAIGHT'
  straightPick.value = n
}

// 倒數
const nowMs = ref(Date.now())
let tickTimer: number | undefined

// 轉輪動畫
const wheelRotation = ref(0)
const ballRotation = ref(0)
const spinning = ref(false)
let lastSettledRoundId = -1
const liveResultRoundId = ref<number | null>(null)
// 開獎揭曉快照:結算當下把結果+下注拍下來,揭曉期間都用它顯示,不怕 state 被下一局覆蓋
const resultSnap = ref<{ pocket: number; color: string | null; bets: BetView[] } | null>(null)
let initialized = false
let resultClearTimer: number | undefined
let spinTimer: number | undefined

// 音效(Web Audio 合成,免音檔) + 震動
const soundOn = ref(localStorage.getItem('roulette_sound') !== 'off')
function toggleSound() {
  soundOn.value = !soundOn.value
  localStorage.setItem('roulette_sound', soundOn.value ? 'on' : 'off')
  if (soundOn.value) ensureAudio()
}

// ── 背景音樂(BGM,預留) ──
// 音檔放 public/roulette-bgm.mp3;現在檔案還沒放,控制項先預留,放進去就自動生效。
const bgmOn = ref(localStorage.getItem('roulette_bgm') === 'on')
const bgmVol = ref(Math.min(1, Math.max(0, Number(localStorage.getItem('roulette_vol') ?? '0.5'))))
let bgmAudio: HTMLAudioElement | null = null
let bgmArmed = false
function ensureBgm(): HTMLAudioElement {
  if (!bgmAudio) {
    bgmAudio = new Audio('/roulette-bgm.mp3')
    bgmAudio.loop = true
    bgmAudio.volume = bgmVol.value
    bgmAudio.addEventListener('error', () => {}) // 音檔還沒放 → 安靜略過,不噴錯
  }
  return bgmAudio
}
function startBgm() {
  const a = ensureBgm()
  a.volume = bgmVol.value
  a.play().catch(() => {}) // 被瀏覽器擋自動播放時,交給 armAutoStart 於首次互動補播
}
function stopBgm() {
  if (bgmAudio) bgmAudio.pause()
}
function toggleBgm() {
  bgmOn.value = !bgmOn.value
  localStorage.setItem('roulette_bgm', bgmOn.value ? 'on' : 'off')
  if (bgmOn.value) startBgm()
  else stopBgm()
}
watch(bgmVol, (v) => {
  const nv = Math.min(1, Math.max(0, Number(v) || 0))
  localStorage.setItem('roulette_vol', String(nv))
  if (bgmAudio) bgmAudio.volume = nv
})
// 瀏覽器擋自動播放:第一次互動時,若使用者先前有開 BGM 就補播一次
function armAutoStart() {
  if (bgmArmed) return
  bgmArmed = true
  const kick = () => {
    if (bgmOn.value) startBgm()
    window.removeEventListener('pointerdown', kick)
    window.removeEventListener('keydown', kick)
  }
  window.addEventListener('pointerdown', kick)
  window.addEventListener('keydown', kick)
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
  bp.Q.value = 1.4
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
// 轉輪的「球滾動」聲:一連串加速→減速的滴答聲(球滾過格子)
function playSpin() {
  const ctx = ensureAudio()
  if (!ctx) return
  let t = ctx.currentTime
  let gap = 0.05
  for (let i = 0; i < 42; i++) {
    noiseBurst(ctx, t, 0.03, 2400 + Math.random() * 800, 0.16)
    t += gap
    gap += i < 10 ? -0.001 : 0.004 // 先加速再逐漸變慢,像球慢慢停下
  }
}
function playWin() {
  const ctx = ensureAudio()
  if (!ctx) return
  const t = ctx.currentTime
  ;[523, 659, 784].forEach((f, i) => tone(ctx, t + i * 0.1, f, 0.26, 0.16, 'triangle'))
}
function playLose() {
  const ctx = ensureAudio()
  if (!ctx) return
  const t = ctx.currentTime
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
  tier: 'win' | 'lose'
  amount: number
  title: string
} | null>(null)
let celeTimer: number | undefined
function closeCelebration() {
  if (celebration.value) celebration.value.show = false
}
function showMyResult() {
  const myBets = (resultSnap.value?.bets ?? state.value?.bets ?? []).filter((b) => b.mine && b.settled)
  if (!myBets.length) return
  const ret = myBets.reduce((s, b) => s + Number(b.payout || 0), 0)
  const stake = myBets.reduce((s, b) => s + Number(b.amount || 0), 0)
  const net = ret - stake
  let closeMs = 4000
  if (net > 0) {
    celebration.value = { show: true, tier: 'win', amount: net, title: '恭喜中獎' }
    playWin()
    vibrate([0, 60, 40, 110])
  } else if (net < 0) {
    celebration.value = { show: true, tier: 'lose', amount: -net, title: '殘念～下次再來' }
    playLose()
    vibrate([0, 130])
    closeMs = 1800
  } else {
    // 打平(例如紅黑對押):有中的注就給個回本提示,別靜悄悄
    if (myBets.some((b) => b.win)) {
      celebration.value = { show: true, tier: 'win', amount: 0, title: '回本～對押打平' }
      playWin()
    } else {
      return
    }
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

// 下注金額
const betAmountInput = ref<number | null>(null)
const minBet = computed(() => Number(config.value.betAmount || 0))
const effectiveBet = computed(() => Math.floor(Number(betAmountInput.value) || 0))
function setMult(m: number) {
  betAmountInput.value = Number(config.value.betAmount || 0) * m
}

// 賠付相關
function maxReturnOf(t: BetType): number {
  if (t === 'STRAIGHT') return 36
  if (t === 'DOZEN' || t === 'COLUMN') return 3
  return 2
}
function oddsLabel(t: BetType): string {
  if (t === 'STRAIGHT') return '35:1'
  if (t === 'DOZEN' || t === 'COLUMN') return '2:1'
  return '1:1'
}
const betTypeLabel = (t: string): string =>
  ({ STRAIGHT: '直注', RED: '紅', BLACK: '黑', ODD: '單', EVEN: '雙', LOW: '小', HIGH: '大', DOZEN: '三打', COLUMN: '三行' })[t] ??
  t
function dozenLabel(p: number): string {
  return p === 1 ? '1-12' : p === 2 ? '13-24' : '25-36'
}
function betDetail(b: BetView): string {
  if (b.betType === 'STRAIGHT') return String(b.pick)
  if (b.betType === 'DOZEN') return dozenLabel(b.pick)
  if (b.betType === 'COLUMN') return '第' + b.pick + '行'
  return ''
}
const selectionText = computed(() => {
  const t = betType.value
  if (t === 'STRAIGHT') return `直注 ${straightPick.value} · 35:1`
  if (t === 'DOZEN') return `押 三打 ${dozenLabel(dozenPick.value)} · 2:1`
  if (t === 'COLUMN') return `押 三行 第${columnPick.value}行 · 2:1`
  return `押 ${betTypeLabel(t)} · ${oddsLabel(t)}`
})

const curMaxReturn = computed(() => maxReturnOf(betType.value))
const curNet = computed(() => Math.max(0, curMaxReturn.value - 1))
// 本局我已下注總額(每人本局累計上限用),只算進行中(BETTING)這局
const myBetsTotal = computed(() => {
  if (state.value?.status !== 'BETTING') return 0
  return (state.value?.bets ?? []).filter((b) => b.mine).reduce((sum, b) => sum + Number(b.amount), 0)
})
const roundAllowance = computed(() => Math.max(0, config.value.maxBet - myBetsTotal.value))
const maxBetForCurrent = computed(() => {
  const bankerCap =
    curNet.value <= 0 ? Infinity : Math.floor(Number(state.value?.remainingCapacity ?? 0) / curNet.value)
  return Math.min(bankerCap, roundAllowance.value)
})
const overCap = computed(
  () => maxBetForCurrent.value !== Infinity && effectiveBet.value > maxBetForCurrent.value,
)
const belowMin = computed(() => effectiveBet.value < minBet.value)

// 倒數
const localDeadlineMs = ref(0)
const countdown = computed(() => {
  const s = state.value
  if (!s || s.status !== 'BETTING') return 0
  return Math.max(0, Math.ceil((localDeadlineMs.value - nowMs.value) / 1000))
})
const closing = computed(() => state.value?.status === 'BETTING' && countdown.value <= 1)
const bankerIsMe = computed(
  () => !!state.value?.bankerName && state.value?.bankerName === authStore.member?.userName,
)
const hasBanker = computed(() => !!state.value?.bankerName)

const phase = computed<'betting' | 'result' | 'waiting'>(() => {
  if (liveResultRoundId.value != null) return 'result' // 揭曉期間固定 result,不受下一局覆蓋 state 影響
  const s = state.value
  if (!s) return 'waiting'
  if (s.status === 'BETTING') return 'betting'
  return 'waiting'
})
const revealLocked = computed(() => spinning.value || phase.value === 'result')

const phaseText = computed(() => {
  const s = state.value
  if (!s) return ''
  if (!s.rouletteEnabled) return '輪盤目前未開放'
  if (spinning.value) return '轉輪中…'
  if (phase.value === 'betting') return closing.value ? '🔒 已封盤，準備開輪…' : `下注中 ${countdown.value}s`
  if (phase.value === 'result') return '本局結果'
  return '等待開局 · 有人下注就開始'
})

const canBet = computed(
  () =>
    !!state.value?.rouletteEnabled &&
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
  if (!s?.rouletteEnabled) return '輪盤目前未開放'
  if (!hasBanker.value) return '目前沒有莊家，先坐莊或等人坐莊'
  if (bankerIsMe.value) return '你是莊家，不能玩自己的莊'
  if (closing.value) return '本局已封盤，等下一局再下注'
  if (revealLocked.value) return '開獎中，等下一局開放再下注'
  if (belowMin.value) return `最小下注 ${fmt(minBet.value)} ${s?.currency ?? ''}`
  if (overCap.value) return `此玩法本局上限約 ${fmt(maxBetForCurrent.value)}，請降低金額`
  if (Number(s?.myBalance || 0) < effectiveBet.value) return '餘額不足'
  return ''
}

// 同一人 + 同玩法 + 同注碼疊加成一筆
const aggregatedBets = computed<(BetView & { key: string })[]>(() => {
  const map = new Map<string, BetView & { key: string }>()
  for (const b of resultSnap.value?.bets ?? state.value?.bets ?? []) {
    const key = `${b.memberId}|${b.betType}|${b.pick}`
    const ex = map.get(key)
    if (ex) {
      ex.amount += Number(b.amount)
      ex.payout += Number(b.payout)
      ex.win = ex.win || b.win
      ex.settled = ex.settled || b.settled
    } else {
      map.set(key, { ...b, key, amount: Number(b.amount), payout: Number(b.payout) })
    }
  }
  return Array.from(map.values())
})

// 顯示結果
const resultPocketShown = computed(() =>
  phase.value === 'result' ? resultSnap.value?.pocket ?? state.value?.resultPocket ?? null : null,
)
const resultColorZh = (c: string | null | undefined) =>
  c === 'red' ? '紅' : c === 'black' ? '黑' : c === 'green' ? '綠' : ''

// ---- API ----
async function loadConfig() {
  const res = await fetch(`${API}/roulette/config`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  config.value = {
    currency: d.currency ?? '',
    enabled: !!d.enabled,
    betAmount: Number(d.betAmount),
    maxPayout: Number(d.maxPayout),
    maxBet: Number(d.maxBet) || 2000000,
  }
  if (Array.isArray(d.betMultipliers) && d.betMultipliers.length) {
    betMultipliers.value = d.betMultipliers
  }
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
      fetch(`${API}/roulette/recent-rounds?limit=24`, { headers: headers() }),
      fetch(`${API}/roulette/leaderboard?limit=10`, { headers: headers() }),
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
    const res = await fetch(`${API}/roulette/chat`, { headers: headers() })
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
    const res = await fetch(`${API}/roulette/chat`, {
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
    const res = await fetch(`${API}/roulette/round`, { headers: headers() })
    if (!res.ok) return
    const d: RoundState = await res.json()
    state.value = d
    localDeadlineMs.value = d.status === 'BETTING' ? Date.now() + Number(d.remainingMs || 0) : 0
    if (!initialized) {
      initialized = true
      if (d.status === 'SETTLED' && d.roundId) {
        lastSettledRoundId = d.roundId
        // 重整後直接把轉輪停在上局結果位置(不重播動畫)
        if (d.resultPocket != null && d.resultPocket >= 0) snapWheelTo(d.resultPocket)
      }
    } else if (
      d.status === 'SETTLED' &&
      d.resultPocket != null &&
      d.resultPocket >= 0 &&
      d.roundId &&
      d.roundId !== lastSettledRoundId
    ) {
      lastSettledRoundId = d.roundId
      liveResultRoundId.value = d.roundId
      // 拍下這局結果+下注,揭曉/中獎提示都用快照,不怕接下來 state 換成下一局
      resultSnap.value = { pocket: d.resultPocket, color: d.resultColor ?? null, bets: (d.bets ?? []).map((b) => ({ ...b })) }
      if (resultClearTimer) clearTimeout(resultClearTimer)
      resultClearTimer = window.setTimeout(() => {
        liveResultRoundId.value = null
        resultSnap.value = null
      }, 7000)
      void animateSpin(d.resultPocket)
      loadBoards()
    }
  } catch (e) {
    console.error(e)
  } finally {
    fetching = false
  }
}

// 讓某格停在頂端指針下方所需的轉輪角度(mod 360)
function landingFor(pocket: number): number {
  const idx = WHEEL_ORDER.indexOf(pocket)
  const raw = (360 - (idx * SECTOR) % 360) % 360
  return raw
}
// 不重播,直接把轉輪擺到上局結果位置
function snapWheelTo(pocket: number) {
  wheelRotation.value = landingFor(pocket)
  ballRotation.value = 0
}
async function animateSpin(finalPocket: number) {
  spinning.value = true
  playSpin()
  vibrate([0, 40, 30, 40, 30, 60, 40, 90])
  const land = landingFor(finalPocket)
  // 轉輪:在目前角度基礎上多轉 ≥6 圈,最後落在 land
  const cur = wheelRotation.value
  let target = cur - (((cur % 360) + 360) % 360) + land
  while (target < cur + 6 * 360) target += 360
  wheelRotation.value = target
  // 球逆向多轉,最後回到頂端(0)
  const bcur = ballRotation.value
  let bt = bcur - (((bcur % 360) + 360) % 360)
  while (bt > bcur - 8 * 360) bt -= 360
  ballRotation.value = bt
  await delay(4100)
  spinning.value = false
  // 精準對齊 + 短暫停頓再揭曉中獎動畫
  wheelRotation.value = target
  await delay(250)
  showMyResult()
}

async function placeBet() {
  if (!canBet.value) {
    const r = cantBetReason()
    if (r) useAlert.error(r)
    return
  }
  ensureAudio()
  placing.value = true
  try {
    const res = await fetch(`${API}/roulette/bet`, {
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

// 莊家(獨立座位)
async function takeBank() {
  const challenge = hasBanker.value
  const hint = challenge
    ? `本金必須大於現任莊家 ${fmt(state.value?.bankroll)}`
    : '輸入你要投入的本金（= 最多可輸的金額）'
  const input = await useAlert.inputDialog(hint, challenge ? '搶莊' : '我要坐莊')
  const amount = Number(input)
  if (!amount || amount <= 0) return
  try {
    const res = await fetch(`${API}/roulette/bank/take`, {
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
    const res = await fetch(`${API}/roulette/bank/leave`, { method: 'POST', headers: headers() })
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
    ws = createReconnectingStomp(`/topic/roulette/${clanId}`, (body) => {
      if (body === 'ROULETTE_UPDATED') fetchRound()
      else if (body === 'ROULETTE_CHAT') loadChat()
    })
  }
  tickTimer = window.setInterval(() => (nowMs.value = Date.now()), 250)
  heartbeat = window.setInterval(fetchRound, 8000)
  armAutoStart()
  if (bgmOn.value) startBgm()
})
onUnmounted(() => {
  if (ws) ws.disconnect()
  if (tickTimer) clearInterval(tickTimer)
  if (heartbeat) clearInterval(heartbeat)
  if (spinTimer) clearTimeout(spinTimer)
  if (celeTimer) clearTimeout(celeTimer)
  if (resultClearTimer) clearTimeout(resultClearTimer)
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  stopBgm()
  fetch(`${API}/roulette/leave`, { method: 'POST', headers: headers() }).catch(() => {})
})
</script>

<template>
  <div class="rl-shell">
    <div class="rl-page">
      <div v-if="loading" class="rl-loading">載入中…</div>

      <template v-else-if="state">
        <!-- 標頭 + 彩金池 -->
        <div class="rl-topbar">
          <h2 class="rl-title">
            🎡 輪盤賭桌
            <span class="rl-audioctrl">
              <button
                class="rl-mute-btn"
                :class="{ off: !soundOn }"
                :title="soundOn ? '關音效' : '開音效'"
                @click="toggleSound"
              >
                {{ soundOn ? '🔊' : '🔈' }}
              </button>
              <button
                class="rl-mute-btn"
                :class="{ off: !bgmOn }"
                :title="bgmOn ? '關背景音樂' : '開背景音樂'"
                @click="toggleBgm"
              >
                {{ bgmOn ? '🎵' : '🎶' }}
              </button>
              <input
                v-show="bgmOn"
                v-model.number="bgmVol"
                class="rl-vol"
                type="range"
                min="0"
                max="1"
                step="0.05"
                title="音樂音量"
              />
            </span>
          </h2>
          <div class="rl-pool">
            <span class="rl-pool-label">💰 彩金池</span>
            <span class="rl-pool-amt">{{ fmt(state.poolBalance) }} {{ state.currency }}</span>
          </div>
        </div>

        <!-- 在線名單 -->
        <div class="rl-room">
          <span class="rl-room-label">🟢 遊戲室（{{ state.online.length }}）</span>
          <span
            v-for="n in state.online"
            :key="n"
            class="rl-room-chip"
            :class="{ me: n === authStore.member?.userName }"
          >
            {{ n === authStore.member?.userName ? '你' : n }}
          </span>
          <span v-if="!state.online.length" class="rl-room-empty">目前只有你</span>
        </div>

        <!-- 莊家列 -->
        <div class="rl-banker-bar">
          <template v-if="hasBanker">
            <span class="rl-banker-info"
              >🏦 莊家 <b>{{ state.bankerName }}</b> · 本金 {{ fmt(state.bankroll) }} {{ state.currency }}</span
            >
            <button v-if="bankerIsMe" class="rl-btn rl-btn-leave" @click="leaveBank">下莊</button>
            <button v-else class="rl-btn rl-btn-take" @click="takeBank">搶莊</button>
          </template>
          <template v-else>
            <span class="rl-banker-info muted">目前沒有莊家</span>
            <button class="rl-btn rl-btn-take" @click="takeBank">我要坐莊</button>
          </template>
        </div>

        <!-- 階段 + 倒數 -->
        <div class="rl-phase" :class="{ betting: phase === 'betting' && !closing, spinning }">
          <span class="rl-phase-text">{{ phaseText }}</span>
          <div v-if="phase === 'betting' && !closing" class="rl-cd-bar">
            <div class="rl-cd-fill" :style="{ width: (countdown / 30) * 100 + '%' }"></div>
          </div>
        </div>

        <!-- 輪盤 -->
        <div class="rl-wheel-wrap">
          <svg class="rl-wheel" viewBox="0 0 300 300" role="img" aria-label="輪盤">
            <!-- 外框 -->
            <circle cx="150" cy="150" :r="R + 6" class="rl-rim" />
            <!-- 轉動的輪盤(37 格) -->
            <g
              class="rl-rot"
              :style="{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.16,0.7,0.12,1)' : 'none',
              }"
            >
              <g v-for="s in sectors" :key="s.n" :transform="`rotate(${s.rot} 150 150)`">
                <path :d="SECTOR_PATH" :fill="s.fill" stroke="#0b0b0b" stroke-width="0.6" />
                <text
                  x="150"
                  :y="150 - labelR"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="rl-num"
                >
                  {{ s.n }}
                </text>
              </g>
            </g>
            <!-- 逆向轉的球 -->
            <g
              class="rl-rot"
              :style="{
                transform: `rotate(${ballRotation}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.16,0.7,0.12,1)' : 'none',
              }"
            >
              <circle cx="150" :cy="150 - (R - 8)" r="6" class="rl-ball" />
            </g>
            <!-- 中心輪轂(固定,不轉) -->
            <circle cx="150" cy="150" r="34" class="rl-hub" />
            <circle cx="150" cy="150" r="22" class="rl-hub2" />
            <text
              v-if="resultPocketShown != null && !spinning"
              x="150"
              y="150"
              text-anchor="middle"
              dominant-baseline="central"
              class="rl-hub-num"
              :class="pocketColor(resultPocketShown)"
            >
              {{ resultPocketShown }}
            </text>
            <text v-else x="150" y="150" text-anchor="middle" dominant-baseline="central" class="rl-hub-idle">
              🎡
            </text>
          </svg>
          <!-- 頂端指針 -->
          <div class="rl-pointer"></div>
        </div>

        <div v-if="phase === 'result' && !spinning && resultPocketShown != null" class="rl-result-row">
          <span class="rl-result-num" :class="pocketColor(resultPocketShown)">{{ resultPocketShown }}</span>
          <span class="rl-result-tag" :class="pocketColor(resultPocketShown)">
            {{ resultColorZh(resultSnap?.color ?? pocketColor(resultPocketShown ?? 0)) }}
          </span>
        </div>

        <!-- 開獎紀錄(看路) -->
        <div v-if="recentRounds.length" class="rl-road">
          <span class="rl-road-label">開獎</span>
          <div class="rl-road-list">
            <span
              v-for="(r, i) in recentRounds"
              :key="i"
              class="rl-road-chip"
              :class="r.color"
              :title="String(r.pocket)"
            >
              {{ r.pocket }}
            </span>
          </div>
        </div>

        <!-- 本局下注 -->
        <div class="rl-bets-board">
          <template v-if="phase === 'waiting'">
            <div class="rl-bets-empty">🪑 桌面已清空 · 下第一注即開新局！</div>
          </template>
          <template v-else>
            <div class="rl-bets-head">
              {{ phase === 'result' ? '本局結果' : '本局下注' }}（{{ aggregatedBets.length }}）<span
                v-if="myBetsTotal > 0"
                class="rl-my-total"
                >· 我押 {{ fmt(myBetsTotal) }}</span
              >
            </div>
            <div v-if="!aggregatedBets.length" class="rl-bets-empty">還沒有人下注，下第一注即開局！</div>
            <div v-else class="rl-bets-list">
              <div
                v-for="b in aggregatedBets"
                :key="b.key"
                class="rl-bet-chip"
                :class="{ mine: b.mine, won: b.settled && b.win, lost: b.settled && !b.win }"
              >
                <span class="rl-bet-who">{{ b.mine ? '你' : b.userName }}</span>
                <span class="rl-bet-what">{{ betTypeLabel(b.betType) }}{{ betDetail(b) }}</span>
                <span class="rl-bet-amt">{{ fmt(b.amount) }}</span>
                <span v-if="b.settled" class="rl-bet-res">{{ b.win ? '+' + fmt(b.payout) : '✕' }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 號碼盤(直注) -->
        <div class="rl-numboard">
          <button
            class="rl-num-cell green zero"
            :class="{ active: betType === 'STRAIGHT' && straightPick === 0 }"
            @click="pickStraight(0)"
          >
            0
          </button>
          <div class="rl-num-grid">
            <template v-for="row in boardRows" :key="row[0]">
              <button
                v-for="n in row"
                :key="n"
                class="rl-num-cell"
                :class="[pocketColor(n), { active: betType === 'STRAIGHT' && straightPick === n }]"
                @click="pickStraight(n)"
              >
                {{ n }}
              </button>
            </template>
          </div>
        </div>

        <!-- 場外注 -->
        <div class="rl-outside">
          <div class="rl-out-row">
            <button
              class="rl-out-btn red"
              :class="{ active: betType === 'RED' }"
              @click="betType = 'RED'"
            >
              紅 <small>1:1</small>
            </button>
            <button
              class="rl-out-btn black"
              :class="{ active: betType === 'BLACK' }"
              @click="betType = 'BLACK'"
            >
              黑 <small>1:1</small>
            </button>
          </div>
          <div class="rl-out-row">
            <button class="rl-out-btn" :class="{ active: betType === 'ODD' }" @click="betType = 'ODD'">
              單 <small>1:1</small>
            </button>
            <button class="rl-out-btn" :class="{ active: betType === 'EVEN' }" @click="betType = 'EVEN'">
              雙 <small>1:1</small>
            </button>
          </div>
          <div class="rl-out-row">
            <button class="rl-out-btn" :class="{ active: betType === 'LOW' }" @click="betType = 'LOW'">
              小 1-18 <small>1:1</small>
            </button>
            <button class="rl-out-btn" :class="{ active: betType === 'HIGH' }" @click="betType = 'HIGH'">
              大 19-36 <small>1:1</small>
            </button>
          </div>
          <div class="rl-out-row three">
            <button
              v-for="p in 3"
              :key="'dz' + p"
              class="rl-out-btn"
              :class="{ active: betType === 'DOZEN' && dozenPick === p }"
              @click="((betType = 'DOZEN'), (dozenPick = p))"
            >
              {{ dozenLabel(p) }} <small>2:1</small>
            </button>
          </div>
          <div class="rl-out-row three">
            <button
              v-for="p in 3"
              :key="'col' + p"
              class="rl-out-btn"
              :class="{ active: betType === 'COLUMN' && columnPick === p }"
              @click="((betType = 'COLUMN'), (columnPick = p))"
            >
              第{{ p }}行 <small>2:1</small>
            </button>
          </div>
        </div>

        <div class="rl-selection">已選 <b>{{ selectionText }}</b></div>

        <!-- 倍率快選 -->
        <div class="rl-mult-row">
          <span class="rl-pick-label">快選</span>
          <div class="rl-mult-grid">
            <button
              v-for="m in betMultipliers"
              :key="m"
              class="rl-mult-btn"
              :class="{ active: effectiveBet === minBet * m }"
              @click="setMult(m)"
            >
              ×{{ m }}
            </button>
          </div>
        </div>

        <!-- 自訂金額 -->
        <div class="rl-amount-row">
          <span class="rl-pick-label">金額</span>
          <input
            v-model.number="betAmountInput"
            type="number"
            class="rl-amount-input"
            :class="{ bad: belowMin || overCap }"
            :min="minBet"
            step="1"
            placeholder="自訂下注金額"
          />
        </div>

        <div class="rl-bet-summary">
          本注 <b>{{ fmt(effectiveBet) }}</b> {{ state.currency }} · 餘額 {{ fmt(state.myBalance) }}
        </div>
        <div class="rl-cap-hint">
          最小 {{ fmt(minBet) }} · 本局每人上限 {{ fmt(config.maxBet) }}（你已下 {{ fmt(myBetsTotal) }}）· 此注可下
          <b :class="{ over: overCap }">{{ fmt(maxBetForCurrent) }}</b>
          · 莊家本局還可承受 {{ fmt(state.remainingCapacity) }} {{ state.currency }}
        </div>
        <button class="rl-bet-btn-main" :disabled="!canBet" @click="placeBet">
          {{ placing ? '下注中…' : closing ? '封盤中…' : revealLocked ? '開獎中…' : '🪙 下注' }}
        </button>
        <p v-if="!canBet && !placing" class="rl-ineligible">{{ cantBetReason() }}</p>

        <!-- 賺錢排行榜 -->
        <div v-if="leaderboard.length" class="rl-board">
          <h3>🏆 賺錢排行榜</h3>
          <div class="rl-rank-list">
            <div v-for="r in leaderboard" :key="r.rank" class="rl-rank-row" :class="{ me: r.me }">
              <span class="rl-rank-no">{{
                r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '#' + r.rank
              }}</span>
              <span class="rl-rank-name">{{ r.me ? '你' : r.userName }}</span>
              <span class="rl-rank-net" :class="r.net >= 0 ? 'up' : 'down'"
                >{{ r.net >= 0 ? '+' : '−' }}{{ fmt(Math.abs(r.net)) }}</span
              >
            </div>
          </div>
        </div>

        <!-- 賠率表 -->
        <div class="rl-paytable">
          <h3>賠率表</h3>
          <div class="rl-pt-grid">
            <div v-for="r in paytable" :key="r.type" class="rl-pt-row">
              <span class="rl-pt-label">{{ r.label }}</span>
              <span class="rl-pt-desc">{{ r.desc }}</span>
              <span class="rl-pt-mult">×{{ r.multiplier }}</span>
            </div>
          </div>
        </div>

        <!-- 公平性 -->
        <div v-if="phase === 'result' && state.serverSeed" class="rl-fair">
          <div>🔒 上局公平性 · nonce {{ state.nonce }}</div>
          <div>serverSeed: <code>{{ state.serverSeed }}</code></div>
        </div>
      </template>
    </div>
    <!-- /.rl-page -->

    <!-- 聊天室 -->
    <aside class="rl-chat" :class="{ open: chatOpen }">
      <div class="rl-chat-head">
        <span>💬 聊天室</span>
        <button class="rl-chat-x" @click="chatOpen = false" aria-label="關閉">✕</button>
      </div>
      <div ref="chatScroll" class="rl-chat-msgs">
        <div v-if="!chatMessages.length" class="rl-chat-empty">還沒有人說話，來開個話題吧～</div>
        <div
          v-for="(m, i) in chatMessages"
          :key="i"
          class="rl-chat-msg"
          :class="{ mine: m.userName === myName }"
        >
          <span class="rl-chat-who">{{ m.userName === myName ? '我' : m.userName }}</span>
          <span class="rl-chat-bubble">{{ m.text }}</span>
        </div>
      </div>
      <form class="rl-chat-form" @submit.prevent="sendChat">
        <input v-model="chatDraft" class="rl-chat-input" maxlength="100" placeholder="說點什麼…" />
        <button type="submit" class="rl-chat-send" :disabled="chatSending || !chatDraft.trim()">送</button>
      </form>
    </aside>

    <!-- 手機:浮動聊天鈕 -->
    <button class="rl-chat-fab" :class="{ active: chatOpen }" @click="chatOpen = !chatOpen" aria-label="聊天室">
      {{ chatOpen ? '✕' : '💬' }}
    </button>

    <!-- 中獎尊榮動畫 -->
    <transition name="rl-cele">
      <div
        v-if="celebration?.show"
        class="rl-cele-overlay"
        :class="celebration.tier"
        @click="closeCelebration"
      >
        <div v-if="celebration.tier !== 'lose'" class="rl-cele-rays"></div>
        <div class="rl-cele-card">
          <div class="rl-cele-emoji">{{ celebration.tier === 'win' ? '🎉' : '💸' }}</div>
          <div class="rl-cele-title">{{ celebration.title }}</div>
          <div class="rl-cele-amt">
            {{ celebration.tier === 'lose' ? '-' : '+' }}{{ fmt(celebration.amount) }} {{ state?.currency }}
          </div>
          <button
            class="rl-btn rl-cele-btn"
            :class="celebration.tier === 'lose' ? 'rl-btn-leave' : 'rl-btn-take'"
            @click.stop="closeCelebration"
          >
            {{ celebration.tier === 'lose' ? '知道了' : '收下！' }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.rl-shell {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: center;
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}
.rl-page {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 560px;
  padding: 16px;
  color: #e2e8f0;
}
.rl-loading {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}

/* === 標頭 === */
.rl-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rl-title {
  margin: 0;
  font-size: 1.4rem;
  color: var(--c-light);
}
.rl-audioctrl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
.rl-mute-btn {
  width: auto;
  margin: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
  vertical-align: middle;
  opacity: 0.85;
}
.rl-mute-btn.off {
  opacity: 0.45;
}
.rl-mute-btn:hover {
  opacity: 1;
}
.rl-vol {
  width: 60px;
  margin: 0;
  padding: 0;
  vertical-align: middle;
  accent-color: var(--c-light);
  cursor: pointer;
}
.rl-pool {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
}
.rl-pool-label {
  font-size: 0.72rem;
  color: #94a3b8;
}
.rl-pool-amt {
  font-size: 1.1rem;
  font-weight: 800;
  color: #fbbf24;
  font-variant-numeric: tabular-nums;
}

/* === 在線名單 === */
.rl-room {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.rl-room-label {
  font-size: 0.78rem;
  color: #4ade80;
  font-weight: 700;
}
.rl-room-chip {
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.78rem;
}
.rl-room-chip.me {
  background: rgba(var(--c-light-rgb), 0.18);
  border-color: var(--c-light);
  color: var(--c-light);
  font-weight: 700;
}
.rl-room-empty {
  font-size: 0.78rem;
  color: #64748b;
}

/* === 莊家列(手機保持精簡) === */
.rl-banker-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 0.85rem;
}
.rl-banker-info {
  flex: 1 1 auto;
  min-width: 0;
}
.rl-banker-info.muted {
  color: #94a3b8;
}
.rl-btn {
  width: auto;
  margin: 0;
  padding: 6px 14px;
  border-radius: 9px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.85rem;
}
.rl-btn-take {
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
}
.rl-btn-leave {
  background: #334155;
  color: #f1f5f9;
}
@media (max-width: 480px) {
  .rl-banker-bar .rl-btn {
    padding: 8px 13px;
    font-size: 0.85rem;
  }
}

/* === 階段 + 倒數 === */
.rl-phase {
  text-align: center;
  margin-bottom: 8px;
}
.rl-phase-text {
  font-weight: 800;
  color: #94a3b8;
}
.rl-phase.betting .rl-phase-text {
  color: var(--c-light);
}
.rl-phase.spinning .rl-phase-text {
  color: #fbbf24;
}
.rl-cd-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 6px;
}
.rl-cd-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-light), var(--c-deep));
  transition: width 0.25s linear;
}

/* === 輪盤 === */
.rl-wheel-wrap {
  position: relative;
  width: 100%;
  max-width: 320px;
  margin: 8px auto 12px;
}
.rl-wheel {
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.5));
}
.rl-rot {
  transform-box: view-box;
  transform-origin: 150px 150px;
}
.rl-rim {
  fill: none;
  stroke: var(--c-deep);
  stroke-width: 8;
  opacity: 0.9;
}
.rl-num {
  fill: #f8fafc;
  font-size: 9px;
  font-weight: 700;
  font-family: inherit;
}
.rl-ball {
  fill: #f8fafc;
  stroke: #cbd5e1;
  stroke-width: 0.6;
}
.rl-hub {
  fill: var(--c-deep);
  stroke: var(--c-light);
  stroke-width: 1.5;
}
.rl-hub2 {
  fill: rgba(0, 0, 0, 0.35);
}
.rl-hub-idle {
  font-size: 18px;
}
.rl-hub-num {
  font-size: 20px;
  font-weight: 900;
  fill: #f8fafc;
}
.rl-hub-num.red {
  fill: #fca5a5;
}
.rl-hub-num.black {
  fill: #e2e8f0;
}
.rl-hub-num.green {
  fill: #86efac;
}
.rl-pointer {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-top: 16px solid var(--c-light);
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5));
}

/* === 結果 === */
.rl-result-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.rl-result-num {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 900;
  color: #fff;
}
.rl-result-num.red {
  background: #c8102e;
}
.rl-result-num.black {
  background: #161616;
  border: 1px solid #3a3f5c;
}
.rl-result-num.green {
  background: #0f8a3c;
}
.rl-result-tag {
  padding: 3px 12px;
  border-radius: 999px;
  font-weight: 800;
}
.rl-result-tag.red {
  background: rgba(200, 16, 46, 0.2);
  color: #fca5a5;
}
.rl-result-tag.black {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
.rl-result-tag.green {
  background: rgba(15, 138, 60, 0.22);
  color: #86efac;
}

/* === 看路 === */
.rl-road {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.rl-road-label {
  flex-shrink: 0;
  font-size: 0.76rem;
  font-weight: 800;
  color: #94a3b8;
}
.rl-road-list {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.rl-road-chip {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 800;
  color: #fff;
}
.rl-road-chip.red {
  background: #c8102e;
}
.rl-road-chip.black {
  background: #161616;
  border: 1px solid #3a3f5c;
}
.rl-road-chip.green {
  background: #0f8a3c;
}

/* === 本局下注 === */
.rl-bets-board {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 14px;
}
.rl-bets-head {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 8px;
  font-weight: 700;
}
.rl-my-total {
  color: var(--c-light);
}
.rl-bets-empty {
  font-size: 0.82rem;
  color: #64748b;
  text-align: center;
  padding: 6px 0;
}
.rl-bets-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rl-bet-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.78rem;
}
.rl-bet-chip.mine {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
}
.rl-bet-chip.won {
  border-color: rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.14);
}
.rl-bet-chip.lost {
  opacity: 0.5;
}
.rl-bet-who {
  font-weight: 700;
  color: #cbd5e1;
  max-width: 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-bet-what {
  color: var(--c-light);
  font-weight: 700;
}
.rl-bet-amt {
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}
.rl-bet-res {
  font-weight: 800;
  color: #4ade80;
}
.rl-bet-chip.lost .rl-bet-res {
  color: #94a3b8;
}

/* === 號碼盤 === */
.rl-numboard {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.rl-num-grid {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 3px;
}
.rl-num-cell {
  width: auto;
  margin: 0;
  min-width: 0;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
  font-weight: 800;
  font-size: 0.76rem;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.rl-num-cell.zero {
  flex: 0 0 34px;
  height: auto;
  font-size: 0.95rem;
}
.rl-num-cell.red {
  background: #c8102e;
}
.rl-num-cell.black {
  background: #161616;
}
.rl-num-cell.green {
  background: #0f8a3c;
}
.rl-num-cell.active {
  box-shadow: 0 0 0 2px var(--c-light);
  transform: translateY(-1px);
}

/* === 場外注 === */
.rl-outside {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.rl-out-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  align-items: stretch;
}
.rl-out-row.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.rl-out-btn {
  width: auto;
  margin: 0;
  min-width: 0;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  border: 1px solid #2e3147;
  background: #0f111a;
  color: #cbd5e1;
  font-weight: 800;
  font-size: 0.86rem;
  cursor: pointer;
  transition: all 0.15s;
}
.rl-out-btn small {
  font-size: 0.62rem;
  opacity: 0.7;
  font-weight: 700;
}
.rl-out-btn.red {
  background: rgba(200, 16, 46, 0.14);
  border-color: rgba(200, 16, 46, 0.35);
  color: #fca5a5;
}
.rl-out-btn.black {
  background: rgba(22, 22, 22, 0.45);
  border-color: #2e3350;
  color: #cbd5e1;
}
.rl-out-btn.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}
/* 選中:實心亮底 + 光環,一眼看得出被選 */
.rl-out-btn.red.active {
  background: #c8102e;
  border-color: var(--c-light);
  color: #fff;
  box-shadow: 0 0 0 2px var(--c-light);
}
.rl-out-btn.black.active {
  background: #161616;
  border-color: var(--c-light);
  color: #fff;
  box-shadow: 0 0 0 2px var(--c-light);
}

.rl-selection {
  text-align: center;
  font-size: 0.9rem;
  color: #cbd5e1;
  margin-bottom: 10px;
}
.rl-selection b {
  color: var(--c-light);
}

/* === 倍率快選 === */
.rl-mult-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.rl-pick-label {
  font-size: 0.8rem;
  color: #94a3b8;
  width: 36px;
  flex-shrink: 0;
}
.rl-mult-grid {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(46px, 1fr));
  gap: 6px;
}
.rl-mult-btn {
  width: auto;
  margin: 0;
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
.rl-mult-btn.active {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
}

/* === 自訂金額 === */
.rl-amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.rl-amount-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  margin: 0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 9px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
}
.rl-amount-input:focus {
  outline: none;
  border-color: var(--c-light);
}
.rl-amount-input.bad {
  border-color: #f87171;
}

.rl-bet-summary {
  text-align: center;
  font-size: 0.9rem;
  margin-bottom: 4px;
  color: #cbd5e1;
}
.rl-cap-hint {
  text-align: center;
  font-size: 0.76rem;
  color: #64748b;
  margin-bottom: 10px;
}
.rl-cap-hint b {
  color: #94a3b8;
}
.rl-cap-hint b.over {
  color: #f87171;
}
.rl-bet-btn-main {
  width: 100%;
  margin: 0;
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
.rl-bet-btn-main:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rl-bet-btn-main:not(:disabled):hover {
  filter: brightness(1.08);
}
.rl-ineligible {
  text-align: center;
  color: #f59e0b;
  font-size: 0.8rem;
  margin-top: 8px;
}

/* === 排行榜 === */
.rl-board {
  margin-top: 18px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.rl-board h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: var(--c-light);
}
.rl-rank-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rl-rank-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 8px;
  font-size: 0.84rem;
}
.rl-rank-row.me {
  background: rgba(var(--c-light-rgb), 0.12);
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
}
.rl-rank-no {
  text-align: center;
}
.rl-rank-name {
  color: #e2e8f0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-rank-net {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rl-rank-net.up {
  color: #4ade80;
}
.rl-rank-net.down {
  color: #f87171;
}

/* === 賠率表 === */
.rl-paytable {
  margin-top: 20px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}
.rl-paytable h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: var(--c-light);
}
.rl-pt-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rl-pt-row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 10px;
  align-items: center;
  font-size: 0.82rem;
  padding: 3px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
}
.rl-pt-label {
  color: #e2e8f0;
  font-weight: 700;
}
.rl-pt-desc {
  color: #64748b;
  font-size: 0.74rem;
}
.rl-pt-mult {
  color: #fbbf24;
  font-weight: 700;
}

.rl-fair {
  margin-top: 12px;
  font-size: 0.7rem;
  color: #64748b;
  word-break: break-all;
  line-height: 1.5;
}
.rl-fair code {
  color: #94a3b8;
}

/* === 聊天室 === */
.rl-chat {
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
.rl-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-weight: 800;
  font-size: 0.9rem;
  color: var(--c-light);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.rl-chat-x {
  width: auto;
  margin: 0;
  display: none;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
}
.rl-chat-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
}
.rl-chat-empty {
  color: #64748b;
  font-size: 0.8rem;
  text-align: center;
  margin: auto 0;
}
.rl-chat-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 90%;
}
.rl-chat-msg.mine {
  align-self: flex-end;
  align-items: flex-end;
}
.rl-chat-who {
  font-size: 0.66rem;
  color: #94a3b8;
  margin: 0 4px 1px;
}
.rl-chat-bubble {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 5px 10px;
  font-size: 0.85rem;
  color: #e2e8f0;
  word-break: break-word;
  line-height: 1.4;
}
.rl-chat-msg.mine .rl-chat-bubble {
  background: rgba(var(--c-light-rgb), 0.18);
  border-color: rgba(var(--c-light-rgb), 0.4);
  color: var(--c-light);
}
.rl-chat-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.rl-chat-input {
  flex: 1 1 0;
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
}
.rl-chat-input:focus {
  outline: none;
  border-color: var(--c-light);
}
.rl-chat-send {
  flex: 0 0 56px;
  width: 56px;
  height: 40px;
  align-self: center;
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
}
.rl-chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rl-chat-fab {
  display: none;
}

@media (max-width: 880px) {
  .rl-shell {
    display: block;
    max-width: 560px;
  }
  .rl-page {
    max-width: none;
  }
  .rl-chat {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    height: 62vh;
    max-height: none;
    flex: none;
    background: #131722;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: none;
    border-radius: 16px 16px 0 0;
    transform: translateY(105%);
    transition: transform 0.3s ease;
    z-index: 1500;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6);
  }
  .rl-chat.open {
    transform: translateY(0);
  }
  .rl-chat-x {
    display: inline-flex;
  }
  .rl-chat-fab {
    width: 52px;
    height: 52px;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    right: 16px;
    bottom: 16px;
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

/* === 中獎尊榮動畫 === */
.rl-cele-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  overflow: hidden;
}
.rl-cele-overlay.win {
  background: radial-gradient(circle at center, rgba(16, 64, 40, 0.92), rgba(5, 10, 16, 0.95));
}
.rl-cele-overlay.lose {
  background: rgba(8, 10, 14, 0.85);
}
.rl-cele-overlay.lose .rl-cele-card {
  border: 1px solid #3a3f5c;
  box-shadow: none;
}
.rl-cele-overlay.lose .rl-cele-title {
  color: #94a3b8;
}
.rl-cele-overlay.lose .rl-cele-amt {
  color: #cbd5e1;
}
.rl-cele-overlay.lose .rl-cele-emoji {
  animation: rl-lose-sink 0.6s ease-out;
}
@keyframes rl-lose-sink {
  0% {
    transform: translateY(-10px) scale(1.1);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
.rl-cele-rays {
  position: absolute;
  width: 200vmax;
  height: 200vmax;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.07) 0deg 6deg,
    transparent 6deg 12deg
  );
  animation: rl-rays-spin 9s linear infinite;
}
@keyframes rl-rays-spin {
  to {
    transform: rotate(360deg);
  }
}
.rl-cele-card {
  position: relative;
  text-align: center;
  padding: 30px 34px;
  border-radius: 22px;
  background: linear-gradient(160deg, #1e1e2e, #0f0f1a);
  animation: rl-cele-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.rl-cele-overlay.win .rl-cele-card {
  border: 2px solid #4ade80;
  box-shadow: 0 0 40px rgba(34, 197, 94, 0.45);
}
@keyframes rl-cele-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.rl-cele-emoji {
  font-size: 3.2rem;
  animation: rl-cele-bounce 0.9s ease-in-out infinite;
}
@keyframes rl-cele-bounce {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-8px) scale(1.08);
  }
}
.rl-cele-title {
  font-size: 1.5rem;
  font-weight: 900;
  margin: 10px 0 4px;
}
.rl-cele-overlay.win .rl-cele-title {
  color: #4ade80;
}
.rl-cele-amt {
  font-size: 2.2rem;
  font-weight: 900;
  color: #fff;
  font-variant-numeric: tabular-nums;
  margin-bottom: 18px;
}
.rl-cele-btn {
  width: auto;
  padding: 10px 28px;
  font-size: 1rem;
}
.rl-cele-enter-active {
  transition: opacity 0.3s ease;
}
.rl-cele-leave-active {
  transition: opacity 0.4s ease;
}
.rl-cele-enter-from,
.rl-cele-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rl-cele-rays,
  .rl-cele-emoji {
    animation: none;
  }
}

@media (max-width: 480px) {
  .rl-num-cell {
    height: 26px;
    font-size: 0.68rem;
  }
  .rl-out-btn {
    height: 40px;
    font-size: 0.8rem;
  }
}
</style>
