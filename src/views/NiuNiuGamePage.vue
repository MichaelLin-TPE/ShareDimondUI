<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return { Authorization: `Bearer ${authStore.authToken}`, 'Content-Type': 'application/json', Sign: generateSignature(ts), TimeStamp: ts }
}
const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
const myName = authStore.member?.userName

interface BetView {
  memberId: number; userName: string; amount: number; mine: boolean
  cards?: string[]; special?: string | null; label?: string; level?: number; mult?: number
  win?: boolean; settleAmount?: number; poolWin?: number; settled?: boolean
}
interface State {
  niuniuEnabled: boolean; status: string; roundId: number | null; deadlineEpochMs: number; remainingMs: number
  currency: string; online: string[]; myBalance: number | null; poolBalance: number
  bankerName: string | null; bankroll: number | null; remainingCapacity: number | null; maxMult: number
  bankerCards?: string[]; bankerLabel?: string; bankerSpecial?: string | null; bankerLevel?: number
  bets: BetView[]; serverSeed?: string; serverSeedHash?: string; clientSeed?: string; nonce?: number; poolWin?: number
}
const loading = ref(true)
const state = ref<State | null>(null)
const config = ref({ enabled: false, betAmount: 100, maxBet: 2000000, maxMult: 5, currency: '', chips: [] as number[], payTable: [] as { zh: string; mult: number }[] })

// ---- 卡牌(四色) ----
const SUIT: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const suitSym = (c: string) => SUIT[c.slice(-1)] ?? ''
const rankLabel = (c: string) => c.slice(0, -1)
const suitClass = (c: string) => ({ C: 'su-c', D: 'su-d', H: 'su-h', S: 'su-s' }[c.slice(-1)] ?? 'su-s')

// ---- 倒數 ----
const nowMs = ref(Date.now())
const localDeadlineMs = ref(0)
let tickTimer: number | undefined
const countdown = computed(() => {
  if (state.value?.status !== 'BETTING') return 0
  return Math.max(0, Math.ceil((localDeadlineMs.value - nowMs.value) / 1000))
})
const closing = computed(() => state.value?.status === 'BETTING' && countdown.value <= 1)

// ---- 莊家 ----
const hasBanker = computed(() => !!state.value?.bankerName)
const bankerIsMe = computed(() => hasBanker.value && state.value?.bankerName === myName)

// ---- 下注 ----
const minBet = computed(() => Number(config.value.betAmount || 0))
const betAmountInput = ref<number | null>(null)
const effectiveBet = computed(() => Math.floor(Number(betAmountInput.value) || 0))
const maxMult = computed(() => Number(state.value?.maxMult || config.value.maxMult || 5))
const escrowNeeded = computed(() => effectiveBet.value * maxMult.value)
function addChip(v: number) { betAmountInput.value = (Number(betAmountInput.value) || 0) + v }
function clearBet() { betAmountInput.value = null }
// 本局我已下(妞妞一人一注,累加)
const myRoundTotal = computed(() => {
  if (state.value?.status !== 'BETTING') return 0
  const mine = state.value?.bets?.find((b) => b.mine)
  return mine ? Number(mine.amount) : 0
})
// 還可下 = min( 莊家承受÷5 , 本局上限-已下 , 我餘額÷5 )
const maxBetForCurrent = computed(() => {
  const byBanker = Math.floor(Number(state.value?.remainingCapacity ?? 0) / maxMult.value)
  const byCap = config.value.maxBet - myRoundTotal.value
  const byWallet = Math.floor(Number(state.value?.myBalance ?? 0) / maxMult.value)
  return Math.max(0, Math.min(byBanker, byCap, byWallet))
})
const belowMin = computed(() => effectiveBet.value > 0 && effectiveBet.value < minBet.value)
const overCap = computed(() => effectiveBet.value > maxBetForCurrent.value)
const revealing = ref(false)
// 剛結算、正在展示結果的那一局(展示幾秒後自動清掉 → 回到可開新局狀態)
const liveResultRound = ref<number | null>(null)
const showResult = computed(() =>
  state.value?.status === 'SETTLED' && state.value?.roundId != null && state.value?.roundId === liveResultRound.value)
const canBet = computed(() =>
  !!state.value?.niuniuEnabled && hasBanker.value && !bankerIsMe.value && !closing.value && !revealing.value &&
  !showResult.value && effectiveBet.value > 0 && !belowMin.value && !overCap.value)
