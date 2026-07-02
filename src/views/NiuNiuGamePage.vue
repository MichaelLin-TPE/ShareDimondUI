<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
const trimNum = (x: number) => Number(x.toFixed(2)).toString()
const chipLabel = (n: number): string => {
  if (n >= 1e8) return trimNum(n / 1e8) + '億'
  if (n >= 1e4) return trimNum(n / 1e4) + '萬'
  return n.toLocaleString('en-US')
}
const myName = authStore.member?.userName

interface PositionView {
  index: number; zh: string; totalBet: number; myBet: number
  cards?: string[]; label?: string; level?: number; special?: string | null; mult?: number; won?: boolean
}
interface BetView {
  memberId: number; userName: string; position: number; amount: number; mine: boolean
  label?: string; mult?: number; win?: boolean; settleAmount?: number; poolWin?: number; settled?: boolean
}
interface State {
  niuniuEnabled: boolean; status: string; roundId: number | null; deadlineEpochMs: number; remainingMs: number
  currency: string; online: string[]; myBalance: number | null; poolBalance: number
  bankerName: string | null; bankroll: number | null; remainingCapacity: number | null; maxMult: number
  bankerCards?: string[]; bankerLabel?: string; bankerSpecial?: string | null; bankerLevel?: number
  positions: PositionView[]; bets: BetView[]
  serverSeed?: string; serverSeedHash?: string; clientSeed?: string; nonce?: number; poolWin?: number
  revealComplete?: boolean; revealRemainingMs?: number; revealedCount?: number; revealTotal?: number; bankerRevealed?: boolean
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

// ---- 位置(天地玄黃) ----
const ZH = ['天', '地', '玄', '黃']
// 本局結果顯示 5 秒後自動清空,回到乾淨的選位盤,給大家重新押 4 個閒家
const resultsCleared = ref(false)
const positions = computed<PositionView[]>(() => {
  const ps = state.value?.positions
  if (!resultsCleared.value && ps && ps.length === 4) return ps
  return [1, 2, 3, 4].map((i) => ({ index: i, zh: ZH[i - 1] ?? '', totalBet: 0, myBet: 0 }))
})
const selectedPos = ref<number>(0)
function selectPos(i: number) { if (canSelectPos.value) selectedPos.value = i }
// 我在各位置的結果(結算後);1~4 都有值,避免模板存取到 undefined
const myResultByPos = computed<Record<number, { settle: number; pool: number; win: boolean }>>(() => {
  const map: Record<number, { settle: number; pool: number; win: boolean }> = {
    1: { settle: 0, pool: 0, win: false }, 2: { settle: 0, pool: 0, win: false },
    3: { settle: 0, pool: 0, win: false }, 4: { settle: 0, pool: 0, win: false },
  }
  for (const b of state.value?.bets ?? []) {
    if (!b.mine || !b.settled) continue
    const cur = map[b.position]
    if (!cur) continue
    cur.settle += Number(b.settleAmount || 0)
    cur.pool += Number(b.poolWin || 0)
    cur.win = !!b.win
  }
  return map
})
const myRes = (i: number) => myResultByPos.value[i] ?? { settle: 0, pool: 0, win: false }
// 每個位置有誰押、押多少(清空後不顯示)
const betsByPosition = computed<Record<number, { memberId: number; userName: string; amount: number; mine: boolean }[]>>(() => {
  const map: Record<number, { memberId: number; userName: string; amount: number; mine: boolean }[]> = { 1: [], 2: [], 3: [], 4: [] }
  if (resultsCleared.value) return map
  for (const b of state.value?.bets ?? []) {
    const arr = map[b.position]
    if (arr) arr.push({ memberId: b.memberId, userName: b.userName, amount: Number(b.amount || 0), mine: b.mine })
  }
  return map
})
const posBettors = (i: number) => betsByPosition.value[i] ?? []

// ---- 下注 ----
const minBet = computed(() => Number(config.value.betAmount || 0))
const betAmountInput = ref<number | null>(null)
const effectiveBet = computed(() => Math.floor(Number(betAmountInput.value) || 0))
const maxMult = computed(() => Number(state.value?.maxMult || config.value.maxMult || 5))
const escrowNeeded = computed(() => effectiveBet.value * maxMult.value)
function addChip(v: number) { betAmountInput.value = (Number(betAmountInput.value) || 0) + v }
function clearBet() { betAmountInput.value = null }
// 本局我已下(所有位置加總)。非下注中(結算後要開新局)歸 0,否則上一局的注會把新局上限卡成 0
const myRoundTotal = computed(() => {
  if (state.value?.status !== 'BETTING') return 0
  return positions.value.reduce((s, p) => s + Number(p.myBet || 0), 0)
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
const showResult = computed(() => state.value?.status === 'SETTLED')

// ---- 開牌階段(伺服器驅動:限時開牌,莊家開完或到期才可開新局) ----
const autoOpen = ref(localStorage.getItem('niu_autoopen') === 'on')
const squeezeMode = ref(false)     // 莊家搓牌模式
const handOpened = ref(false)      // 莊家已開牌(本地)
const myFlipped = ref<Set<number>>(new Set())
const revealLocalDeadline = ref(0)
const revealComplete = computed(() => {
  const s = state.value
  if (!s || s.status !== 'SETTLED') return true
  if (s.revealComplete !== false) return true
  return revealLocalDeadline.value > 0 && nowMs.value > revealLocalDeadline.value + 1500
})
const revealPhase = computed(() => state.value?.status === 'SETTLED' && !revealComplete.value)
// 莊家亮牌後(莊家自己開了 / 已揭曉 / 到期)所有人才看到牌與輸贏
const bankerShown = computed(() => (bankerIsMe.value && handOpened.value) || !!state.value?.bankerRevealed || revealComplete.value)
const resultShown = computed(() => showResult.value && bankerShown.value && !resultsCleared.value)
// 是否顯示「本局結果盤面」(莊家牌 + 位置牌 + 輸贏);清空後回到乾淨選位盤
const boardVisible = computed(() => showResult.value && !resultsCleared.value)
let clearTimer: number | undefined
function scheduleClearBoard() {
  if (resultsCleared.value || clearTimer) return
  clearTimer = window.setTimeout(() => { resultsCleared.value = true }, 5000)
}
function resetClearBoard() {
  resultsCleared.value = false
  if (clearTimer) { clearTimeout(clearTimer); clearTimer = undefined }
}

// 顯示用餘額:結算後在莊家亮牌前先當作沒被扣,避免從餘額偷看輸贏
const heldOrig = ref<number | null>(null)
const displayBalance = computed(() => {
  const s = state.value
  const real = Number(s?.myBalance ?? 0)
  if (!s) return real
  if (s.status === 'BETTING') return real + myRoundTotal.value * maxMult.value // 加回凍結,看起來還沒被扣
  if (s.status === 'SETTLED' && !bankerShown.value) return heldOrig.value != null ? heldOrig.value : real
  return real
})
const heldBankroll = ref<number | null>(null)
const displayBankroll = computed(() => {
  const s = state.value
  const real = Number(s?.bankroll ?? 0)
  if (s?.status === 'SETTLED' && !bankerShown.value) return heldBankroll.value != null ? heldBankroll.value : real
  return real
})
const revealCountdown = computed(() => {
  if (state.value?.status !== 'SETTLED' || revealLocalDeadline.value <= 0) return 0
  return Math.max(0, Math.ceil((revealLocalDeadline.value - nowMs.value) / 1000))
})
// 莊家搓的那手牌(=莊家自己的牌)
const squeezeHand = computed<string[]>(() => (state.value?.bankerCards as string[] | undefined) ?? [])
const pointVal = (code: string): number => {
  const r = rankLabel(code)
  if (r === 'A') return 1
  if (r === 'J' || r === 'Q' || r === 'K' || r === '10') return 10
  return Number(r) || 0
}
const flippedSum = computed(() => squeezeHand.value.reduce((s, c, i) => (myFlipped.value.has(i) ? s + pointVal(c) : s), 0))

// 可選位置 / 可下注
const canSelectPos = computed(() =>
  !!state.value?.niuniuEnabled && hasBanker.value && !bankerIsMe.value && !closing.value && !revealing.value && revealComplete.value)
const canBet = computed(() =>
  canSelectPos.value && selectedPos.value >= 1 && selectedPos.value <= 4 &&
  effectiveBet.value > 0 && !belowMin.value && !overCap.value)
function cantBetReason(): string {
  const s = state.value
  if (!s?.niuniuEnabled) return '妞妞目前未開放'
  if (!hasBanker.value) return '目前沒有莊家，先坐莊或等人坐莊'
  if (bankerIsMe.value) return '你是莊家，不能玩自己的莊'
  if (closing.value) return '本局已封盤，等下一局再下注'
  if (revealing.value) return '發牌中…'
  if (revealPhase.value) return '等莊家開牌後才能開新局'
  if (selectedPos.value < 1) return '請先選一個位置（天／地／玄／黃）'
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
    const maxBet = Number(d.maxBet) || 2000000
    config.value = {
      enabled: !!d.enabled, betAmount: Number(d.betAmount), maxBet,
      maxMult: Number(d.maxMult) || 5, currency: d.currency ?? '',
      chips: (Array.isArray(d.chips) ? d.chips.map(Number) : []).filter((c: number) => c > 0 && c <= maxBet),
      payTable: d.payTable ?? [],
    }
  } catch (e) { console.error(e) }
}

let fetching = false
let initialized = false
let lastSettledRound: number | null = null
let revealAutoTimer: number | undefined
let busy = false
function myTotalOf(d: State) { return (d.positions ?? []).reduce((s, p) => s + Number(p.myBet || 0), 0) }
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
    revealLocalDeadline.value = (d.status === 'SETTLED' && !d.revealComplete) ? Date.now() + Number(d.revealRemainingMs || 0) : 0

    if (!initialized) {
      initialized = true
      if (d.status === 'SETTLED') { lastSettledRound = d.roundId; setupReveal(d, false) }
    } else if (d.status === 'SETTLED' && d.roundId && d.roundId !== lastSettledRound && prevStatus === 'BETTING') {
      lastSettledRound = d.roundId
      setupReveal(d, true)
    } else if (d.status === 'SETTLED' && d.revealComplete && bankerIsMe.value && !handOpened.value) {
      forceOpen()
    }
    if (d.status === 'BETTING') {
      squeezeMode.value = false; handOpened.value = false; resetClearBoard(); if (revealAutoTimer) clearTimeout(revealAutoTimer)
      heldOrig.value = Number(d.myBalance ?? 0) + myTotalOf(d) * (Number(d.maxMult) || 5)
      heldBankroll.value = d.bankroll != null ? Number(d.bankroll) : null
    }
  } catch (e) { console.error(e) } finally { fetching = false }
}

