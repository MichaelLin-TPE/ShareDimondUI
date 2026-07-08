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

interface SeatView {
  seatNo: number; occupied: boolean; memberId: number; userName: string; stack: number; bet: number
  inHand: boolean; folded: boolean; allIn: boolean; sittingOut: boolean; me: boolean; acting: boolean; button: boolean
  hole?: string[]; handLabel?: string; won: number; revealed: boolean
}
interface State {
  enabled: boolean; currency: string; smallBlind: number; bigBlind: number; minBuyIn: number; maxBuyIn: number; capacity: number
  myWallet: number; poolBalance: number; mySeatNo: number | null; online: string[]
  handNo: number; handRunning: boolean; street: string | null; board: string[]; pot: number; currentBet: number
  buttonSeat: number; actingSeat: number; actingDeadline: number | null; nextHandAt: number | null; summary: string
  myTurn: boolean; myToCall: number; myMinRaiseTo: number; myStack: number; canCheck: boolean
  seats: SeatView[]
}

const loading = ref(true)
const state = ref<State | null>(null)
const busy = ref(false)
const raiseTo = ref<number>(0)

// ---- 卡牌 ----
const SUIT: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const suitSym = (c?: string) => (c ? SUIT[c.slice(-1)] ?? '' : '')
const rankLabel = (c?: string) => (c ? c.slice(0, -1) : '')
const suitClass = (c?: string) => (c ? { C: 'su-c', D: 'su-d', H: 'su-h', S: 'su-s' }[c.slice(-1)] ?? 'su-s' : 'su-s')

// ---- 倒數 ----
const nowMs = ref(Date.now())
let tick: number | undefined
const actRemain = computed(() => {
  const d = state.value?.actingDeadline
  if (!d || !state.value?.handRunning) return 0
  return Math.max(0, Math.ceil((d - nowMs.value) / 1000))
})

// ---- 座位排列:把自己轉到最下方 ----
const anchor = computed(() => state.value?.mySeatNo ?? 0)
const seatsForDisplay = computed(() => {
  const cap = state.value?.capacity ?? 6
  return (state.value?.seats ?? []).map((s) => ({ ...s, dpos: ((s.seatNo - anchor.value + cap) % cap) }))
})
const mySeat = computed(() => state.value?.seats.find((s) => s.me) ?? null)
const seated = computed(() => state.value?.mySeatNo != null)
const streetZh: Record<string, string> = { PREFLOP: '翻牌前', FLOP: '翻牌', TURN: '轉牌', RIVER: '河牌', SHOWDOWN: '攤牌', DONE: '本手結束' }

// ---- API ----
let wasMyTurn = false
async function fetchState() {
  try {
    const res = await fetch(`${API}/holdem/state`, { headers: headers() })
    if (!res.ok) return
    const d: State = await res.json()
    const rising = d.myTurn && !wasMyTurn   // 只在「剛輪到我」那一刻預設加注額,之後不覆蓋使用者輸入
    wasMyTurn = d.myTurn
    state.value = d
    if (rising) raiseTo.value = Math.min(d.myMinRaiseTo, maxRaise.value)
  } catch (e) { console.error(e) }
}

async function post(path: string, body?: unknown) {
  if (busy.value) return
  busy.value = true
  try {
    const res = await fetch(`${API}${path}`, { method: 'POST', headers: headers(), body: body ? JSON.stringify(body) : undefined })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '操作失敗'); return }
    await fetchState()
  } catch (e) { console.error(e); useAlert.error('連線失敗') } finally { busy.value = false }
}

