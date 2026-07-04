<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import logoUrl from '@/assets/share_diamond_logo.png'

// 刮塗層要用的 LOGO(預先載入,setupScratch 時畫上去)
const logoImg = new Image()
let logoReady = false
logoImg.onload = () => { logoReady = true }
logoImg.src = logoUrl

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return { Authorization: `Bearer ${authStore.authToken}`, 'Content-Type': 'application/json', Sign: generateSignature(ts), TimeStamp: ts }
}
const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

interface Prize { mult: number; perTenThousand: number }
interface Tier { price: number; prizes: Prize[]; poolHitBps: number; poolSharePct: number; minBankroll: number; available: boolean }
interface State {
  enabled: boolean; currency: string; poolBalance: number; myBalance: number
  bankerName: string | null; bankerIsMe: boolean; bankroll: number; tiers: Tier[]
}
interface BuyResult {
  ticketId: number; price: number; prizeMult: number; prize: number; poolWin: number
  win: boolean; myBalance: number; poolBalance: number; serverSeedHash: string; nonce: number
}

const loading = ref(true)
const state = ref<State | null>(null)
const busy = ref(false)

// ---- 流程: choose(選價位) → pick(挑一張) → scratch(刮開) ----
type Phase = 'choose' | 'pick' | 'scratch'
const phase = ref<Phase>('choose')
const selectedTier = ref<Tier | null>(null)
const PICK_COUNT = 5
const pickedIndex = ref<number>(-1)
const result = ref<BuyResult | null>(null)

const hasBanker = computed(() => !!state.value?.bankerName)
const bankerIsMe = computed(() => !!state.value?.bankerIsMe)

// ---- API ----
async function fetchState() {
  try {
    const res = await fetch(`${API}/scratch/config`, { headers: headers() })
    if (!res.ok) return
    state.value = await res.json()
  } catch (e) { console.error(e) }
}

function chooseTier(t: Tier) {
  if (!hasBanker.value) { useAlert.error('目前沒有莊家，等有人坐莊才能買票'); return }
  if (bankerIsMe.value) { useAlert.error('你是莊家，不能買自己的票'); return }
  if (!t.available) { useAlert.error(`莊家本金不足以開這個價位（需 ≥ ${fmt(t.minBankroll)}）`); return }
  selectedTier.value = t
  pickedIndex.value = -1
  result.value = null
  phase.value = 'pick'
}

async function pickTicket(i: number) {
  if (busy.value || pickedIndex.value >= 0 || !selectedTier.value) return
  const price = selectedTier.value.price
  if (Number(state.value?.myBalance ?? 0) < price) { useAlert.error('餘額不足'); return }
  busy.value = true
  pickedIndex.value = i
  ensureAudio(); playPick()
  try {
    const res = await fetch(`${API}/scratch/buy`, { method: 'POST', headers: headers(), body: JSON.stringify({ price }) })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '購買失敗'); pickedIndex.value = -1; return }
    result.value = d
    if (state.value) { state.value.myBalance = d.myBalance; state.value.poolBalance = d.poolBalance }
    buildBoard()               // 依價位生成該玩法的牌面(在 nextTick 前,讓格子先渲染好再量 canvas)
    phase.value = 'scratch'
    revealed.value = false
    await nextTick(); setupScratch()
    loadBoards()
  } catch (e) { console.error(e); useAlert.error('連線失敗，已為你刷新餘額，請確認是否已扣款再重買'); await fetchState(); pickedIndex.value = -1 } finally { busy.value = false }
}

function again() { // 再刮一張(同價位)
  if (!selectedTier.value) { phase.value = 'choose'; return }
  pickedIndex.value = -1
  result.value = null
  phase.value = 'pick'
  fetchState()
}
function backToChoose() { phase.value = 'choose'; selectedTier.value = null; result.value = null; pickedIndex.value = -1; fetchState() }

// ---- 每個價位不同玩法(牌面依「後端已決定的結果」生成,機率完全不變,只是呈現方式不同) ----
// 1000 幸運對獎 / 5000 對對碰 / 10000 三連金 / 100000 翻倍星
type BoardType = 'lucky' | 'match3' | 'triple' | 'multi'
interface BCell { big: string; small?: string; hit: boolean }
interface Board { type: BoardType; title: string; rule: string; lucky: string[]; cells: BCell[] }
const board = ref<Board | null>(null)