function cantBetReason(): string {
  const s = state.value
  if (!s?.niuniuEnabled) return '妞妞目前未開放'
  if (!hasBanker.value) return '目前沒有莊家，先坐莊或等人坐莊'
  if (bankerIsMe.value) return '你是莊家，不能玩自己的莊'
  if (closing.value) return '本局已封盤，等下一局再下注'
  if (revealing.value || showResult.value) return '本局結果顯示中，馬上就能開新局'
  if (effectiveBet.value <= 0) return '請輸入下注金額'
  if (belowMin.value) return `最小下注 ${fmt(minBet.value)} ${s?.currency ?? ''}`
  if (overCap.value) return `此注上限約 ${fmt(maxBetForCurrent.value)}，請降低金額`
  return ''
}

// ---- API ----
async function loadConfig() {
  try {
    const res = await fetch(`${API}/niuniu/config`, { headers: headers() })
    if (!res.ok) return
    const d = await res.json()
    config.value = {
      enabled: !!d.enabled, betAmount: Number(d.betAmount), maxBet: Number(d.maxBet) || 2000000,
      maxMult: Number(d.maxMult) || 5, currency: d.currency ?? '',
      chips: Array.isArray(d.chips) ? d.chips.map(Number) : [], payTable: d.payTable ?? [],
    }
  } catch (e) { console.error(e) }
}

let fetching = false
let initialized = false
let lastSettledRound: number | null = null
let resultClearTimer: number | undefined
let busy = false
async function fetchRound() {
  if (fetching) return
  fetching = true
  try {
    const res = await fetch(`${API}/niuniu/round`, { headers: headers() })
    if (!res.ok) return
    const d: State = await res.json()
    const prevStatus = state.value?.status
    state.value = d
    localDeadlineMs.value = d.status === 'BETTING' ? Date.now() + Number(d.remainingMs || 0) : 0
    if (!initialized) { initialized = true; if (d.status === 'SETTLED' && d.roundId) lastSettledRound = d.roundId }
    else if (d.status === 'SETTLED' && d.roundId && d.roundId !== lastSettledRound && prevStatus === 'BETTING') {
      lastSettledRound = d.roundId
      liveResultRound.value = d.roundId
      if (resultClearTimer) clearTimeout(resultClearTimer)
      resultClearTimer = window.setTimeout(() => { liveResultRound.value = null }, 8000)
      await playReveal(d)
    }
  } catch (e) { console.error(e) } finally { fetching = false }
}

async function playReveal(d: State) {
  revealing.value = true
  playDealSound()
  await delay(1300)
  revealing.value = false
  const me = d.bets?.find((b) => b.mine)
  if (me) {
    if ((me.poolWin ?? 0) > 0) { celebrate.value = `🐮 五小牛中彩金池 +${fmt(me.poolWin)}！`; playJackpot() }
    else if (me.win) { playWin() } else { playLose() }
    if (celebrate.value) { if (celeTimer) clearTimeout(celeTimer); celeTimer = window.setTimeout(() => (celebrate.value = ''), 4000) }
  }
  loadBoards()
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function placeBet() {
  if (!canBet.value || busy) return
  busy = true; ensureAudio()
  try {
    const res = await fetch(`${API}/niuniu/bet`, { method: 'POST', headers: headers(), body: JSON.stringify({ amount: effectiveBet.value }) })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '下注失敗'); return }
    liveResultRound.value = null // 開了新局,立刻清掉上一局結果
    if (resultClearTimer) clearTimeout(resultClearTimer)
    playChip(); clearBet(); await fetchRound()
  } catch (e) { console.error(e); useAlert.error('連線失敗') } finally { busy = false }
}
async function takeBank() {
  const challenge = hasBanker.value
  const hint = challenge ? `本金必須大於現任莊家 ${fmt(state.value?.bankroll)}` : '輸入你要投入的本金（玩家最多可贏走本金，× 牛倍率）'
  const v = await useAlert.inputDialog(hint, challenge ? '搶莊' : '我要坐莊')
  const amount = Number(v); if (!amount || amount <= 0) return
  try {
    const res = await fetch(`${API}/niuniu/bank/take`, { method: 'POST', headers: headers(), body: JSON.stringify({ amount }) })
    const d = await res.json(); if (!res.ok) return useAlert.error(d.message ?? '坐莊失敗')
    useAlert.success(d.message); await fetchRound()
  } catch (e) { console.error(e); useAlert.error('連線失敗') }
}
async function leaveBank() {
  const ok = await useAlert.confirm('確定要下莊？剩餘本金會退回錢包'); if (!ok?.isConfirmed) return
  try {
    const res = await fetch(`${API}/niuniu/bank/leave`, { method: 'POST', headers: headers() })
    const d = await res.json(); if (!res.ok) return useAlert.error(d.message ?? '下莊失敗')
    useAlert.success(d.message); await fetchRound()
  } catch (e) { console.error(e); useAlert.error('連線失敗') }
}