async function sit(seatNo: number) {
  const s = state.value; if (!s) return
  if (!s.enabled) { useAlert.error('本血盟尚未開放德州撲克'); return }
  const v = await useAlert.inputDialog('輸入買入金額', '坐下買入', `範圍 ${fmt(s.minBuyIn)} ~ ${fmt(s.maxBuyIn)}　錢包 ${fmt(s.myWallet)}`)
  const buyIn = Math.floor(Number(v))
  if (!buyIn || buyIn <= 0) return
  if (buyIn < s.minBuyIn || buyIn > s.maxBuyIn) { useAlert.error(`買入需在 ${fmt(s.minBuyIn)} ~ ${fmt(s.maxBuyIn)} 之間`); return }
  if (buyIn > Number(s.myWallet)) { useAlert.error('錢包餘額不足'); return }
  await post('/holdem/sit', { seatNo, buyIn })
}
async function leaveTable() {
  const ok = await useAlert.confirm('確定離桌?剩餘籌碼換回錢包(若在手牌中,這手結束後結算)')
  if (!ok?.isConfirmed) return
  await post('/holdem/leave')
}
async function rebuy() {
  const s = state.value; if (!s) return
  const v = await useAlert.inputDialog('輸入加碼金額', '加碼', `加碼後不超過 ${fmt(s.maxBuyIn)}`)
  const amount = Math.floor(Number(v)); if (!amount || amount <= 0) return
  await post('/holdem/rebuy', { amount })
}
const act = (action: string, amount = 0) => post('/holdem/act', { action, amount })
function doRaise() {
  const s = state.value; if (!s) return
  const to = Math.min(Math.max(Math.floor(raiseTo.value || 0), s.myMinRaiseTo), maxRaise.value) // 夾在 [最小加注, 全下]
  act(s.currentBet === 0 ? 'BET' : 'RAISE', to)
}
// 快速下注尺寸(加注到的總額)
const maxRaise = computed(() => (mySeat.value?.bet ?? 0) + (state.value?.myStack ?? 0))
function sizePot() {
  const s = state.value; if (!s) return
  const to = s.currentBet + s.pot + s.myToCall
  raiseTo.value = Math.min(Math.max(to, s.myMinRaiseTo), maxRaise.value)
}
function sizeHalf() {
  const s = state.value; if (!s) return
  const to = s.currentBet + Math.floor((s.pot + s.myToCall) / 2)
  raiseTo.value = Math.min(Math.max(to, s.myMinRaiseTo), maxRaise.value)
}
const raiseValid = computed(() => {
  const s = state.value; if (!s) return false
  const v = Math.floor(raiseTo.value)
  return v >= s.myMinRaiseTo && v <= maxRaise.value
})
const canBetRaise = computed(() => {
  const s = state.value; if (!s || !s.myTurn) return false
  return maxRaise.value >= s.myMinRaiseTo // 能合法加注到至少 min-raise;否則(短碼)只剩全下,走 All-in 鈕
})
const nextRemain = computed(() => {
  const n = state.value?.nextHandAt
  if (!n || state.value?.handRunning) return 0
  return Math.max(0, Math.ceil((n - nowMs.value) / 1000))
})
// ---- 聊天室 ----
interface ChatMsg { userName: string; text: string; ts: number }
const messages = ref<ChatMsg[]>([])
const chatText = ref('')
const chatOpen = ref(true)
const chatBox = ref<HTMLElement | null>(null)
async function loadChat() {
  try {
    const res = await fetch(`${API}/holdem/chat`, { headers: headers() })
    if (!res.ok) return
    messages.value = await res.json()
    nextTick(() => { if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight })
  } catch (e) { console.error(e) }
}
async function sendChat() {
  const text = chatText.value.trim()
  if (!text) return
  chatText.value = ''
  try {
    const res = await fetch(`${API}/holdem/chat`, { method: 'POST', headers: headers(), body: JSON.stringify({ text }) })
    if (!res.ok) { const d = await res.json().catch(() => null); useAlert.error(d?.message ?? '傳送失敗'); return }
    loadChat()
  } catch (e) { console.error(e); useAlert.error('連線失敗') }
}

const waitMsg = computed(() => {
  const s = state.value
  if (!s) return ''
  if (!s.handRunning) return '等待開局…'
  if (s.actingSeat < 0) return '🃏 發牌中…'   // 全下逐街發牌 / 攤牌前
  return '等待其他玩家行動…'
})

// ---- 生命週期 ----
let ws: StompHandle | null = null
let poll: number | undefined
onMounted(async () => {
  loading.value = true
  await fetchState()
  loadChat()
  loading.value = false
  const clanId = authStore.member?.clanId
  if (clanId) ws = createReconnectingStomp(`/topic/holdem/${clanId}`, (b) => { if (b === 'HOLDEM_UPDATED') fetchState(); else if (b === 'HOLDEM_CHAT') loadChat() })
  tick = window.setInterval(() => (nowMs.value = Date.now()), 250)
  poll = window.setInterval(() => { if (!document.hidden || seated.value) fetchState() }, 3000) // 在座就持續心跳(免被當離線換回錢包);純觀戰且分頁隱藏才停
})
onUnmounted(() => {
  if (ws) ws.disconnect(); if (tick) clearInterval(tick); if (poll) clearInterval(poll)
})
</script>