function mkRnd(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff } }
function pick<T>(arr: T[], rnd: () => number): T { return arr[Math.floor(rnd() * arr.length)] as T }
function shuffle<T>(a: T[], rnd: () => number) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T] } return a }

function tierGame(price: number): string {
  return price === 5000 ? '🎯 對對碰' : price === 10000 ? '💰 三連金' : price === 100000 ? '⭐ 翻倍星' : '🍀 幸運對獎'
}

function buildBoard() {
  const r = result.value; if (!r) { board.value = null; return }
  const price = Number(selectedTier.value?.price ?? 1000)
  const rnd = mkRnd((Number(r.nonce) >>> 0) ^ price ^ r.ticketId)
  board.value = price === 5000 ? genMatch3(r, rnd)
    : price === 10000 ? genTriple(r, rnd)
    : price === 100000 ? genMulti(r, rnd)
    : genLucky(r, rnd)
}

function genLucky(r: BuyResult, rnd: () => number): Board {
  const used = new Set<number>()
  const rn = () => { let n = 0; do { n = 2 + Math.floor(rnd() * 98) } while (used.has(n)); used.add(n); return n }
  const lucky: number[] = [rn(), rn(), rn()]
  const decoy = [1, 2, 5, 10, 20]
  const win = r.prizeMult > 0
  const winIdx = win ? Math.floor(rnd() * 6) : -1
  const cells: BCell[] = []
  for (let i = 0; i < 6; i++) {
    if (i === winIdx) cells.push({ big: String(pick(lucky, rnd)), small: '×' + r.prizeMult, hit: true })
    else cells.push({ big: String(rn()), small: '×' + pick(decoy, rnd), hit: false }) // rn() 排除幸運號→不會誤中
  }
  return { type: 'lucky', title: '🍀 幸運對獎', rule: '號碼區出現你的幸運號 → 中該格的獎', lucky: lucky.map(String), cells }
}

function genMatch3(r: BuyResult, rnd: () => number): Board {
  const syms = ['🍒', '🔔', '⭐', '💎', '🍋', '🐮']
  let arr: string[]
  if (r.prizeMult > 0) {
    const w = pick(syms, rnd)
    const fillers = shuffle(syms.filter((s) => s !== w).flatMap((s) => [s, s]), rnd).slice(0, 6)
    arr = shuffle([w, w, w, ...fillers], rnd)
  } else {
    arr = shuffle(syms.flatMap((s) => [s, s]), rnd).slice(0, 9) // 每符號最多 2 個→不會三連
  }
  const cnt: Record<string, number> = {}; arr.forEach((s) => (cnt[s] = (cnt[s] || 0) + 1))
  const winSym = Object.keys(cnt).find((s) => (cnt[s] ?? 0) >= 3)
  return { type: 'match3', title: '🎯 對對碰', rule: '刮出 3 個一樣的符號就中獎',
    lucky: [], cells: arr.map((s) => ({ big: s, hit: !!winSym && s === winSym })) }
}

function genTriple(r: BuyResult, rnd: () => number): Board {
  let vals: number[]
  if (r.prizeMult > 0) vals = [r.prizeMult, r.prizeMult, r.prizeMult]
  else { const o = [1, 2, 5, 10, 20]; vals = [pick(o, rnd), pick(o, rnd), pick(o, rnd)]; if (vals[0] === vals[1] && vals[1] === vals[2]) vals[2] = vals[2] === 20 ? 10 : 20 }
  const win = vals[0] === vals[1] && vals[1] === vals[2]
  return { type: 'triple', title: '💰 三連金', rule: '三格相同 → 中該倍數', lucky: [], cells: vals.map((v) => ({ big: '×' + v, hit: win })) }
}