// ---- 排行榜 ----
interface RankRow { rank: number; userName: string; net: number; spins: number; me: boolean }
const boardsOpen = ref(false)
const leaderboard = ref<RankRow[]>([])
async function loadBoards() {
  try {
    const res = await fetch(`${API}/niuniu/leaderboard?limit=10`, { headers: headers() })
    if (res.ok) leaderboard.value = await res.json()
  } catch (e) { console.error(e) }
}

// ---- 聊天 ----
interface ChatMsg { userName: string; text: string }
const chatOpen = ref(false)
const chatMessages = ref<ChatMsg[]>([])
const chatDraft = ref('')
const chatSending = ref(false)
const chatScroll = ref<HTMLElement | null>(null)
async function loadChat() {
  try { const res = await fetch(`${API}/niuniu/chat`, { headers: headers() }); if (res.ok) { chatMessages.value = await res.json(); nextTick(() => { if (chatScroll.value) chatScroll.value.scrollTop = chatScroll.value.scrollHeight }) } } catch (e) { console.error(e) }
}
async function sendChat() {
  const text = chatDraft.value.trim(); if (!text || chatSending.value) return
  chatSending.value = true
  try {
    const res = await fetch(`${API}/niuniu/chat`, { method: 'POST', headers: headers(), body: JSON.stringify({ text }) })
    const d = await res.json().catch(() => null); if (!res.ok) { useAlert.error(d?.message ?? '送出失敗'); return }
    chatDraft.value = ''; await loadChat()
  } catch (e) { console.error(e) } finally { chatSending.value = false }
}

// ---- 慶祝 ----
const celebrate = ref('')
let celeTimer: number | undefined

// ---- 音效(Web Audio) ----
const sfxOn = ref(localStorage.getItem('niu_sfx') !== 'off')
let ctx: AudioContext | null = null
function ensureAudio() { try { if (!ctx) { const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; ctx = new C() } if (ctx.state === 'suspended') void ctx.resume(); return ctx } catch { return null } }
function tone(t: number, f: number, dur: number, g: number, type: OscillatorType) { const c = ctx; if (!c) return; const o = c.createOscillator(); o.type = type; o.frequency.value = f; const gg = c.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(gg); gg.connect(c.destination); o.start(t); o.stop(t + dur) }
function playChip() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; tone(c.currentTime, 1200, 0.08, 0.12, 'triangle') }
function playDealSound() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; let t = c.currentTime; for (let i = 0; i < 6; i++) { tone(t, 900 + Math.random() * 500, 0.06, 0.1, 'triangle'); t += 0.09 } }
function playWin() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, f, 0.26, 0.16, 'triangle')) }
function playLose() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[330, 262, 196].forEach((f, i) => tone(t + i * 0.13, f, 0.28, 0.12, 'sine')) }
function playJackpot() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.11, f, 0.3, 0.18, 'sawtooth')) }
function toggleSfx() { sfxOn.value = !sfxOn.value; localStorage.setItem('niu_sfx', sfxOn.value ? 'on' : 'off'); if (sfxOn.value) playChip() }