<template>
  <div class="hold-page">
    <div class="hold-head">
      <div class="hold-title">🃏 德州撲克 <span class="hold-sub">No-Limit · 6 人現金桌</span></div>
      <div class="hold-stats">
        <div class="hold-stat"><span>彩金池</span><b>{{ state?.currency }} {{ fmt(state?.poolBalance) }}</b></div>
        <div class="hold-stat"><span>錢包</span><b>{{ state?.currency }} {{ fmt(state?.myWallet) }}</b></div>
      </div>
    </div>

    <div v-if="loading" class="hold-empty">載入中…</div>
    <div v-else-if="!state?.enabled" class="hold-empty">🚫 本血盟尚未開放德州撲克<br /><small>請管理員到「設置」開啟</small></div>

    <template v-else>
      <div class="hold-info">
        <span>盲注 {{ fmt(state.smallBlind) }}/{{ fmt(state.bigBlind) }}</span>
        <span v-if="state.handRunning">· 第 {{ state.handNo }} 手 · {{ streetZh[state.street ?? ''] ?? '' }}</span>
        <span v-else>· 等待玩家…(≥2 人自動開局)</span>
      </div>

      <div v-if="(state.online?.length ?? 0) > 0" class="hold-online">
        🟢 在房間 {{ state.online.length }} 人：
        <span v-for="(n, i) in state.online" :key="i" class="hold-online-name">{{ n }}</span>
      </div>

      <!-- 牌桌 -->
      <div class="hold-felt">
        <div class="hold-center">
          <div class="hold-board">
            <template v-for="i in 5" :key="i">
              <span v-if="state.board && state.board[i - 1]" class="hold-card sm" :class="suitClass(state.board[i - 1])">
                <span class="r">{{ rankLabel(state.board[i - 1]) }}</span><span class="s">{{ suitSym(state.board[i - 1]) }}</span>
              </span>
              <span v-else class="hold-card sm slot"></span>
            </template>
          </div>
          <div class="hold-pot">底池 {{ fmt(state.pot) }}</div>
          <div v-if="!state.handRunning && state.summary" class="hold-summary">{{ state.summary }}</div>
          <div v-if="!state.handRunning && nextRemain > 0" class="hold-next">下一手 {{ nextRemain }}s</div>
        </div>

        <div v-for="s in seatsForDisplay" :key="s.seatNo" class="hold-seat" :class="[`d${s.dpos}`, { empty: !s.occupied, folded: s.folded, acting: s.acting, me: s.me, winner: s.won > 0 }]">
          <template v-if="s.occupied">
            <div class="hold-seat-cards">
              <template v-if="s.hole && s.hole.length">
                <span v-for="(c, i) in s.hole" :key="i" class="hold-card" :class="[suitClass(c), s.me ? 'mine' : 'xs']"><span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span></span>
              </template>
              <template v-else-if="s.inHand && !s.folded">
                <span class="hold-card xs back">🂠</span><span class="hold-card xs back">🂠</span>
              </template>
            </div>
            <div class="hold-seat-body">
              <div class="hold-seat-name">
                <span v-if="s.button" class="hold-dealer">D</span>{{ s.userName }}
                <span v-if="s.allIn" class="hold-tag allin">All-in</span>
                <span v-else-if="s.folded" class="hold-tag fold">蓋牌</span>
                <span v-else-if="s.sittingOut" class="hold-tag out">暫離</span>
              </div>
              <div class="hold-seat-stack">💰 {{ fmt(s.stack) }}</div>
              <div v-if="s.handLabel" class="hold-seat-label">{{ s.handLabel }}</div>
              <div v-if="s.won > 0" class="hold-seat-won">贏 +{{ fmt(s.won) }}</div>
            </div>
            <div v-if="s.acting" class="hold-timer">{{ actRemain }}</div>
            <div v-if="s.bet > 0" class="hold-bet">{{ fmt(s.bet) }}</div>
          </template>
          <button v-else class="hold-sit" :disabled="seated || busy" @click="sit(s.seatNo)">＋ 坐這</button>
        </div>
      </div>

      <!-- 行動列 -->
      <div v-if="seated" class="hold-actions">
        <div class="hold-actbar-top">
          <span v-if="state.myTurn" class="hold-actbar-timer" :class="{ urgent: actRemain <= 5 }">⏳ {{ actRemain }}s</span>
          <span v-else class="hold-wait">{{ waitMsg }}</span>
          <span class="hold-mybar">
            <button class="hold-mini" :disabled="busy" @click="rebuy">加碼</button>
            <button class="hold-mini" :disabled="busy" @click="leaveTable">離桌</button>
          </span>
        </div>
        <template v-if="state.myTurn">
          <div v-if="canBetRaise" class="hold-raise-row">
            <input class="hold-raise-in" type="number" v-model.number="raiseTo" :min="state.myMinRaiseTo" :max="maxRaise" placeholder="加注金額" />
            <div class="hold-chips">
              <button class="hold-chip" @click="sizeHalf">½池</button>
              <button class="hold-chip" @click="sizePot">滿池</button>
              <button class="hold-chip" @click="raiseTo = maxRaise">全下</button>
            </div>
          </div>
          <div class="hold-main-row">
            <button class="hold-btn fold" :disabled="busy" @click="act('FOLD')">棄牌</button>
            <button v-if="state.canCheck" class="hold-btn check" :disabled="busy" @click="act('CHECK')">過牌</button>
            <button v-else class="hold-btn call" :disabled="busy" @click="act('CALL')">跟注 {{ fmt(state.myToCall) }}</button>
            <button v-if="canBetRaise" class="hold-btn raise" :disabled="busy || !raiseValid" @click="doRaise">
              {{ state.currentBet === 0 ? '下注' : '加注' }} {{ fmt(raiseTo) }}
            </button>
            <button v-else class="hold-btn allin" :disabled="busy" @click="act('ALLIN')">全下 {{ fmt(state.myStack) }}</button>
          </div>
        </template>
      </div>
      <div v-else class="hold-actions">
        <div class="hold-wait" style="text-align:center">點空位坐下買入即可開玩(需 ≥2 人)</div>
      </div>

      <!-- 賭桌聊天 -->
      <div class="hold-chat">
        <button class="hold-chat-toggle" @click="chatOpen = !chatOpen">💬 賭桌聊天 <span>{{ chatOpen ? '▲' : '▼' }}</span></button>
        <div v-if="chatOpen" class="hold-chat-body">
          <div ref="chatBox" class="hold-chat-msgs">
            <div v-if="!messages.length" class="hold-chat-empty">還沒有人說話,來聊兩句 💬</div>
            <div v-for="(m, i) in messages" :key="i" class="hold-chat-msg"><b>{{ m.userName }}</b><span>{{ m.text }}</span></div>
          </div>
          <div class="hold-chat-input">
            <input v-model="chatText" maxlength="100" placeholder="說點什麼…(Enter 送出)" @keyup.enter="sendChat" />
            <button :disabled="!chatText.trim()" @click="sendChat">送出</button>
          </div>
        </div>
      </div>

      <details class="hold-rules">
        <summary>📜 玩法</summary>
        <p>每人 2 張底牌 + 5 張公共牌,湊最強 5 張比大小。四輪下注(翻牌前/翻牌/轉牌/河牌),可棄牌/過牌/跟注/加注/全下。玩家互賭、無莊家,系統每手抽 1% 進彩金池(翻牌後才抽)。</p>
        <p>從錢包買入籌碼上桌,離桌把剩餘籌碼換回錢包。行動有限時,逾時自動過牌或棄牌。每手結算會公布所有人的底牌。</p>
      </details>
    </template>
  </div>