function genMulti(r: BuyResult, rnd: () => number): Board {
  const o = [0, 1, 2, 5, 10, 20]
  const star = Math.floor(rnd() * 6)
  const cells: BCell[] = []
  for (let i = 0; i < 6; i++) cells.push({ big: '×' + (i === star ? r.prizeMult : pick(o, rnd)), small: i === star ? '⭐你的' : '', hit: i === star && r.prizeMult > 0 })
  return { type: 'multi', title: '⭐ 翻倍星', rule: '刮開 ⭐ 格,就是你的倍數', lucky: [], cells }
}

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.poolWin > 0) return `🀄 中彩金池 +${fmt(r.poolWin)}${r.prize > 0 ? `（另中 ×${r.prizeMult} +${fmt(r.prize)}）` : ''}`
  if (r.prizeMult > 0) return `🎉 中 ×${r.prizeMult} = ${fmt(r.prize)} ${state.value?.currency ?? ''}`
  return '銘謝惠顧，再接再厲'
})

// ---- 刮開 canvas ----
const canvasRef = ref<HTMLCanvasElement | null>(null)
const revealed = ref(false)
let scratching = false
function setupScratch() {
  const cv = canvasRef.value; if (!cv) return
  const ctx = cv.getContext('2d'); if (!ctx) return
  const rect = cv.getBoundingClientRect()
  cv.width = Math.max(1, Math.floor(rect.width))
  cv.height = Math.max(1, Math.floor(rect.height))
  ctx.globalCompositeOperation = 'source-over'
  // 金屬銀底
  const g = ctx.createLinearGradient(0, 0, cv.width, cv.height)
  g.addColorStop(0, '#9aa4b4'); g.addColorStop(0.45, '#d5dbe6'); g.addColorStop(0.55, '#c2c9d6'); g.addColorStop(1, '#8b95a6')
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height)
  // 斜向亮條紋(金屬感)
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 6
  for (let x = -cv.height; x < cv.width; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + cv.height, cv.height); ctx.stroke() }
  // 中央 LOGO 浮水印
  if (logoReady && logoImg.width) {
    const lw = Math.min(cv.width * 0.46, 150); const lh = lw * (logoImg.height / logoImg.width)
    ctx.globalAlpha = 0.18; ctx.drawImage(logoImg, (cv.width - lw) / 2, (cv.height - lh) / 2 - 8, lw, lh); ctx.globalAlpha = 1
  }
  ctx.fillStyle = 'rgba(30,41,59,.6)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('✦ 刮開這裡 ✦', cv.width / 2, cv.height - 12)
}
function posOf(e: PointerEvent) {
  const cv = canvasRef.value!; const r = cv.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function scratchAt(x: number, y: number) {
  const cv = canvasRef.value; if (!cv || revealed.value) return
  const ctx = cv.getContext('2d'); if (!ctx) return
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill()
}
// setPointerCapture:即使手指/滑鼠移出卡片外,pointermove/up 仍持續送到 canvas,不會中斷刮除
function onDown(e: PointerEvent) { try { canvasRef.value?.setPointerCapture(e.pointerId) } catch { /* ignore */ } scratching = true; const p = posOf(e); scratchAt(p.x, p.y) }
function onMove(e: PointerEvent) { if (!scratching) return; const p = posOf(e); scratchAt(p.x, p.y) }
function onUp() { if (!scratching) return; scratching = false; checkReveal() }
function checkReveal() {
  const cv = canvasRef.value; if (!cv || revealed.value) return
  const ctx = cv.getContext('2d'); if (!ctx) return
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data
  let cleared = 0, total = 0
  for (let i = 3; i < data.length; i += 4 * 30) { total++; if (data[i] === 0) cleared++ }
  if (total > 0 && cleared / total > 0.5) revealFull()
}
function revealFull() {
  if (revealed.value) return
  revealed.value = true
  const cv = canvasRef.value
  if (cv) { const ctx = cv.getContext('2d'); if (ctx) ctx.clearRect(0, 0, cv.width, cv.height) }
  const r = result.value
  if (r?.poolWin) { celebrate.value = `🀄 刮中彩金池 +${fmt(r.poolWin)}！`; playJackpot(); armCele() }
  else if (r?.win) playWin()
  else playLose()
}

// ---- 莊家 ----
async function takeBank() {
  const challenge = hasBanker.value
  const hint = challenge ? `本金必須大於現任莊家 ${fmt(state.value?.bankroll)}` : '輸入坐莊本金（本金 ≥ 想賣價位×20 才賣得起該價位）'
  const v = await useAlert.inputDialog(hint, challenge ? '搶莊' : '我要坐莊')
  const amount = Number(v); if (!amount || amount <= 0) return
  try {
    const res = await fetch(`${API}/scratch/bank/take`, { method: 'POST', headers: headers(), body: JSON.stringify({ amount }) })
    const d = await res.json(); if (!res.ok) return useAlert.error(d.message ?? '坐莊失敗')
    useAlert.success(d.message); await fetchState()
  } catch (e) { console.error(e); useAlert.error('連線失敗') }
}
async function leaveBank() {
  const ok = await useAlert.confirm('確定要下莊？剩餘本金會退回錢包'); if (!ok?.isConfirmed) return
  try {
    const res = await fetch(`${API}/scratch/bank/leave`, { method: 'POST', headers: headers() })
    const d = await res.json(); if (!res.ok) return useAlert.error(d.message ?? '下莊失敗')
    useAlert.success(d.message); await fetchState()
  } catch (e) { console.error(e); useAlert.error('連線失敗') }
}

// ---- 排行榜 ----
interface RankRow { rank: number; userName: string; net: number; spins: number; me: boolean }
const boardsOpen = ref(false)
const leaderboard = ref<RankRow[]>([])
async function loadBoards() {
  try { const res = await fetch(`${API}/scratch/leaderboard?limit=10`, { headers: headers() }); if (res.ok) leaderboard.value = await res.json() } catch (e) { console.error(e) }
}

// ---- 慶祝 + 音效 ----
const celebrate = ref('')
let celeTimer: number | undefined
function armCele() { if (celeTimer) clearTimeout(celeTimer); celeTimer = window.setTimeout(() => (celebrate.value = ''), 4500) }
const sfxOn = ref(localStorage.getItem('scr_sfx') !== 'off')
let ctx: AudioContext | null = null
function ensureAudio() { try { if (!ctx) { const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx = new C() } if (ctx.state === 'suspended') void ctx.resume() } catch { /* ignore */ } }
function tone(f: number, dur: number, g: number, type: OscillatorType, at = 0) { const c = ctx; if (!c || !sfxOn.value) return; const t = c.currentTime + at; const o = c.createOscillator(); o.type = type; o.frequency.value = f; const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(gg); gg.connect(c.destination); o.start(t); o.stop(t + dur) }
function playPick() { tone(880, 0.08, 0.12, 'triangle') }
function playWin() {[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.26, 0.16, 'triangle', i * 0.1)) }
function playLose() {[330, 262, 196].forEach((f, i) => tone(f, 0.28, 0.1, 'sine', i * 0.12)) }
function playJackpot() {[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 0.18, 'sawtooth', i * 0.11)) }
function toggleSfx() { sfxOn.value = !sfxOn.value; localStorage.setItem('scr_sfx', sfxOn.value ? 'on' : 'off'); if (sfxOn.value) playPick() }

