<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'

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

// ---- 刮開的牌面(依結果生成符號) ----
const SYMS = ['🍒', '🔔', '⭐', '7️⃣', '💎', '🍋']
const sym = (i: number) => SYMS[((i % SYMS.length) + SYMS.length) % SYMS.length] ?? '💎'
const faceSymbols = computed<string[]>(() => {
  const r = result.value
  if (!r) return ['❔', '❔', '❔']
  if (r.poolWin > 0) return ['🀄', '🀄', '🀄']
  if (r.prizeMult > 0) { const s = sym(Number(r.nonce)); return [s, s, s] }
  // 沒中:三個不同
  const a = Number(r.nonce)
  return [sym(a), sym(a + 2), sym(a + 4)]
})
const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.poolWin > 0) return `🀄 中彩金池 +${fmt(r.poolWin)}${r.prize > 0 ? `　（另中 ×${r.prizeMult} +${fmt(r.prize)}）` : ''}`
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
  const g = ctx.createLinearGradient(0, 0, cv.width, cv.height)
  g.addColorStop(0, '#8b95a6'); g.addColorStop(0.5, '#c7cfdb'); g.addColorStop(1, '#9aa4b2')
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = 'rgba(30,41,59,.55)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('👆 刮開這裡', cv.width / 2, cv.height / 2 + 6)
}
function posOf(e: PointerEvent) {
  const cv = canvasRef.value!; const r = cv.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function scratchAt(x: number, y: number) {
  const cv = canvasRef.value; if (!cv || revealed.value) return
  const ctx = cv.getContext('2d'); if (!ctx) return
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill()
}
function onDown(e: PointerEvent) { scratching = true; const p = posOf(e); scratchAt(p.x, p.y) }
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
          $ {{ fmt(selectedTier?.price) }} 彩票 · 挑一張你的幸運票 🍀
        </div>
        <div class="scr-pick-grid">
          <button
            v-for="i in PICK_COUNT"
            :key="i"
            class="scr-ticketback"
            :class="{ picked: pickedIndex === i - 1, dim: pickedIndex >= 0 && pickedIndex !== i - 1 }"
            :disabled="busy || pickedIndex >= 0"
            @click="pickTicket(i - 1)"
          >
            <span class="scr-tb-emoji">🎫</span>
            <span class="scr-tb-no">{{ i }}</span>
          </button>
        </div>
      </div>

      <!-- 刮開 -->
      <div v-else-if="phase === 'scratch'" class="scr-scratch">
        <div class="scr-section-title">$ {{ fmt(selectedTier?.price) }} 彩票</div>
        <div class="scr-card">
          <div class="scr-card-face" :class="{ win: result?.win, pool: (result?.poolWin ?? 0) > 0 }">
            <div class="scr-face-syms">
              <span v-for="(s, i) in faceSymbols" :key="i" class="scr-sym">{{ s }}</span>
            </div>
            <div class="scr-face-text">{{ resultText }}</div>
          </div>
          <canvas
            v-show="!revealed"
            ref="canvasRef"
            class="scr-canvas"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointerleave="onUp"
            @pointercancel="onUp"
          ></canvas>
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
.scr-tier-price { font-size: 1.3rem; font-weight: 900; color: var(--c-light); }
.scr-tier-top { font-size: 0.78rem; color: #cbd5e1; }
.scr-tier-pool { font-size: 0.78rem; color: #fbbf24; }
.scr-tier-lock { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.72rem; color: #fca5a5; background: rgba(11,13,20,.7); border-radius: 12px; line-height: 1.5; }
/* 挑票 */
.scr-pick { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.scr-pick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px; }
.scr-ticketback { aspect-ratio: 3/4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 12px; border: 1px solid rgba(var(--c-light-rgb),.4); background: linear-gradient(160deg, var(--c-mid), var(--c-deep)); color: var(--c-on); cursor: pointer; transition: transform .15s, opacity .2s; }
.scr-ticketback:hover:not(:disabled) { transform: translateY(-4px); }
.scr-ticketback.picked { outline: 3px solid var(--c-light); outline-offset: 2px; transform: translateY(-4px); }
.scr-ticketback.dim { opacity: .4; }
.scr-tb-emoji { font-size: 30px; }
.scr-tb-no { font-size: 12px; opacity: .8; }
/* 刮開 */
.scr-scratch { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 14px; align-items: center; }
.scr-card { position: relative; width: 100%; max-width: 340px; height: 190px; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
.scr-card-face { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: linear-gradient(160deg, #1f2433, #0f131c); }
.scr-card-face.win { background: linear-gradient(160deg, rgba(34,197,94,.22), #0f131c); }
.scr-card-face.pool { background: linear-gradient(160deg, rgba(217,151,6,.28), #0f131c); }
.scr-face-syms { display: flex; gap: 10px; }
.scr-sym { font-size: 42px; }
.scr-face-text { font-size: 1rem; font-weight: 800; color: #f1f5f9; text-align: center; padding: 0 10px; }
.scr-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
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