// 進入開牌階段
function setupReveal(d: State, fresh: boolean) {
  handOpened.value = false
  myFlipped.value = new Set()
  outcomePlayed = !fresh
  resetClearBoard() // 新的一局:先取消清空、顯示新結果
  if (revealAutoTimer) clearTimeout(revealAutoTimer)
  if (d.revealComplete) { squeezeMode.value = false; handOpened.value = true; if (fresh) void playReveal(d); scheduleClearBoard(); return }
  if (bankerIsMe.value) {
    const hand = d.bankerCards && d.bankerCards.length === 5 ? d.bankerCards : null
    if (!hand || d.bankerRevealed || autoOpen.value) {
      squeezeMode.value = false; handOpened.value = true
      if (fresh) { void playReveal(d); if (hand && !d.bankerRevealed) notifyReveal() }
    } else {
      squeezeMode.value = true // 莊家搓自己的牌
      if (fresh) { ensureAudio(); playDealSound() }
    }
  } else {
    // 閒家:等莊家開牌
    squeezeMode.value = false; handOpened.value = false
    if (fresh) { ensureAudio(); playDealSound() }
  }
  armRevealAutoOpen(Number(d.revealRemainingMs || 0))
}
function armRevealAutoOpen(remainingMs: number) {
  if (revealAutoTimer) clearTimeout(revealAutoTimer)
  revealAutoTimer = window.setTimeout(() => {
    if (bankerIsMe.value && !handOpened.value) openHand(false)
    fetchRound()
  }, Math.max(0, remainingMs) + 1000)
}
function forceOpen() {
  if (revealAutoTimer) clearTimeout(revealAutoTimer)
  myFlipped.value = new Set([0, 1, 2, 3, 4])
  handOpened.value = true
  squeezeMode.value = false
  loadBoards()
}
let outcomePlayed = false
function revealOutcome(d: State) {
  if (bankerIsMe.value) {
    const net = (d.bets ?? []).reduce((s, b) => s - Number(b.settleAmount || 0), 0)
    if (net > 0) playWin(); else if (net < 0) playLose()
    return
  }
  const mine = (d.bets ?? []).filter((b) => b.mine)
  if (!mine.length) return
  const pool = mine.reduce((s, b) => s + Number(b.poolWin || 0), 0)
  const net = mine.reduce((s, b) => s + Number(b.settleAmount || 0), 0)
  if (pool > 0) { celebrate.value = `🐮 五小牛中彩金池 +${fmt(pool)}！`; playJackpot() }
  else if (net > 0) { playWin() } else if (net < 0) { playLose() }
  if (celebrate.value) { if (celeTimer) clearTimeout(celeTimer); celeTimer = window.setTimeout(() => (celebrate.value = ''), 4000) }
}
watch(bankerShown, (shown) => {
  if (shown && showResult.value) {
    if (!outcomePlayed && state.value) { outcomePlayed = true; revealOutcome(state.value) }
    scheduleClearBoard() // 結果亮出後 5 秒清空
  }
})
async function playReveal(d: State) {
  revealing.value = true
  playDealSound()
  await delay(1300)
  revealing.value = false
  loadBoards()
}
// 莊家翻自己的一張牌
function flipCard(i: number) {
  if (!squeezeMode.value || handOpened.value || myFlipped.value.has(i)) return
  const s = new Set(myFlipped.value); s.add(i); myFlipped.value = s
  ensureAudio(); playFlip(); vibrate(18)
  if (s.size >= 5) openHand(true)
}
// 莊家開牌:揭曉莊家 + 4 位置 + 結果
function openHand(notify = true) {
  if (handOpened.value) return
  if (revealAutoTimer) clearTimeout(revealAutoTimer)
  myFlipped.value = new Set([0, 1, 2, 3, 4])
  handOpened.value = true
  squeezeMode.value = false
  loadBoards()
  if (notify) notifyReveal()
}
async function notifyReveal() {
  try { await fetch(`${API}/niuniu/reveal`, { method: 'POST', headers: headers() }); await fetchRound() } catch (e) { console.error(e) }
}
function toggleAutoOpen() {
  autoOpen.value = !autoOpen.value
  localStorage.setItem('niu_autoopen', autoOpen.value ? 'on' : 'off')
}
function vibrate(ms: number) { try { navigator.vibrate?.(ms) } catch { /* ignore */ } }
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function placeBet() {
  if (!canBet.value || busy) return
  busy = true; ensureAudio()
  try {
    const res = await fetch(`${API}/niuniu/bet`, { method: 'POST', headers: headers(), body: JSON.stringify({ position: selectedPos.value, amount: effectiveBet.value }) })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '下注失敗'); return }
    squeezeMode.value = false; handOpened.value = false
    if (revealAutoTimer) clearTimeout(revealAutoTimer)
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
function playFlip() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime; tone(t, 520, 0.05, 0.12, 'square'); tone(t + 0.04, 880, 0.07, 0.12, 'triangle') }
function playDealSound() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; let t = c.currentTime; for (let i = 0; i < 6; i++) { tone(t, 900 + Math.random() * 500, 0.06, 0.1, 'triangle'); t += 0.09 } }
function playWin() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.1, f, 0.26, 0.16, 'triangle')) }
function playLose() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[330, 262, 196].forEach((f, i) => tone(t + i * 0.13, f, 0.28, 0.12, 'sine')) }
function playJackpot() { if (!sfxOn.value) return; const c = ensureAudio(); if (!c) return; const t = c.currentTime;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.11, f, 0.3, 0.18, 'sawtooth')) }
function toggleSfx() { sfxOn.value = !sfxOn.value; localStorage.setItem('niu_sfx', sfxOn.value ? 'on' : 'off'); if (sfxOn.value) playChip() }