let poll: number | undefined
onMounted(async () => {
  loading.value = true
  await fetchState(); loadBoards(); loading.value = false
  poll = window.setInterval(() => { if (phase.value !== 'scratch' && !busy.value) fetchState() }, 6000) // 刮到一半/買票中不刷,免打斷或洗掉買後餘額
})
onUnmounted(() => { if (poll) clearInterval(poll); if (celeTimer) clearTimeout(celeTimer); if (ctx) { ctx.close().catch(() => {}); ctx = null } })
</script>

<template>
  <div class="scr-page">
    <transition name="scr-fade">
      <div v-if="celebrate" class="scr-celebrate" @click="celebrate = ''">
        <div class="scr-cele-emoji">🀄</div>
        <div class="scr-cele-text">{{ celebrate }}</div>
      </div>
    </transition>

    <div class="scr-head">
      <div class="scr-title">🎫 刮刮樂 <span class="scr-sub">莊家開賣 · 刮出手氣</span>
        <button class="scr-audio" :class="{ off: !sfxOn }" @click="toggleSfx" :title="sfxOn ? '關音效' : '開音效'">{{ sfxOn ? '🔊' : '🔈' }}</button>
      </div>
      <div class="scr-stats">
        <div class="scr-stat"><span>彩金池</span><b>{{ state?.currency }} {{ fmt(state?.poolBalance) }}</b></div>
        <div class="scr-stat"><span>我的餘額</span><b>{{ state?.currency }} {{ fmt(state?.myBalance) }}</b></div>
      </div>
    </div>

    <div v-if="loading" class="scr-empty">載入中…</div>
    <div v-else-if="!state?.enabled" class="scr-empty">🚫 本血盟尚未開放刮刮樂<br /><small>請管理員到「設置」開啟</small></div>

    <template v-else>
      <!-- 莊家列 -->
      <div class="scr-banker">
        <template v-if="hasBanker">
          <span class="scr-banker-info">👑 莊家 <b>{{ state?.bankerName }}</b> · 本金 {{ fmt(state?.bankroll) }} {{ state?.currency }}</span>
          <button v-if="bankerIsMe" class="scr-btn leave" @click="leaveBank">下莊</button>
          <button v-else class="scr-btn take" @click="takeBank">搶莊</button>
        </template>
        <template v-else>
          <span class="scr-banker-info muted">目前沒有莊家，坐莊才能開賣</span>
          <button class="scr-btn take" @click="takeBank">我要坐莊</button>
        </template>
      </div>

      <!-- 選價位 -->
      <div v-if="phase === 'choose'" class="scr-tiers">
        <div class="scr-section-title">選擇彩票價位</div>
        <p v-if="bankerIsMe" class="scr-hint">👑 你是莊家，不能買自己的票（要玩請先下莊）</p>
        <div class="scr-tier-grid">
          <div
            v-for="t in (state?.tiers ?? [])"
            :key="t.price"
            class="scr-tier"
            :class="{ off: !t.available || bankerIsMe }"
            @click="chooseTier(t)"
          >
            <div class="scr-tier-game">{{ tierGame(t.price) }}</div>
            <div class="scr-tier-price">${{ fmt(t.price) }}</div>
            <div class="scr-tier-top">頂獎 ×20 = {{ fmt(t.price * 20) }}</div>
            <div class="scr-tier-pool">🀄 中池拿 {{ t.poolSharePct }}%</div>
            <div v-if="!t.available && !bankerIsMe" class="scr-tier-lock">莊家本金不足<br />(需 ≥ {{ fmt(t.minBankroll) }})</div>
          </div>
        </div>
        <p v-if="!hasBanker" class="scr-hint">等有人坐莊後才能買票</p>
      </div>

      <!-- 挑一張 -->
      <div v-else-if="phase === 'pick'" class="scr-pick">
        <div class="scr-section-title">
          <button class="scr-back" @click="backToChoose">‹ 換價位</button>
          {{ tierGame(selectedTier?.price ?? 0) }} · ${{ fmt(selectedTier?.price) }} · 挑一張你的幸運票 🍀
        </div>
        <div class="scr-pick-grid">
          <button
            v-for="i in PICK_COUNT"
            :key="i"
            class="scr-ticket"
            :class="{ picked: pickedIndex === i - 1, dim: pickedIndex >= 0 && pickedIndex !== i - 1 }"
            :disabled="busy || pickedIndex >= 0"
            @click="pickTicket(i - 1)"
          >
            <span class="scr-ticket-shine"></span>
            <img class="scr-ticket-logo" :src="logoUrl" alt="" />
            <span class="scr-ticket-brand">SHARE DIAMOND</span>
            <span class="scr-ticket-mid">
              <span class="scr-ticket-star">✦</span>
              <span class="scr-ticket-no">{{ i }}</span>
              <span class="scr-ticket-star">✦</span>
            </span>
            <span class="scr-ticket-price">${{ fmt(selectedTier?.price) }}</span>
            <span class="scr-ticket-foot">刮刮樂 · LOTTO</span>
          </button>
        </div>
        <p class="scr-hint">賠率都一樣,挑哪張都行 — 只是個儀式感 ✨</p>
      </div>

      <!-- 刮開 -->
      <div v-else-if="phase === 'scratch'" class="scr-scratch">
        <div class="scr-section-title">{{ board?.title ?? '刮刮樂' }} · ${{ fmt(selectedTier?.price) }}</div>

        <!-- 玩法說明 + 幸運號(永遠可見,不用刮) -->
        <div class="scr-board-head">
          <div v-if="board?.lucky.length" class="scr-lucky">
            <span class="scr-lucky-label">幸運號</span>
            <b v-for="(n, i) in board.lucky" :key="i" class="scr-lucky-num">{{ n }}</b>
          </div>
          <div class="scr-rule">{{ board?.rule }}</div>
        </div>

        <div class="scr-card">
          <div class="scr-card-face" :class="[board?.type, { win: revealed && result?.win, pool: revealed && (result?.poolWin ?? 0) > 0 }]">
            <img class="scr-face-logo" :src="logoUrl" alt="" />
            <div class="scr-grid" :class="board?.type">
              <div v-for="(c, i) in (board?.cells ?? [])" :key="i" class="scr-cell" :class="{ hit: revealed && c.hit }">
                <span class="scr-cell-big">{{ c.big }}</span>
                <span v-if="c.small" class="scr-cell-small">{{ c.small }}</span>
              </div>
            </div>
          </div>
          <canvas
            v-show="!revealed"
            ref="canvasRef"
            class="scr-canvas"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          ></canvas>
        </div>

        <div class="scr-result-text" :class="{ win: revealed && result?.win, pool: revealed && (result?.poolWin ?? 0) > 0 }">
          {{ revealed ? resultText : '刮開上面的塗層看看中了沒 👆' }}
        </div>

        <div class="scr-scratch-acts">
          <button v-if="!revealed" class="scr-btn ghost" @click="revealFull">👀 直接開</button>
          <template v-else>
            <button class="scr-btn take" :disabled="busy" @click="again">🎫 再刮一張（${{ fmt(selectedTier?.price) }}）</button>
            <button class="scr-btn ghost" @click="backToChoose">換價位</button>
          </template>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="scr-panel">
        <button class="scr-panel-toggle" @click="boardsOpen = !boardsOpen">🏆 賺錢排行榜 <span>{{ boardsOpen ? '▲' : '▼' }}</span></button>
        <div v-if="boardsOpen" class="scr-panel-body">
          <div v-if="leaderboard.length === 0" class="scr-board-empty">尚無戰績</div>
          <div v-for="r in leaderboard" :key="r.rank" class="scr-rank-row" :class="{ me: r.me }">
            <span class="rk">{{ r.rank }}</span><span class="nm">{{ r.userName }}</span><span class="games">{{ r.spins }} 張</span>
            <span class="net" :class="{ pos: r.net > 0, neg: r.net < 0 }">{{ r.net > 0 ? '+' : '' }}{{ fmt(r.net) }}</span>
          </div>
        </div>
      </div>

      <details class="scr-rules">
        <summary>📜 玩法 / 賠率</summary>
        <p>四種價位（1千/5千/1萬/10萬），貴的返還率更好。每張抽 <b>1%</b> 進彩金池（不管輸贏）。莊家付固定獎、彩金池獎由池付。</p>
        <p>固定獎：回本 ×1、×2、×5、×10、頂獎 <b>×20</b>；刮到 🀄 <b>中彩金池</b>（拿當下池餘的比例，10萬票整池）。莊家本金要 ≥ 票價×20 才賣得起該價位。</p>
      </details>
    </template>
  </div>