// ---- 背景音樂(public/niuniu-bgm.mp3 迴圈) ----
const bgmOn = ref(localStorage.getItem('niu_bgm') !== 'off')
const savedVol = Number(localStorage.getItem('niu_vol'))
const bgmVolume = ref(Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1 ? savedVol : 0.35)
let bgm: HTMLAudioElement | null = null
function startMusic() {
  if (bgm) { void bgm.play().catch(() => {}); return }
  bgm = new Audio('/niuniu-bgm.mp3')
  bgm.loop = true
  bgm.preload = 'auto'
  bgm.volume = bgmVolume.value
  void bgm.play().catch(() => {})
}
function stopMusic() { if (bgm) { try { bgm.pause(); bgm.currentTime = 0 } catch { /* ignore */ } } }
function setBgmVolume(v: number | string) {
  const vol = Math.min(1, Math.max(0, Number(v) || 0))
  bgmVolume.value = vol
  localStorage.setItem('niu_vol', String(vol))
  if (bgm) bgm.volume = vol
}
function toggleBgm() {
  bgmOn.value = !bgmOn.value
  localStorage.setItem('niu_bgm', bgmOn.value ? 'on' : 'off')
  if (bgmOn.value) startMusic(); else stopMusic()
}
let armed = false
function armAutoStart() {
  if (armed) return
  armed = true
  const handler = () => {
    ensureAudio()
    if (bgmOn.value) startMusic()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('keydown', handler)
}

// ---- WS + 心跳 ----
let ws: StompHandle | null = null
let heartbeat: number | undefined
onMounted(async () => {
  loading.value = true
  await loadConfig(); await fetchRound(); loadBoards(); loadChat(); loading.value = false
  const clanId = authStore.member?.clanId
  if (clanId) ws = createReconnectingStomp(`/topic/niuniu/${clanId}`, (b) => { if (b === 'NIUNIU_UPDATED') fetchRound(); else if (b === 'NIUNIU_CHAT') loadChat() })
  tickTimer = window.setInterval(() => (nowMs.value = Date.now()), 250)
  heartbeat = window.setInterval(fetchRound, 8000)
  armAutoStart()
})
onUnmounted(() => {
  if (ws) ws.disconnect(); if (tickTimer) clearInterval(tickTimer); if (heartbeat) clearInterval(heartbeat); if (celeTimer) clearTimeout(celeTimer); if (resultClearTimer) clearTimeout(resultClearTimer)
  stopMusic(); bgm = null
  if (ctx) { ctx.close().catch(() => {}); ctx = null }
  fetch(`${API}/niuniu/leave`, { method: 'POST', headers: headers() }).catch(() => {})
})
</script>

<template>
  <div class="niu-shell">
    <transition name="niu-fade">
      <div v-if="celebrate" class="niu-celebrate" @click="celebrate = ''">
        <div class="niu-cele-emoji">🐮</div>
        <div class="niu-cele-text">{{ celebrate }}</div>
      </div>
    </transition>

    <div class="niu-page">
      <div class="niu-head">
        <div class="niu-title">🐮 妞妞 <span class="niu-sub">玩家坐莊 · 比牛大小</span>
          <div class="niu-audioctrl">
            <button class="niu-audio" :class="{ off: !bgmOn }" :title="bgmOn ? '關背景音樂' : '開背景音樂'" @click="toggleBgm">{{ bgmOn ? '🎵' : '🔇' }}</button>
            <input
              v-if="bgmOn"
              class="niu-vol"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="bgmVolume"
              @input="setBgmVolume(($event.target as HTMLInputElement).value)"
            />
            <button class="niu-audio" :class="{ off: !sfxOn }" :title="sfxOn ? '關音效' : '開音效'" @click="toggleSfx">{{ sfxOn ? '🔊' : '🔈' }}</button>
          </div>
        </div>
        <div class="niu-stats">
          <div class="niu-stat"><span>彩金池</span><b>{{ config.currency }} {{ fmt(state?.poolBalance) }}</b></div>
          <div class="niu-stat"><span>我的餘額</span><b>{{ config.currency }} {{ fmt(state?.myBalance) }}</b></div>
        </div>
      </div>

      <div v-if="loading" class="niu-empty">載入中…</div>
      <div v-else-if="!state?.niuniuEnabled" class="niu-empty">🚫 本血盟尚未開放妞妞<br /><small>請管理員到「設置」開啟</small></div>

      <template v-else>
        <div class="niu-online">🟢 在線 {{ state?.online?.length ?? 0 }} 人：{{ (state?.online ?? []).join('、') || '—' }}</div>

        <!-- 莊家座位 -->
        <div class="niu-banker">
          <div class="niu-banker-left">
            <span class="niu-banker-emoji">👑</span>
            <div>
              <div class="niu-banker-name">{{ hasBanker ? state?.bankerName : '目前無莊家' }}</div>
              <div class="niu-banker-roll" v-if="hasBanker">本金 {{ config.currency }} {{ fmt(state?.bankroll) }}</div>
            </div>
          </div>
          <div class="niu-banker-act">
            <template v-if="hasBanker">
              <button v-if="bankerIsMe" class="niu-btn leave" @click="leaveBank">下莊</button>
              <button v-else class="niu-btn take" @click="takeBank">搶莊</button>
            </template>
            <button v-else class="niu-btn take" @click="takeBank">我要坐莊</button>
          </div>
        </div>

        <!-- 牌桌 -->
        <div class="niu-table">
          <div class="niu-table-head">
            <span v-if="revealing">🃏 發牌中…</span>
            <span v-else-if="state?.status === 'BETTING'">🪙 下注中</span>
            <span v-else-if="showResult">🏆 本局結果</span>
            <span v-else>等待開局 · 下第一注即開局</span>
            <span v-if="countdown > 0" class="niu-countdown" :class="{ urgent: countdown <= 10 }">⏱ {{ countdown }}s</span>
          </div>

          <!-- 莊家牌(結算展示中) -->
          <div v-if="showResult && state?.bankerCards" class="niu-hand banker" :class="{ flip: !revealing }">
            <span class="niu-hand-tag">👑 莊 · <b>{{ state?.bankerLabel }}</b></span>
            <span class="niu-cards">
              <span v-for="(c, i) in state.bankerCards" :key="i" class="niu-card" :class="suitClass(c)"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></span>
            </span>
          </div>

          <!-- 玩家牌 / 下注列(下注中或結算展示中才列出) -->
          <div v-if="state?.status === 'BETTING' || showResult" class="niu-players">
            <div v-for="b in (state?.bets ?? [])" :key="b.memberId" class="niu-player" :class="{ mine: b.mine, win: showResult && b.settled && b.win, lose: showResult && b.settled && !b.win }">
              <div class="niu-player-head">
                <span class="niu-player-name">{{ b.userName }}<span v-if="b.mine"> (你)</span></span>
                <span class="niu-player-bet">下 {{ fmt(b.amount) }}</span>
                <span v-if="showResult && b.settled" class="niu-player-res" :class="{ pos: b.win, neg: !b.win }">
                  {{ b.label }} · {{ b.win ? '贏' : '輸' }} {{ fmt(Math.abs(Number(b.settleAmount))) }}
                  <span v-if="(b.poolWin ?? 0) > 0">🐮+{{ fmt(b.poolWin) }}</span>
                </span>
              </div>
              <span v-if="showResult && b.settled && b.cards" class="niu-cards small" :class="{ flip: !revealing }">
                <span v-for="(c, i) in b.cards" :key="i" class="niu-card sm" :class="suitClass(c)"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></span>
              </span>
            </div>
            <div v-if="(state?.bets ?? []).length === 0" class="niu-noplayers">還沒人下注</div>
          </div>
          <div v-else class="niu-noplayers">{{ hasBanker ? '下第一注即開局，比牛比大小！' : '等莊家就位後即可開局' }}</div>
        </div>

        <!-- 下注區(非莊家、非結算展示中) -->
        <div v-if="!bankerIsMe && !showResult" class="niu-betbox">
          <div class="niu-chips">
            <span class="niu-label">籌碼</span>
            <button v-for="c in config.chips" :key="c" class="niu-chip" @click="addChip(c)">+{{ fmt(c) }}</button>
            <button class="niu-chip clear" @click="clearBet">清</button>
          </div>
          <div class="niu-amount-row">
            <span class="niu-label">金額</span>
            <input v-model.number="betAmountInput" type="number" class="niu-amount" :class="{ bad: belowMin || overCap }" :min="minBet" step="1" placeholder="下注金額" />
          </div>
          <div class="niu-bethint">
            本注 <b>{{ fmt(effectiveBet) }}</b>（凍結 {{ fmt(escrowNeeded) }}，最多可輸）· 最小 {{ fmt(minBet) }} · 此注上限 <b :class="{ over: overCap }">{{ fmt(maxBetForCurrent) }}</b>
          </div>
          <button class="niu-roll" :disabled="!canBet || busy" @click="placeBet">
            {{ closing ? '🔒 封盤中…' : revealing ? '開牌中…' : state?.status === 'BETTING' ? '🪙 下注' : '🪙 下注開新局' }}
          </button>
          <p v-if="!canBet" class="niu-ineligible">{{ cantBetReason() }}</p>
        </div>

        <!-- 排行榜 -->
        <div class="niu-panel">
          <button class="niu-panel-toggle" @click="boardsOpen = !boardsOpen">🏆 賺錢排行榜 <span>{{ boardsOpen ? '▲' : '▼' }}</span></button>
          <div v-if="boardsOpen" class="niu-panel-body">
            <div v-if="leaderboard.length === 0" class="niu-board-empty">尚無戰績</div>
            <div v-for="r in leaderboard" :key="r.rank" class="niu-rank-row" :class="{ me: r.me }">
              <span class="rk">{{ r.rank }}</span><span class="nm">{{ r.userName }}</span><span class="games">{{ r.spins }} 局</span>
              <span class="net" :class="{ pos: r.net > 0, neg: r.net < 0 }">{{ r.net > 0 ? '+' : '' }}{{ fmt(r.net) }}</span>
            </div>
          </div>
        </div>

        <details class="niu-rules">
          <summary>📜 規則 / 賠率</summary>
          <p>每人 5 張。任 3 張加總是 10 的倍數 = 有牛，剩 2 張總和個位數 = 牛幾（0=牛牛）；湊不出 = 沒牛。莊家對每位玩家比牛，牛大者贏，依<b>贏家的牛</b>給倍數。</p>
          <p>倍率：<span v-for="(p, i) in config.payTable" :key="i">{{ p.zh }} ×{{ p.mult }}<span v-if="i < config.payTable.length - 1">、</span></span></p>
          <p>下注 X 最多可能輸 {{ maxMult }}X（所以下注時凍結 {{ maxMult }}X），結算退回沒輸的部分。五小牛額外中共用彩金池。</p>
        </details>
      </template>
    </div>

    <!-- 聊天室(桌面右側 / 手機抽屜) -->
    <aside class="niu-chat" :class="{ open: chatOpen }">
      <div class="niu-chat-head"><span>💬 賭桌聊天</span><button class="niu-chat-x" @click="chatOpen = false">✕</button></div>
      <div ref="chatScroll" class="niu-chat-list">
        <div v-if="!chatMessages.length" class="niu-chat-empty">還沒人說話，來聊兩句 🗣️</div>
        <div v-for="(m, i) in chatMessages" :key="i" class="niu-chat-row" :class="{ mine: m.userName === myName }">
          <span class="niu-chat-who">{{ m.userName === myName ? '我' : m.userName }}</span>
          <span class="niu-chat-bubble">{{ m.text }}</span>
        </div>
      </div>
      <form class="niu-chat-form" @submit.prevent="sendChat">
        <input v-model="chatDraft" class="niu-chat-field" maxlength="100" placeholder="說點什麼…" />
        <button type="submit" class="niu-chat-send" :disabled="chatSending || !chatDraft.trim()">送</button>
      </form>
    </aside>
    <button class="niu-chat-fab" @click="chatOpen = !chatOpen">{{ chatOpen ? '✕' : '💬' }}</button>
  </div>
</template>

<style scoped>
.niu-shell { display: flex; gap: 16px; align-items: flex-start; justify-content: center; max-width: 1100px; margin: 0 auto; padding: 12px; color: #e5e7eb; position: relative; }
.niu-page { flex: 1 1 auto; min-width: 0; max-width: 640px; display: flex; flex-direction: column; gap: 12px; }
.niu-head { display: flex; flex-direction: column; gap: 8px; }
.niu-title { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
.niu-sub { font-size: 12px; font-weight: 400; color: #94a3b8; }
.niu-audioctrl { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.niu-audio { background: rgba(var(--c-light-rgb), .12); border: 1px solid rgba(var(--c-light-rgb), .3); border-radius: 8px; width: 34px; height: 30px; cursor: pointer; font-size: 15px; padding: 0; }
.niu-audio.off { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); opacity: .6; }
.niu-vol { width: 70px; accent-color: var(--c-light); cursor: pointer; }
.niu-stats { display: flex; gap: 8px; }
.niu-stat { flex: 1 1 0; background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 8px 12px; }
.niu-stat span { display: block; font-size: 11px; color: #94a3b8; }
.niu-stat b { font-size: 16px; color: var(--c-light); }
.niu-empty { text-align: center; color: #94a3b8; padding: 40px 12px; background: #131722; border-radius: 12px; line-height: 1.8; }
.niu-online { font-size: 12px; color: #94a3b8; background: #131722; border-radius: 8px; padding: 6px 10px; }
.niu-banker { display: flex; justify-content: space-between; align-items: center; background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 10px 12px; }
.niu-banker-left { display: flex; align-items: center; gap: 10px; }
.niu-banker-emoji { font-size: 24px; }
.niu-banker-name { font-weight: 800; }
.niu-banker-roll { font-size: 12px; color: #94a3b8; }
.niu-btn { border: none; border-radius: 10px; padding: 11px 20px; font-weight: 700; cursor: pointer; font-size: 0.95rem; line-height: 1; transition: filter .15s; }
.niu-btn:hover { filter: brightness(1.08); }
.niu-btn.take { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); }
.niu-btn.leave { background: #334155; color: #f1f5f9; }
.niu-table { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; }
.niu-table-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 10px; }
.niu-countdown { color: #fbbf24; font-variant-numeric: tabular-nums; }
.niu-countdown.urgent { color: #f87171; }
.niu-hand.banker { background: rgba(var(--c-light-rgb),.08); border: 1px solid rgba(var(--c-light-rgb),.3); border-radius: 10px; padding: 8px 10px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.niu-hand-tag { font-size: 13px; }
.niu-cards { display: flex; gap: 4px; }
.niu-card { width: 36px; height: 50px; border-radius: 6px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1; }
.niu-card .r { font-size: 15px; } .niu-card .s { font-size: 16px; }
.niu-card.sm { width: 30px; height: 42px; } .niu-card.sm .r { font-size: 13px; } .niu-card.sm .s { font-size: 14px; }
.niu-card.su-s { color: #0f172a; } .niu-card.su-h { color: #e11d48; } .niu-card.su-d { color: #2563eb; } .niu-card.su-c { color: #15a34a; }
.niu-cards.flip .niu-card { animation: niu-flip .4s ease both; }
.niu-cards.flip .niu-card:nth-child(2) { animation-delay: .06s; } .niu-cards.flip .niu-card:nth-child(3) { animation-delay: .12s; }
.niu-cards.flip .niu-card:nth-child(4) { animation-delay: .18s; } .niu-cards.flip .niu-card:nth-child(5) { animation-delay: .24s; }
@keyframes niu-flip { from { opacity: 0; transform: rotateY(-90deg) translateY(8px); } to { opacity: 1; transform: rotateY(0) translateY(0); } }
.niu-players { display: flex; flex-direction: column; gap: 8px; }
.niu-player { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 8px 10px; }
.niu-player.mine { border-color: var(--c-light); }
.niu-player.win { border-color: rgba(34,197,94,.5); background: rgba(34,197,94,.08); }
.niu-player.lose { border-color: rgba(248,113,113,.4); background: rgba(248,113,113,.06); }
.niu-player-head { display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap; }
.niu-player-name { font-weight: 700; }
.niu-player-bet { color: #94a3b8; font-size: 12px; }
.niu-player-res { margin-left: auto; font-weight: 700; }
.niu-player-res.pos { color: #86efac; } .niu-player-res.neg { color: #fca5a5; }
.niu-cards.small { margin-top: 6px; }
.niu-noplayers { color: #64748b; font-size: 13px; text-align: center; padding: 10px; }
.niu-betbox { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.niu-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.niu-label { font-size: 12px; color: #94a3b8; flex: 0 0 auto; }
.niu-chip { height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 9px; border: 1px solid #2e3147; background: #0f111a; color: #cbd5e1; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all .15s; }
.niu-chip:hover { border-color: var(--c-light); color: var(--c-light); background: rgba(var(--c-light-rgb),.12); }
.niu-chip.clear { color: #64748b; }
.niu-chip.clear:hover { border-color: #475569; color: #94a3b8; background: #0f111a; }
.niu-amount-row { display: flex; align-items: center; gap: 8px; }
.niu-amount { flex: 1 1 auto; min-width: 0; height: 40px; box-sizing: border-box; padding: 0 12px; background: #0f172a; border: 1px solid #334155; border-radius: 9px; color: #fff; font-size: 1rem; font-weight: 700; outline: none; }
.niu-amount.bad { border-color: #f87171; }
.niu-amount:focus { border-color: var(--c-light); }
.niu-bethint { font-size: 0.76rem; color: #64748b; line-height: 1.6; }
.niu-bethint b { color: #94a3b8; } .niu-bethint .over { color: #f87171; }
.niu-roll { width: 100%; height: 52px; border: none; border-radius: 14px; padding: 0; font-weight: 900; font-size: 1.1rem; cursor: pointer; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); transition: filter .2s; }
.niu-roll:not(:disabled):hover { filter: brightness(1.08); }
.niu-roll:disabled { opacity: .5; cursor: not-allowed; }
.niu-ineligible { text-align: center; color: #f59e0b; font-size: 0.8rem; margin: 0; }
.niu-panel { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; }
.niu-panel-toggle { width: 100%; background: transparent; border: none; color: #cbd5e1; font-weight: 700; padding: 12px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
.niu-panel-body { padding: 0 12px 12px; }
.niu-board-empty { font-size: 12px; color: #64748b; padding: 8px 0; }
.niu-rank-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.05); }
.niu-rank-row.me { color: #d8b4fe; font-weight: 700; }
.niu-rank-row .rk { width: 18px; color: #94a3b8; } .niu-rank-row .nm { flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.niu-rank-row .games { font-size: 11px; color: #64748b; }
.niu-rank-row .net.pos { color: #86efac; } .niu-rank-row .net.neg { color: #fca5a5; }
.niu-rules { background: #131722; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #94a3b8; }
.niu-rules summary { cursor: pointer; color: #cbd5e1; font-weight: 700; } .niu-rules p { line-height: 1.7; }
.niu-celebrate { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: radial-gradient(circle, rgba(var(--c-light-rgb),.25), rgba(0,0,0,.82)); cursor: pointer; }
.niu-cele-emoji { font-size: 90px; animation: niu-pop .6s cubic-bezier(.2,1.4,.4,1) both; }
.niu-cele-text { font-size: 24px; font-weight: 900; color: #fff; text-shadow: 0 2px 16px rgba(var(--c-light-rgb),.9); }
@keyframes niu-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
.niu-fade-enter-active, .niu-fade-leave-active { transition: opacity .35s; } .niu-fade-enter-from, .niu-fade-leave-to { opacity: 0; }
/* 聊天室 */
.niu-chat { flex: 0 0 300px; position: sticky; top: 12px; display: flex; flex-direction: column; height: calc(100vh - 80px); max-height: 700px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; overflow: hidden; }
.niu-chat-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; font-weight: 800; font-size: .9rem; color: var(--c-light); border-bottom: 1px solid rgba(255,255,255,.08); }
.niu-chat-x { display: none; background: none; border: none; color: #94a3b8; cursor: pointer; }
.niu-chat-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.niu-chat-empty { color: #64748b; font-size: .8rem; text-align: center; margin: auto 0; }
.niu-chat-row { display: flex; flex-direction: column; align-items: flex-start; max-width: 90%; }
.niu-chat-row.mine { align-self: flex-end; align-items: flex-end; }
.niu-chat-who { font-size: .66rem; color: #94a3b8; margin: 0 4px 1px; }
.niu-chat-bubble { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 5px 10px; font-size: .85rem; color: #e2e8f0; word-break: break-word; }
.niu-chat-row.mine .niu-chat-bubble { background: rgba(var(--c-light-rgb),.18); border-color: rgba(var(--c-light-rgb),.4); color: var(--c-light); }
.niu-chat-form { display: flex; align-items: center; gap: 8px; padding: 8px; border-top: 1px solid rgba(255,255,255,.08); }
.niu-chat-field { flex: 1 1 0; min-width: 0; height: 40px; box-sizing: border-box; padding: 0 12px; background: #0f172a; border: 1px solid #334155; border-radius: 9px; color: #fff; }
.niu-chat-field:focus { outline: none; border-color: var(--c-light); }
.niu-chat-send { flex: 0 0 56px; width: 56px; height: 40px; align-self: center; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 9px; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); font-weight: 800; font-size: 0.9rem; line-height: 1; cursor: pointer; }
.niu-chat-send:disabled { opacity: .5; cursor: not-allowed; }
.niu-chat-fab { display: none; }
@media (max-width: 880px) {
  .niu-shell { display: block; max-width: 640px; }
  .niu-page { max-width: none; }
  .niu-chat { position: fixed; left: 0; right: 0; bottom: 0; top: auto; height: 62vh; max-height: none; flex: none; background: #131722; border-radius: 16px 16px 0 0; transform: translateY(105%); transition: transform .3s; z-index: 1500; }
  .niu-chat.open { transform: translateY(0); }
  .niu-chat-x { display: inline-flex; }
  .niu-chat-fab { display: inline-flex; align-items: center; justify-content: center; position: fixed; right: 16px; bottom: 16px; width: 52px; height: 52px; border-radius: 50%; border: none; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); font-size: 1.4rem; cursor: pointer; z-index: 1600; }
}
</style>