// ---- 背景音樂 ----
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
  if (ws) ws.disconnect(); if (tickTimer) clearInterval(tickTimer); if (heartbeat) clearInterval(heartbeat); if (celeTimer) clearTimeout(celeTimer); if (revealAutoTimer) clearTimeout(revealAutoTimer); if (clearTimer) clearTimeout(clearTimer)
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
        <div class="niu-title">🐮 百人牛牛 <span class="niu-sub">押天地玄黃 · 比莊家</span>
          <div class="niu-audioctrl">
            <button v-if="bankerIsMe" class="niu-audio" :class="{ off: !autoOpen }" :title="autoOpen ? '自動開牌中(點我改手動搓牌)' : '手動搓牌(點我改自動開牌)'" @click="toggleAutoOpen">{{ autoOpen ? '⚡' : '🎴' }}</button>
            <button class="niu-audio" :class="{ off: !bgmOn }" :title="bgmOn ? '關背景音樂' : '開背景音樂'" @click="toggleBgm">{{ bgmOn ? '🎵' : '🔇' }}</button>
            <input v-if="bgmOn" class="niu-vol" type="range" min="0" max="1" step="0.05" :value="bgmVolume" @input="setBgmVolume(($event.target as HTMLInputElement).value)" />
            <button class="niu-audio" :class="{ off: !sfxOn }" :title="sfxOn ? '關音效' : '開音效'" @click="toggleSfx">{{ sfxOn ? '🔊' : '🔈' }}</button>
          </div>
        </div>
        <div class="niu-stats">
          <div class="niu-stat"><span>彩金池</span><b>{{ config.currency }} {{ fmt(state?.poolBalance) }}</b></div>
          <div class="niu-stat"><span>我的餘額</span><b>{{ config.currency }} {{ fmt(displayBalance) }}</b></div>
        </div>
      </div>

      <div v-if="loading" class="niu-empty">載入中…</div>
      <div v-else-if="!state?.niuniuEnabled" class="niu-empty">
        🚫 本血盟尚未開放妞妞<br /><small>請管理員到「設置」開啟</small>
        <!-- 遊戲關閉時,若你仍是莊家,保留下莊退款入口,避免本金被卡住 -->
        <div v-if="bankerIsMe" class="niu-locked-bank">
          <div class="niu-locked-bank-info">👑 你目前仍是莊家，本金 <b>{{ fmt(state?.bankroll) }} {{ config.currency }}</b> 還託管在莊家座位</div>
          <button class="niu-btn leave" @click="leaveBank">下莊並退回本金</button>
        </div>
      </div>

      <template v-else>
        <div class="niu-online">🟢 在線 {{ state?.online?.length ?? 0 }} 人：{{ (state?.online ?? []).join('、') || '—' }}</div>

        <!-- 莊家列 -->
        <div class="niu-banker">
          <template v-if="hasBanker">
            <span class="niu-banker-info">👑 莊家 <b>{{ state?.bankerName }}</b> · 本金 {{ fmt(displayBankroll) }} {{ config.currency }}</span>
            <button v-if="bankerIsMe" class="niu-btn leave" @click="leaveBank">下莊</button>
            <button v-else class="niu-btn take" @click="takeBank">搶莊</button>
          </template>
          <template v-else>
            <span class="niu-banker-info muted">目前沒有莊家</span>
            <button class="niu-btn take" @click="takeBank">我要坐莊</button>
          </template>
        </div>

        <!-- 牌桌 -->
        <div class="niu-table">
          <div class="niu-table-head">
            <span v-if="revealing">🃏 發牌中…</span>
            <span v-else-if="state?.status === 'BETTING'">🪙 下注中 · 選位置押莊</span>
            <span v-else-if="boardVisible && squeezeMode && !handOpened">🎴 莊家翻牌中</span>
            <span v-else-if="boardVisible && !bankerShown">⏳ 等莊家開牌</span>
            <span v-else-if="boardVisible">🏆 本局結果</span>
            <span v-else>🆕 選位置押莊 · 下注開新局</span>
            <span v-if="countdown > 0" class="niu-countdown" :class="{ urgent: countdown <= 10 }">⏱ {{ countdown }}s</span>
          </div>

          <!-- 莊家座:結算後顯示莊家的牌(清空後隱藏) -->
          <div v-if="boardVisible" class="niu-bankerhand">
            <!-- 莊家自己搓牌 -->
            <div v-if="squeezeMode && !handOpened && bankerIsMe" class="niu-squeeze">
              <div class="niu-squeeze-tip">
                👑 你是莊家，翻開你的牌——點牌或按「開牌」，開了大家才看到輸贏 👀
                <span class="niu-squeeze-sub">時間到（{{ revealCountdown }}s）系統自動代開</span>
              </div>
              <div class="niu-myhand">
                <span v-for="(c, i) in squeezeHand" :key="i" class="niu-card big" :class="myFlipped.has(i) ? suitClass(c) : 'back'" @click="flipCard(i)">
                  <template v-if="myFlipped.has(i)"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></template>
                  <template v-else>🐮</template>
                </span>
              </div>
              <div class="niu-squeeze-status">已翻 {{ myFlipped.size }}/5 · 目前合計 <b>{{ flippedSum }}</b> 點</div>
              <div class="niu-squeeze-acts">
                <button class="niu-btn take" @click="openHand(true)">🎴 開牌</button>
                <label class="niu-autoopen"><input type="checkbox" :checked="autoOpen" @change="toggleAutoOpen" /> 下次自動開牌</label>
              </div>
            </div>
            <!-- 莊家的牌(揭曉後) -->
            <div v-else class="niu-hand banker">
              <span class="niu-hand-tag">👑 莊<template v-if="bankerShown"> · <b>{{ state?.bankerLabel }}</b></template><template v-else> · 待開牌…</template></span>
              <span v-if="bankerShown && state?.bankerCards" class="niu-cards" :class="{ flip: !revealing }">
                <span v-for="(c, i) in state.bankerCards" :key="i" class="niu-card" :class="suitClass(c)"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></span>
              </span>
              <span v-else class="niu-cards">
                <span v-for="i in 5" :key="i" class="niu-card back nb">🐮</span>
              </span>
            </div>
          </div>

          <!-- 4 位置(天地玄黃):下注/結果 -->
          <div class="niu-positions">
            <div
              v-for="p in positions"
              :key="p.index"
              class="niu-pos"
              :class="{
                sel: selectedPos === p.index && canSelectPos,
                pick: canSelectPos,
                mine: p.myBet > 0,
                win: resultShown && p.won,
                lose: resultShown && p.cards && !p.won,
              }"
              @click="selectPos(p.index)"
            >
              <div class="niu-pos-head">
                <span class="niu-pos-zh">{{ p.zh }}</span>
                <span v-if="resultShown && p.cards" class="niu-pos-badge" :class="p.won ? 'w' : 'l'">{{ p.won ? '贏莊' : '輸莊' }}</span>
                <span v-else-if="selectedPos === p.index && canSelectPos" class="niu-pos-badge sel">已選</span>
              </div>
              <!-- 結算後:牌 + 牛型(清空後回乾淨選位盤) -->
              <template v-if="boardVisible">
                <div v-if="resultShown && p.cards" class="niu-pos-cards">
                  <span v-for="(c, i) in p.cards" :key="i" class="niu-card sm" :class="suitClass(c)"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></span>
                </div>
                <div v-else class="niu-pos-cards">
                  <span v-for="i in 5" :key="i" class="niu-card sm back nb">🐮</span>
                </div>
                <div class="niu-pos-label">{{ resultShown && p.cards ? p.label : '待開牌…' }}</div>
              </template>
              <!-- 押注彙總 + 誰押多少 -->
              <div class="niu-pos-bet">
                <span class="tot">押 {{ fmt(p.totalBet) }}</span>
                <span class="cnt">{{ posBettors(p.index).length }} 人</span>
              </div>
              <div v-if="posBettors(p.index).length" class="niu-pos-players">
                <span v-for="b in posBettors(p.index)" :key="b.memberId" class="niu-pp" :class="{ mine: b.mine }">{{ b.mine ? '我' : b.userName }} <b>{{ fmt(b.amount) }}</b></span>
              </div>
              <!-- 我在此位置的輸贏 -->
              <div v-if="resultShown && p.myBet > 0" class="niu-pos-my" :class="{ pos: myRes(p.index).settle > 0, neg: myRes(p.index).settle < 0 }">
                {{ myRes(p.index).settle >= 0 ? '+' : '' }}{{ fmt(myRes(p.index).settle) }}
                <span v-if="myRes(p.index).pool > 0">🐮+{{ fmt(myRes(p.index).pool) }}</span>
              </div>
            </div>
          </div>
          <p v-if="!showResult && !hasBanker" class="niu-noplayers">等莊家就位後即可開局</p>
        </div>

        <!-- 開牌階段:閒家等莊家開牌(莊家自己有搓牌框,不重複提示) -->
        <div v-if="revealPhase && !bankerIsMe" class="niu-reveal-bar">
          <span class="niu-reveal-main">🎴 等莊家開牌</span>
          <span class="niu-reveal-cd" :class="{ urgent: revealCountdown <= 5 }">⏱ {{ revealCountdown }}s</span>
          <span class="niu-reveal-hint">莊家開牌或時間到即揭曉</span>
        </div>

        <!-- 下注區(非莊家):上面的 4 個位置格就是選擇器,點格子選位置 -->
        <div v-else-if="!bankerIsMe" class="niu-betbox">
          <div class="niu-chips">
            <span class="niu-label">籌碼</span>
            <div class="niu-chip-grid">
              <button v-for="c in config.chips" :key="c" class="niu-chip" @click="addChip(c)">+{{ chipLabel(c) }}</button>
              <button class="niu-chip clear" @click="clearBet">清空</button>
            </div>
          </div>
          <div class="niu-amount-row">
            <span class="niu-label">金額</span>
            <input v-model.number="betAmountInput" type="number" class="niu-amount" :class="{ bad: belowMin || overCap }" :min="minBet" step="1" placeholder="下注金額" />
          </div>
          <div class="niu-bethint">
            押 <b>{{ selectedPos >= 1 ? (positions[selectedPos - 1]?.zh ?? '—') : '—' }}</b> <b>{{ fmt(effectiveBet) }}</b>（凍結 {{ fmt(escrowNeeded) }}，最多可輸）· 最小 {{ fmt(minBet) }} · 此注上限 <b :class="{ over: overCap }">{{ fmt(maxBetForCurrent) }}</b>
          </div>
          <button class="niu-roll" :disabled="!canBet || busy" @click="placeBet">
            {{ closing ? '🔒 封盤中…' : revealing ? '開牌中…' : state?.status === 'BETTING' ? '🪙 下注' : '🪙 下注開新局' }}
          </button>
          <p v-if="!canBet" class="niu-ineligible">{{ cantBetReason() }}</p>
        </div>

        <!-- 莊家:結算後等玩家下注開新局 -->
        <div v-else-if="bankerIsMe && showResult && revealComplete" class="niu-reveal-bar">
          <span class="niu-reveal-main">🏆 本局結束</span>
          <span class="niu-reveal-hint">你是莊家 · 等玩家下注即開新局</span>
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
          <summary>📜 玩法 / 賠率</summary>
          <p>百人牛牛：1 位莊家對 <b>天地玄黃</b> 4 個位置。你押注哪個位置，就代表你賭「那個位置的牌」贏過莊家。4 個位置只跟莊家比，不互相比。</p>
          <p>每個位置 5 張牌。任 3 張加總是 10 的倍數 = 有牛，剩 2 張總和個位數 = 牛幾（0=牛牛）；湊不出 = 沒牛。位置牛大於莊 → 押它的人贏，依<b>該位置的牛</b>給倍數；否則輸，依<b>莊家的牛</b>倍數。<b>同牛同點莊家通吃</b>（莊家優勢）。</p>
          <p>倍率：<span v-for="(p, i) in config.payTable" :key="i">{{ p.zh }} ×{{ p.mult }}<span v-if="i < config.payTable.length - 1">、</span></span></p>
          <p>下注 X 最多可能輸 {{ maxMult }}X（下注時凍結 {{ maxMult }}X），結算退回沒輸的部分。押中五小牛的位置額外分共用彩金池。</p>
        </details>
      </template>
    </div>

    <!-- 聊天室 -->
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
.niu-title { font-size: 20px; font-weight: 800; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
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
.niu-locked-bank { margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; align-items: center; gap: 12px; }
.niu-locked-bank-info { font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; }
.niu-locked-bank-info b { color: var(--c-light); }
.niu-online { font-size: 12px; color: #94a3b8; background: #131722; border-radius: 8px; padding: 6px 10px; }
.niu-banker { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; font-size: 0.85rem; }
.niu-banker-info { color: #e2e8f0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.niu-banker-info b { color: var(--c-light); }
.niu-banker-info.muted { color: #94a3b8; }
.niu-btn { flex-shrink: 0; border: none; border-radius: 10px; padding: 10px 22px; font-weight: 700; cursor: pointer; font-size: 0.95rem; line-height: 1; transition: filter .15s; }
.niu-btn:hover { filter: brightness(1.08); }
.niu-btn.take { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: var(--c-on); }
.niu-btn.leave { background: #334155; color: #f1f5f9; }
.niu-table { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; }
.niu-table-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 10px; }
.niu-countdown { color: #fbbf24; font-variant-numeric: tabular-nums; }
.niu-countdown.urgent { color: #f87171; }
.niu-bankerhand { margin-bottom: 12px; }
.niu-hand.banker { background: rgba(var(--c-light-rgb),.08); border: 1px solid rgba(var(--c-light-rgb),.3); border-radius: 10px; padding: 8px 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.niu-hand-tag { font-size: 13px; }
.niu-hand-tag b { color: var(--c-light); }
.niu-cards { display: flex; gap: 4px; }
.niu-card { width: 36px; height: 50px; border-radius: 6px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; line-height: 1; }
.niu-card .r { font-size: 15px; } .niu-card .s { font-size: 16px; }
.niu-card.sm { width: 26px; height: 37px; } .niu-card.sm .r { font-size: 11px; } .niu-card.sm .s { font-size: 12px; }
.niu-card.su-s { color: #0f172a; } .niu-card.su-h { color: #e11d48; } .niu-card.su-d { color: #2563eb; } .niu-card.su-c { color: #15a34a; }
.niu-cards.flip .niu-card { animation: niu-flip .4s ease both; }
.niu-cards.flip .niu-card:nth-child(2) { animation-delay: .06s; } .niu-cards.flip .niu-card:nth-child(3) { animation-delay: .12s; }
.niu-cards.flip .niu-card:nth-child(4) { animation-delay: .18s; } .niu-cards.flip .niu-card:nth-child(5) { animation-delay: .24s; }
@keyframes niu-flip { from { opacity: 0; transform: rotateY(-90deg) translateY(8px); } to { opacity: 1; transform: rotateY(0) translateY(0); } }
/* 莊家搓牌 */
.niu-squeeze { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 14px 0 6px; }
.niu-squeeze-tip { font-size: 13px; color: var(--c-light); font-weight: 700; text-align: center; line-height: 1.6; }
.niu-squeeze-sub { display: block; font-size: 11px; color: #94a3b8; font-weight: 400; }
.niu-myhand { display: flex; gap: 8px; }
.niu-card.big { width: 56px; height: 80px; }
.niu-card.big .r { font-size: 21px; } .niu-card.big .s { font-size: 23px; }
.niu-card.big:not(.back) { animation: niu-flip .35s ease both; }
.niu-card.big.back { font-size: 28px; }
.niu-card.back { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: rgba(255,255,255,.55); border: 1px solid rgba(var(--c-light-rgb),.5); cursor: pointer; transition: transform .12s, box-shadow .12s; }
.niu-card.back.nb { cursor: default; font-size: 18px; }
.niu-card.sm.back { font-size: 12px; }
.niu-card.big.back:hover { transform: translateY(-4px); box-shadow: 0 6px 14px rgba(var(--c-deep-rgb),.5); }
.niu-squeeze-status { font-size: 13px; color: #cbd5e1; }
.niu-squeeze-status b { color: var(--c-light); }
.niu-squeeze-acts { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; max-width: 340px; }
.niu-squeeze-acts .niu-btn { flex: 1 1 0; min-width: 0; height: 42px; padding: 0; display: inline-flex; align-items: center; justify-content: center; }
.niu-autoopen { flex: 1 1 0; min-width: 0; height: 42px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 1px solid rgba(var(--c-light-rgb),.3); border-radius: 10px; background: rgba(var(--c-light-rgb),.08); font-size: 0.82rem; color: #cbd5e1; cursor: pointer; }
.niu-autoopen input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; accent-color: var(--c-light); cursor: pointer; }
/* 4 位置格 */
.niu-positions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.niu-pos { box-sizing: border-box; min-width: 0; display: flex; flex-direction: column; gap: 6px; text-align: left; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px; color: inherit; cursor: default; font: inherit; transition: border-color .15s, background .15s; }
.niu-pos.pick { cursor: pointer; }
.niu-pos.pick:hover { border-color: rgba(var(--c-light-rgb),.6); }
.niu-pos.sel { outline: 2px solid var(--c-light); outline-offset: -2px; background: rgba(var(--c-light-rgb),.12); }
.niu-pos.mine { box-shadow: inset 0 0 0 1px rgba(var(--c-light-rgb),.4); }
.niu-pos.win { border-color: rgba(34,197,94,.6); background: rgba(34,197,94,.1); }
.niu-pos.lose { border-color: rgba(248,113,113,.5); background: rgba(248,113,113,.07); }
.niu-pos:disabled { cursor: default; }
.niu-pos-head { display: flex; align-items: center; gap: 6px; }
.niu-pos-zh { font-size: 18px; font-weight: 900; color: var(--c-light); }
.niu-pos-badge { font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 999px; }
.niu-pos-badge.w { background: rgba(34,197,94,.2); color: #86efac; }
.niu-pos-badge.l { background: rgba(248,113,113,.18); color: #fca5a5; }
.niu-pos-badge.sel { background: rgba(var(--c-light-rgb),.25); color: var(--c-light); }
.niu-pos-cards { display: flex; gap: 2px; }
/* 位置格內 5 張牌縮小,避免 2 欄在窄手機上撐爆按鈕 (22×5+gap ≈ 118px,320px 也放得下) */
.niu-pos-cards .niu-card { width: 22px; height: 31px; }
.niu-pos-cards .niu-card .r { font-size: 10px; }
.niu-pos-cards .niu-card .s { font-size: 11px; }
.niu-pos-cards .niu-card.back.nb { font-size: 12px; }
.niu-pos-label { font-size: 12px; font-weight: 700; color: #cbd5e1; }
.niu-pos-bet { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.niu-pos-bet .tot { color: #cbd5e1; font-weight: 700; }
.niu-pos-bet .cnt { color: #64748b; margin-left: auto; }
.niu-pos-players { display: flex; flex-wrap: wrap; gap: 4px; }
.niu-pp { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #94a3b8; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 1px 6px; }
.niu-pp b { color: #cbd5e1; font-weight: 700; }
.niu-pp.mine { color: var(--c-light); border-color: rgba(var(--c-light-rgb),.4); background: rgba(var(--c-light-rgb),.1); }
.niu-pp.mine b { color: var(--c-light); }
.niu-pos-my { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
.niu-pos-my.pos { color: #86efac; } .niu-pos-my.neg { color: #fca5a5; }
.niu-noplayers { color: #64748b; font-size: 13px; text-align: center; padding: 10px; }
.niu-reveal-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; background: rgba(var(--c-light-rgb),.08); border: 1px solid rgba(var(--c-light-rgb),.3); border-radius: 12px; padding: 12px 14px; font-size: 0.9rem; color: #e2e8f0; }
.niu-reveal-main { font-weight: 700; }
.niu-reveal-cd { color: #fbbf24; font-weight: 800; font-variant-numeric: tabular-nums; }
.niu-reveal-cd.urgent { color: #f87171; }
.niu-reveal-hint { font-size: 0.78rem; color: #94a3b8; }
.niu-betbox { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.niu-chips { display: flex; align-items: center; gap: 6px; }
.niu-label { font-size: 0.8rem; color: #94a3b8; width: 36px; flex-shrink: 0; }
.niu-chip-grid { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 6px; }
.niu-chip { height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; border-radius: 9px; border: 1px solid #2e3147; background: #0f111a; color: #cbd5e1; font-weight: 800; font-size: 0.85rem; white-space: nowrap; overflow: hidden; cursor: pointer; transition: all .15s; }
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
.niu-rules b { color: #cbd5e1; }
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