</template>

<style scoped>
.scr-page { max-width: 640px; margin: 0 auto; padding: 12px; color: #e5e7eb; display: flex; flex-direction: column; gap: 12px; }
.scr-head { display: flex; flex-direction: column; gap: 8px; }
.scr-title { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
.scr-sub { font-size: 12px; font-weight: 400; color: #94a3b8; }
.scr-audio { margin-left: auto; background: rgba(var(--c-light-rgb), .12); border: 1px solid rgba(var(--c-light-rgb), .3); border-radius: 8px; width: 34px; height: 30px; cursor: pointer; font-size: 15px; }
.scr-audio.off { opacity: .6; }
.scr-stats { display: flex; gap: 8px; }
.scr-stat { flex: 1 1 0; background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 8px 12px; }
.scr-stat span { display: block; font-size: 11px; color: #94a3b8; }
.scr-stat b { font-size: 16px; color: var(--c-light); }
.scr-empty { text-align: center; color: #94a3b8; padding: 40px 12px; background: #131722; border-radius: 12px; line-height: 1.8; }
.scr-banker { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; font-size: 0.85rem; }
.scr-banker-info { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scr-banker-info b { color: var(--c-light); }
.scr-banker-info.muted { color: #94a3b8; }
.scr-btn { flex-shrink: 0; border: none; border-radius: 10px; padding: 9px 18px; font-weight: 700; cursor: pointer; font-size: 0.9rem; line-height: 1; transition: filter .15s; }
.scr-btn:hover:not(:disabled) { filter: brightness(1.08); }
.scr-btn:disabled { opacity: .5; cursor: not-allowed; }
.scr-btn.take { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); }
.scr-btn.leave { background: #334155; color: #f1f5f9; }
.scr-btn.ghost { background: rgba(255,255,255,.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,.12); }
.scr-section-title { font-size: 15px; font-weight: 800; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }
.scr-back { background: none; border: none; color: var(--c-light); cursor: pointer; font-size: 14px; font-weight: 700; padding: 0; }
.scr-hint { color: #f59e0b; font-size: 0.82rem; text-align: center; }
/* 價位 */
.scr-tiers { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.scr-tier-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.scr-tier { box-sizing: border-box; min-width: 0; position: relative; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; padding: 14px; border-radius: 12px; border: 1px solid rgba(var(--c-light-rgb),.35); background: rgba(var(--c-light-rgb),.06); color: inherit; cursor: pointer; transition: all .15s; }
.scr-tier:hover:not(.off) { border-color: var(--c-light); background: rgba(var(--c-light-rgb),.12); }
.scr-tier.off { opacity: .55; cursor: not-allowed; border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.03); }
.scr-tier-game { font-size: 0.72rem; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); padding: 2px 9px; border-radius: 999px; }
.scr-tier-price { font-size: 1.3rem; font-weight: 900; color: var(--c-light); }
.scr-tier-top { font-size: 0.78rem; color: #cbd5e1; }
.scr-tier-pool { font-size: 0.78rem; color: #fbbf24; }
.scr-tier-lock { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.72rem; color: #fca5a5; background: rgba(11,13,20,.7); border-radius: 12px; line-height: 1.5; }
/* 挑票 */
.scr-pick { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.scr-pick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(88px, 1fr)); gap: 12px; }
.scr-ticket { position: relative; overflow: hidden; aspect-ratio: 3/4.2; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1px; padding: 10px 6px; border-radius: 12px; border: none; cursor: pointer; color: #fff2cf; background: linear-gradient(160deg, #2a1c3d 0%, #3b2a5a 42%, #241634 100%); box-shadow: 0 4px 12px rgba(0,0,0,.45), inset 0 0 0 1.5px rgba(217,180,110,.55); transition: transform .15s, opacity .2s, box-shadow .2s; }
.scr-ticket::before { content: ''; position: absolute; inset: 4px; border-radius: 9px; border: 1px dashed rgba(217,180,110,.4); pointer-events: none; }
.scr-ticket:hover:not(:disabled) { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,.5), inset 0 0 0 1.5px rgba(217,180,110,.85); }
.scr-ticket.picked { transform: translateY(-5px); box-shadow: 0 0 0 3px var(--c-light), 0 10px 20px rgba(0,0,0,.5); }
.scr-ticket.dim { opacity: .35; }
.scr-ticket:disabled { cursor: default; }
.scr-ticket-shine { position: absolute; top: -60%; left: -30%; width: 55%; height: 220%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent); transform: rotate(18deg); pointer-events: none; }
.scr-ticket-logo { width: 44%; max-width: 46px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.5)); }
.scr-ticket-brand { font-size: 7px; letter-spacing: 1.5px; color: rgba(217,180,110,.85); font-weight: 700; }
.scr-ticket-mid { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.scr-ticket-star { color: #d9b46e; font-size: 11px; }
.scr-ticket-no { font-size: 26px; font-weight: 900; color: #ffd98a; text-shadow: 0 1px 4px rgba(0,0,0,.5); line-height: 1; }
.scr-ticket-price { font-size: 12px; font-weight: 800; color: #fff; margin-top: 1px; }
.scr-ticket-foot { font-size: 7px; letter-spacing: 1px; color: rgba(255,255,255,.4); margin-top: auto; }
/* 刮開 */
.scr-scratch { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 14px; align-items: center; }
.scr-board-head { width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.scr-lucky { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
.scr-lucky-label { font-size: 12px; color: #94a3b8; }
.scr-lucky-num { min-width: 30px; padding: 3px 9px; border-radius: 8px; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: #fff; font-size: 16px; font-weight: 900; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
.scr-rule { font-size: 12px; color: #cbd5e1; text-align: center; }
.scr-card { position: relative; width: 100%; max-width: 340px; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
.scr-card-face { position: relative; display: flex; align-items: center; justify-content: center; padding: 16px; min-height: 150px; background: linear-gradient(160deg, #1f2433, #0f131c); border: 1px solid rgba(217,180,110,.22); box-sizing: border-box; }
.scr-card-face.win { background: linear-gradient(160deg, rgba(34,197,94,.2), #0f131c); }
.scr-card-face.pool { background: linear-gradient(160deg, rgba(217,151,6,.28), #0f131c); }
.scr-face-logo { position: absolute; width: 55%; max-width: 170px; opacity: .06; pointer-events: none; }
.scr-grid { position: relative; display: grid; gap: 8px; width: 100%; }
.scr-grid.lucky, .scr-grid.multi, .scr-grid.match3, .scr-grid.triple { grid-template-columns: repeat(3, 1fr); }
.scr-grid.match3 { max-width: 246px; margin: 0 auto; }
.scr-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; aspect-ratio: 1/1; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); transition: all .2s; }
.scr-cell-big { font-size: 22px; font-weight: 800; color: #f1f5f9; line-height: 1.1; }
.scr-cell-small { font-size: 10px; color: #94a3b8; }
.scr-cell.hit { background: linear-gradient(160deg, rgba(217,151,6,.35), rgba(217,151,6,.12)); border-color: #f59e0b; box-shadow: 0 0 12px rgba(245,158,11,.5); transform: scale(1.04); }
.scr-cell.hit .scr-cell-big { color: #fde68a; }
.scr-cell.hit .scr-cell-small { color: #fcd34d; }
.scr-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.scr-result-text { font-size: 15px; font-weight: 800; color: #cbd5e1; text-align: center; min-height: 20px; }
.scr-result-text.win { color: #86efac; }
.scr-result-text.pool { color: #fbbf24; }
.scr-scratch-acts { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
/* 面板 */
.scr-panel { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; }
.scr-panel-toggle { width: 100%; background: transparent; border: none; color: #cbd5e1; font-weight: 700; padding: 12px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
.scr-panel-body { padding: 0 12px 12px; }
.scr-board-empty { font-size: 12px; color: #64748b; padding: 8px 0; }
.scr-rank-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.05); }
.scr-rank-row.me { color: #d8b4fe; font-weight: 700; }
.scr-rank-row .rk { width: 18px; color: #94a3b8; } .scr-rank-row .nm { flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scr-rank-row .games { font-size: 11px; color: #64748b; }
.scr-rank-row .net.pos { color: #86efac; } .scr-rank-row .net.neg { color: #fca5a5; }
.scr-rules { background: #131722; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #94a3b8; }
.scr-rules summary { cursor: pointer; color: #cbd5e1; font-weight: 700; } .scr-rules p { line-height: 1.7; } .scr-rules b { color: #cbd5e1; }
.scr-celebrate { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: radial-gradient(circle, rgba(217,151,6,.25), rgba(0,0,0,.82)); cursor: pointer; }
.scr-cele-emoji { font-size: 90px; animation: scr-pop .6s cubic-bezier(.2,1.4,.4,1) both; }
.scr-cele-text { font-size: 22px; font-weight: 900; color: #fff; text-shadow: 0 2px 16px rgba(217,151,6,.9); }
@keyframes scr-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
.scr-fade-enter-active, .scr-fade-leave-active { transition: opacity .35s; } .scr-fade-enter-from, .scr-fade-leave-to { opacity: 0; }
</style>