</template>

<style scoped>
.hold-page { max-width: 860px; margin: 0 auto; padding: 12px; color: #e5e7eb; }
.hold-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.hold-title { font-size: 18px; font-weight: 900; color: var(--c-light); }
.hold-sub { font-size: 12px; color: #94a3b8; font-weight: 600; margin-left: 6px; }
.hold-stats { display: flex; gap: 8px; }
.hold-stat { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 6px 12px; text-align: right; }
.hold-stat span { display: block; font-size: 10px; color: #94a3b8; } .hold-stat b { font-size: 14px; color: var(--c-light); }
.hold-empty { text-align: center; color: #94a3b8; padding: 40px 12px; background: #131722; border-radius: 12px; line-height: 1.8; }
.hold-info { text-align: center; font-size: 12px; color: #cbd5e1; margin-bottom: 8px; }
.hold-info span { margin: 0 3px; }
.hold-online { text-align: center; font-size: 12px; color: #94a3b8; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; }
.hold-online-name { background: rgba(255,255,255,.06); border-radius: 999px; padding: 2px 9px; color: #cbd5e1; }

/* 牌桌 */
.hold-felt { position: relative; width: 100%; aspect-ratio: 16 / 11; max-height: 560px; margin: 0 auto 14px;
  background: radial-gradient(ellipse at center, #1f6d47 0%, #145033 70%, #0e3a25 100%);
  border: 8px solid #5b3a1e; border-radius: 46% / 42%; box-shadow: inset 0 0 40px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.5); }
.hold-center { position: absolute; top: 44%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.hold-board { display: flex; gap: 5px; }
.hold-pot { background: rgba(0,0,0,.4); border-radius: 999px; padding: 3px 14px; font-size: 13px; font-weight: 800; color: #fde68a; }
.hold-summary { max-width: 320px; text-align: center; font-size: 12px; color: #fff; background: rgba(0,0,0,.45); border-radius: 8px; padding: 4px 10px; }
.hold-next { font-size: 11px; color: #cbd5e1; background: rgba(0,0,0,.4); border-radius: 999px; padding: 2px 10px; }
.hold-actbar-timer { font-size: 13px; font-weight: 800; color: #cbd5e1; background: rgba(255,255,255,.06); border-radius: 999px; padding: 6px 10px; }
.hold-actbar-timer.urgent { color: #fca5a5; background: rgba(239,68,68,.15); }

/* 座位 */
.hold-seat { position: absolute; width: 120px; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 2px; }
.hold-seat.d0 { left: 50%; top: 87%; } .hold-seat.d1 { left: 11%; top: 78%; } .hold-seat.d2 { left: 6%; top: 36%; }
.hold-seat.d3 { left: 50%; top: 12%; } .hold-seat.d4 { left: 94%; top: 36%; } .hold-seat.d5 { left: 89%; top: 78%; }
.hold-seat-cards { display: flex; gap: 3px; min-height: 30px; }
.hold-seat-body { background: rgba(11,13,20,.85); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; padding: 5px 10px; text-align: center; min-width: 92px; }
.hold-seat.acting .hold-seat-body { border-color: #fbbf24; box-shadow: 0 0 12px rgba(251,191,36,.6); }
.hold-seat.me .hold-seat-body { border-color: var(--c-light); }
.hold-seat.folded { opacity: .45; }
.hold-seat.winner .hold-seat-body { border-color: #34d399; box-shadow: 0 0 14px rgba(52,211,153,.7); }
.hold-seat-name { font-size: 12px; font-weight: 800; color: #f1f5f9; display: flex; align-items: center; justify-content: center; gap: 4px; }
.hold-seat-stack { font-size: 12px; color: #fde68a; }
.hold-seat-label { font-size: 10px; color: #93c5fd; }
.hold-seat-won { font-size: 11px; color: #6ee7b7; font-weight: 800; }
.hold-dealer { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #fff; color: #0f172a; font-size: 10px; font-weight: 900; }
.hold-tag { font-size: 9px; padding: 0 5px; border-radius: 999px; font-weight: 800; }
.hold-tag.allin { background: rgba(239,68,68,.25); color: #fca5a5; } .hold-tag.fold { background: rgba(148,163,184,.2); color: #94a3b8; } .hold-tag.out { background: rgba(148,163,184,.15); color: #94a3b8; }
.hold-timer { position: absolute; top: -8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: #f59e0b; color: #0f172a; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
.hold-bet { position: absolute; bottom: -20px; background: rgba(0,0,0,.5); color: #fde68a; font-size: 11px; font-weight: 800; border-radius: 999px; padding: 1px 8px; }
.hold-sit { background: rgba(255,255,255,.08); border: 1px dashed rgba(255,255,255,.35); color: #cbd5e1; border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 12px; font-weight: 700; }
.hold-sit:disabled { opacity: .4; cursor: not-allowed; }

/* 卡牌 */
.hold-card { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border-radius: 5px; font-weight: 800; line-height: 1; }
.hold-card.sm { width: 34px; height: 48px; } .hold-card.sm .r { font-size: 15px; } .hold-card.sm .s { font-size: 15px; }
.hold-card.xs { width: 24px; height: 34px; } .hold-card.xs .r { font-size: 11px; } .hold-card.xs .s { font-size: 11px; }
.hold-card.mine { width: 46px; height: 64px; border-radius: 7px; box-shadow: 0 3px 10px rgba(0,0,0,.5); } .hold-card.mine .r { font-size: 20px; } .hold-card.mine .s { font-size: 20px; }
.hold-card.slot { background: rgba(255,255,255,.06); border: 1px dashed rgba(255,255,255,.15); }
.hold-card.back { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: rgba(255,255,255,.6); }
.hold-card.su-s { color: #0f172a; } .hold-card.su-h { color: #e11d48; } .hold-card.su-d { color: #2563eb; } .hold-card.su-c { color: #15a34a; }

/* 行動列(統一高度、整齊對齊) */
.hold-actions { display: flex; flex-direction: column; gap: 10px; background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; }
.hold-actbar-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
.hold-actbar-timer { font-size: 13px; font-weight: 800; color: #cbd5e1; background: rgba(255,255,255,.06); border-radius: 999px; padding: 5px 12px; }
.hold-actbar-timer.urgent { color: #fca5a5; background: rgba(239,68,68,.15); }
.hold-wait { color: #94a3b8; font-size: 13px; }
.hold-mybar { display: flex; gap: 8px; }
.hold-mini { height: 32px; padding: 0 14px; border-radius: 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); color: #cbd5e1; font-size: 13px; font-weight: 700; cursor: pointer; }
.hold-mini:disabled { opacity: .5; cursor: not-allowed; }
.hold-raise-row { display: flex; gap: 8px; align-items: center; }
.hold-raise-in { flex: 1 1 auto; min-width: 60px; height: 46px; box-sizing: border-box; background: #0b0d14; border: 1px solid rgba(255,255,255,.15); border-radius: 10px; color: #f1f5f9; padding: 0 14px; font-size: 16px; font-weight: 700; text-align: right; appearance: textfield; -moz-appearance: textfield; }
.hold-raise-in::-webkit-outer-spin-button, .hold-raise-in::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.hold-chips { flex: 0 0 auto; display: flex; gap: 6px; }
.hold-chip { height: 46px; padding: 0 14px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); color: #cbd5e1; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.hold-main-row { display: flex; gap: 8px; }
.hold-btn { flex: 1 1 0; min-width: 0; height: 50px; border: none; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 15px; color: #fff; display: flex; align-items: center; justify-content: center; padding: 0 8px; }
.hold-btn:disabled { opacity: .5; cursor: not-allowed; }
.hold-btn.fold { background: #475569; } .hold-btn.check { background: #2563eb; } .hold-btn.call { background: #2563eb; }
.hold-btn.raise { background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); } .hold-btn.allin { background: #dc2626; }
.hold-rules { background: #131722; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #94a3b8; margin-top: 12px; }
.hold-rules summary { cursor: pointer; color: #cbd5e1; font-weight: 700; } .hold-rules p { line-height: 1.7; }
/* 聊天室 */
.hold-chat { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; margin-top: 12px; overflow: hidden; }
.hold-chat-toggle { width: 100%; background: transparent; border: none; color: #cbd5e1; font-weight: 700; padding: 12px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
.hold-chat-body { padding: 0 10px 10px; }
.hold-chat-msgs { height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 8px; background: #0b0d14; border-radius: 8px; }
.hold-chat-empty { color: #64748b; font-size: 12px; text-align: center; margin: auto; }
.hold-chat-msg { font-size: 13px; line-height: 1.4; word-break: break-word; }
.hold-chat-msg b { color: var(--c-light); margin-right: 6px; }
.hold-chat-msg span { color: #e2e8f0; }
.hold-chat-input { display: flex; gap: 8px; margin-top: 8px; }
.hold-chat-input input { flex: 1 1 auto; min-width: 0; height: 40px; box-sizing: border-box; background: #0b0d14; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; color: #f1f5f9; padding: 0 12px; font-size: 14px; }
.hold-chat-input button { flex: 0 0 auto; height: 40px; padding: 0 18px; border: none; border-radius: 8px; background: linear-gradient(135deg, var(--c-mid), var(--c-deep)); color: #fff; font-weight: 800; cursor: pointer; }
.hold-chat-input button:disabled { opacity: .5; cursor: not-allowed; }
</style>
