<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'
import { evaluate, isFoul, cardSuit, cardRank } from '@/utils/thirteenEval'
import { useThirteenAudio } from '@/composables/thirteenAudio'

const audio = useThirteenAudio()

// 依數字→花色由小到大排序(花色序 ♣♦♥♠)
const SUIT_ORDER: Record<string, number> = { C: 0, D: 1, H: 2, S: 3 }
function sortCards(cards: string[]): string[] {
  return [...cards].sort((a, b) => (cardRank(a) - cardRank(b)) || ((SUIT_ORDER[cardSuit(a)] ?? 0) - (SUIT_ORDER[cardSuit(b)] ?? 0)))
}

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()

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

interface SeatView {
  memberId: number
  userName: string
  submitted: boolean
  mine: boolean
  front?: string[]
  middle?: string[]
  back?: string[]
  foul?: boolean
  special?: string | null
  specialZh?: string | null
  netUnits?: number
  settleAmount?: number
  rake?: number
  poolWin?: number
  autoArranged?: boolean
}
interface RoomSummary {
  roundId: number
  hostName: string
  players: number
  maxPlayers: number
  baseBet: number
  status: string
  rematch: boolean
}
interface State {
  thirteenEnabled: boolean
  inLobby: boolean
  rooms?: RoomSummary[]
  status: string
  roundId: number | null
  baseBet: number
  isHost: boolean
  hostName?: string
  maxPlayers: number
  currency: string
  online: string[]
  myBalance: number | null
  poolBalance: number
  startRemainingMs: number
  arrangeRemainingMs: number
  mineSeated: boolean
  mySubmitted: boolean
  rematchInvite?: boolean
  rematchByName?: string
  rematchRoundId?: number
  rematchRemainingMs?: number
  rematchPlayers?: number
  rematchExpected?: number
  rematchJoined?: boolean
  myCards?: string[]
  myFront?: string[]
  myMiddle?: string[]
  myBack?: string[]
  myFoul?: boolean
  seats: SeatView[]
  poolWin?: number
}

const loading = ref(true)
const state = ref<State | null>(null)
const config = ref({ enabled: false, baseBet: 0, currency: '', minPlayers: 2, maxPlayers: 4, lobbySeconds: 60, arrangeSeconds: 90 })

// ---- 倒數(本地經過時間,免裝置時鐘誤差) ----
const nowMs = ref(Date.now())
const localStartDeadline = ref(0)
const localArrangeDeadline = ref(0)
let tickTimer: number | undefined
const countdown = computed(() => {
  const s = state.value
  if (!s) return 0
  if (s.status === 'WAITING') return Math.max(0, Math.ceil((localStartDeadline.value - nowMs.value) / 1000))
  if (s.status === 'ARRANGING') return Math.max(0, Math.ceil((localArrangeDeadline.value - nowMs.value) / 1000))
  return 0
})

// ---- 理牌本地狀態 ----
const front = ref<string[]>([])
const middle = ref<string[]>([])
const back = ref<string[]>([])
const pool = ref<string[]>([]) // 尚未擺放
type Zone = 'front' | 'middle' | 'back'
const activeZone = ref<Zone>('back') // 目前要放入的目標區(預設尾墩)
let arrangedForRound: number | null = null
const busy = ref(false)

const ZCAP = { front: 3, middle: 5, back: 5 }
const ZNAME = { front: '頭墩', middle: '中墩', back: '尾墩' }
function zoneArr(z: Zone) { return z === 'front' ? front : z === 'middle' ? middle : back }
function zCards(z: Zone): string[] { return zoneArr(z).value } // 模板用(已 unwrap)

function initArrange(d: State) {
  if (d.status !== 'ARRANGING' || !d.mineSeated || !d.myCards) return
  if (arrangedForRound === d.roundId) return // 已初始化此局,別覆蓋使用者擺好的牌
  arrangedForRound = d.roundId
  if (d.mySubmitted && d.myFront) {
    front.value = displayHand(d.myFront)
    middle.value = displayHand(d.myMiddle ?? [])
    back.value = displayHand(d.myBack ?? [])
    pool.value = []
  } else {
    front.value = []
    middle.value = []
    back.value = []
    pool.value = sortCards(d.myCards)
  }
  activeZone.value = 'back'
}

function removeFromAll(card: string) {
  front.value = front.value.filter((c) => c !== card)
  middle.value = middle.value.filter((c) => c !== card)
  back.value = back.value.filter((c) => c !== card)
  pool.value = pool.value.filter((c) => c !== card)
}
// 先選區域,再連點手牌放入該區
function setActive(z: Zone) {
  if (state.value?.mySubmitted) return
  activeZone.value = z
}
function addToActive(card: string) {
  if (state.value?.mySubmitted) return
  const z = activeZone.value
  const arr = zoneArr(z)
  if (arr.value.length >= ZCAP[z]) {
    useAlert.error(`${ZNAME[z]}已滿，請先選別的區`)
    return
  }
  removeFromAll(card)
  audio.playPlace()
  arr.value = displayHand([...arr.value, card]) // 放進去就依牌型分組排好,方便看
  // 該區滿了 → 自動跳到下一個還沒滿的區(尾→中→頭)
  if (arr.value.length >= ZCAP[z]) {
    const order: Zone[] = ['back', 'middle', 'front']
    const next = order.find((zz) => zoneArr(zz).value.length < ZCAP[zz])
    if (next) activeZone.value = next
  }
}
function removeToPool(card: string) {
  if (state.value?.mySubmitted) return
  removeFromAll(card)
  pool.value = sortCards([...pool.value, card]) // 退回的牌也保持排序
}
function resetArrange() {
  if (state.value?.mySubmitted || !state.value?.myCards) return
  front.value = []
  middle.value = []
  back.value = []
  pool.value = sortCards(state.value.myCards)
  activeZone.value = 'back'
}

const evalFront = computed(() => (front.value.length === 3 ? evaluate(front.value).label : ''))
const evalMiddle = computed(() => (middle.value.length === 5 ? evaluate(middle.value).label : ''))
const evalBack = computed(() => (back.value.length === 5 ? evaluate(back.value).label : ''))
const allPlaced = computed(() => front.value.length === 3 && middle.value.length === 5 && back.value.length === 5)
const foulNow = computed(() => allPlaced.value && isFoul(front.value, middle.value, back.value))

// ---- 牌面顯示 ----
const SUIT = { C: '♣', D: '♦', H: '♥', S: '♠' } as Record<string, string>
function suitSym(code: string) { return SUIT[cardSuit(code)] ?? '' }
function rankLabel(code: string) { return code.slice(0, -1) }
// 四色牌:黑桃黑 / 紅心紅 / 方塊藍 / 梅花綠 → 黑桃梅花一眼分得出
function suitClass(code: string) {
  return { C: 'su-c', D: 'su-d', H: 'su-h', S: 'su-s' }[cardSuit(code)] ?? 'su-s'
}
// 結算顯示用:把同點數(對子/三條/鐵支)排在一起,再依張數→點數由大到小
function displayHand(cards: string[]): string[] {
  const cnt: Record<number, number> = {}
  for (const c of cards) { const r = cardRank(c); cnt[r] = (cnt[r] ?? 0) + 1 }
  return [...cards].sort((a, b) =>
    ((cnt[cardRank(b)] ?? 0) - (cnt[cardRank(a)] ?? 0))
    || (cardRank(b) - cardRank(a))
    || ((SUIT_ORDER[cardSuit(a)] ?? 0) - (SUIT_ORDER[cardSuit(b)] ?? 0)))
}

// ---- API ----
async function loadConfig() {
  try {
    const res = await fetch(`${API}/thirteen/config`, { headers: headers() })
    if (!res.ok) return
    const d = await res.json()
    config.value = {
      enabled: !!d.enabled,
      baseBet: Number(d.baseBet),
      currency: d.currency ?? '',
      minPlayers: Number(d.minPlayers ?? 2),
      maxPlayers: Number(d.maxPlayers ?? 4),
      lobbySeconds: Number(d.lobbySeconds ?? 60),
      arrangeSeconds: Number(d.arrangeSeconds ?? 90),
    }
  } catch (e) { console.error(e) }
}

let fetching = false
let lastSettledRound: number | null = null
const showResult = ref<number | null>(null)
let resultTimer: number | undefined
async function fetchRound() {
  if (fetching) return
  fetching = true
  try {
    const res = await fetch(`${API}/thirteen/round`, { headers: headers() })
    if (!res.ok) return
    const d: State = await res.json()
    state.value = d
    // 進到真正的房間(或本來就在大廳)就解除「回大廳」暫時旗標
    if (d.inLobby || d.status === 'WAITING' || d.status === 'ARRANGING') forceLobby.value = false
    if (d.rematchInvite && !prevInvite) audio.playInvite() // 被邀請叮一聲
    prevInvite = !!d.rematchInvite
    localInviteDeadline.value = (d.rematchInvite || d.rematchJoined) ? Date.now() + Number(d.rematchRemainingMs || 0) : 0
    localStartDeadline.value = d.status === 'WAITING' ? Date.now() + Number(d.startRemainingMs || 0) : 0
    localArrangeDeadline.value = d.status === 'ARRANGING' ? Date.now() + Number(d.arrangeRemainingMs || 0) : 0
    // 開局發牌特效:剛從非理牌狀態轉成理牌、且我有牌(現場開局,非重整)
    if (d.status === 'ARRANGING' && d.mineSeated && d.myCards && d.roundId !== dealtAnimRound
        && prevStatus !== null && prevStatus !== 'ARRANGING') {
      dealtAnimRound = d.roundId
      startDealAnimation(d.myCards)
    }
    prevStatus = d.status
    initArrange(d)
    if (d.status === 'SETTLED' && d.roundId && d.roundId !== lastSettledRound) {
      const fresh = lastSettledRound !== null // 首次載入(重整)不放煙火
      lastSettledRound = d.roundId
      showResult.value = d.roundId
      if (resultTimer) clearTimeout(resultTimer)
      resultTimer = window.setTimeout(() => { showResult.value = null }, 12000)
      arrangedForRound = null // 下一局重新理牌
      loadBoards()
      if (fresh) {
        audio.playReveal()
        const me = d.seats?.find((x) => x.mine)
        if (me) {
          if ((me.poolWin ?? 0) > 0) { triggerCelebrate('pool', `🀄 ${me.specialZh ?? '特殊牌'} 中彩金池 +${fmt(me.poolWin)}！`); audio.playJackpot() }
          else if (me.special) { triggerCelebrate('special', `🀄 ${me.specialZh}！`); audio.playJackpot() }
          else if ((me.netUnits ?? 0) >= 6) { triggerCelebrate('win', `🎉 大贏 ${me.netUnits} 水！`); audio.playWin() }
          else if ((me.netUnits ?? 0) > 0) window.setTimeout(() => audio.playWin(), 500)
          else if ((me.netUnits ?? 0) < 0 || me.foul) window.setTimeout(() => audio.playLose(), 500)
        }
      }
    }
  } catch (e) { console.error(e) } finally { fetching = false }
}

async function post(path: string, body?: unknown) {
  if (busy.value) return
  busy.value = true
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '操作失敗'); return false }
    if (d?.message) useAlert.success(d.message)
    await fetchRound()
    return true
  } catch (e) {
    console.error(e); useAlert.error('連線失敗'); return false
  } finally { busy.value = false }
}

async function createRoom() {
  const v = await useAlert.inputDialog('設定底注（1 水多少）', '開房間')
  const bet = Math.floor(Number(v))
  if (!bet || bet < 1) { if (v != null) useAlert.error('底注至少 1'); return }
  await post('/thirteen/room/create', { baseBet: bet })
}
const joinRoom = (roundId: number) => post('/thirteen/room/join', { roundId })
const leaveRoom = () => post('/thirteen/room/leave')
const startRoom = () => post('/thirteen/room/start')
async function kick(memberId: number, name: string) {
  const ok = await useAlert.confirm(`確定要把「${name}」踢出房間嗎？`)
  if (!ok?.isConfirmed) return
  await post('/thirteen/room/kick', { memberId })
}

async function submit() {
  if (!allPlaced.value) { useAlert.error('請把 13 張都擺好(頭3/中5/尾5)'); return }
  if (foulNow.value) {
    const ok = await useAlert.confirm('目前是「倒水」(後墩<中墩 或 中墩<前墩),會直接輸給每一家！確定要這樣交牌?')
    if (!ok?.isConfirmed) return
  }
  const ok = await post('/thirteen/submit', { front: front.value, middle: middle.value, back: back.value })
  if (ok) audio.playSubmit()
}

interface SuggestOpt { front: string[]; middle: string[]; back: string[] }
const suggestOptions = ref<SuggestOpt[]>([])
const showSuggest = ref(false)
async function autoSuggest() {
  if (busy.value || state.value?.mySubmitted) return
  busy.value = true
  try {
    const res = await fetch(`${API}/thirteen/suggest`, { headers: headers() })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '取得建議失敗'); return }
    const opts: SuggestOpt[] = Array.isArray(d) ? d : d ? [d] : []
    if (opts.length === 0) { useAlert.error('沒有可用的理牌建議'); return }
    if (opts.length === 1 && opts[0]) { applyOption(opts[0]); return }
    suggestOptions.value = opts
    showSuggest.value = true
  } catch (e) { console.error(e); useAlert.error('連線失敗') } finally { busy.value = false }
}
function applyOption(o: SuggestOpt) {
  front.value = displayHand(o.front)
  middle.value = displayHand(o.middle)
  back.value = displayHand(o.back)
  pool.value = []
  activeZone.value = 'back'
  showSuggest.value = false
}
const OPT_TAGS = ['🛡 穩尾(後墩最強)', '⚔ 強中(中墩最強)', '👑 沖頭(前墩拿道獎)']

// ---- 聊天室 ----
interface ChatMsg { userName: string; text: string; ts: number }
const chatOpen = ref(false)
const chatMessages = ref<ChatMsg[]>([])
const chatDraft = ref('')
const chatSending = ref(false)
async function loadChat() {
  try {
    const res = await fetch(`${API}/thirteen/chat`, { headers: headers() })
    if (!res.ok) return
    chatMessages.value = await res.json()
  } catch (e) { console.error(e) }
}
async function sendChat() {
  const text = chatDraft.value.trim()
  if (!text || chatSending.value) return
  chatSending.value = true
  try {
    const res = await fetch(`${API}/thirteen/chat`, { method: 'POST', headers: headers(), body: JSON.stringify({ text }) })
    const d = await res.json().catch(() => null)
    if (!res.ok) { useAlert.error(d?.message ?? '送出失敗'); return }
    chatDraft.value = ''
    await loadChat()
  } catch (e) { console.error(e); useAlert.error('連線失敗') } finally { chatSending.value = false }
}

// ---- 排行榜 / 我的戰績 ----
interface RankRow { rank: number; userName: string; net: number; spins: number; me: boolean }
interface HistRow { id: number; netUnits: number; settleAmount: number; poolWin: number; foul: boolean; special?: string | null }
const boardsOpen = ref(false)
const leaderboard = ref<RankRow[]>([])
const myHistory = ref<HistRow[]>([])
async function loadBoards() {
  try {
    const [lb, hi] = await Promise.all([
      fetch(`${API}/thirteen/leaderboard?limit=10`, { headers: headers() }),
      fetch(`${API}/thirteen/history?size=15`, { headers: headers() }),
    ])
    if (lb.ok) leaderboard.value = await lb.json()
    if (hi.ok) { const p = await hi.json(); myHistory.value = p.content ?? [] }
  } catch (e) { console.error(e) }
}

// ---- 尊榮中獎動畫 ----
const celebrate = ref<{ type: string; text: string } | null>(null)
let celeTimer: number | undefined
function triggerCelebrate(type: string, text: string) {
  celebrate.value = { type, text }
  if (celeTimer) clearTimeout(celeTimer)
  celeTimer = window.setTimeout(() => { celebrate.value = null }, type === 'pool' ? 5000 : 3500)
}

// ---- 發牌特效(真的把我的牌一張張發出來,再整理排序) ----
const dealing = ref(false)
const dealHand = ref<string[]>([])
const dealPhase = ref<'deal' | 'sort'>('deal')
let dealtAnimRound: number | null = null
let prevStatus: string | null = null
let prevInvite = false
let dealTimer: number | undefined
let sortTimer: number | undefined
function startDealAnimation(cards: string[]) {
  audio.playDeal()
  dealHand.value = [...cards] // 先按發牌順序攤出來
  dealPhase.value = 'deal'
  dealing.value = true
  if (dealTimer) clearTimeout(dealTimer)
  if (sortTimer) clearTimeout(sortTimer)
  // 發完(約 1s) → 整理:重新排序,卡片滑到定位(transition-group move)
  sortTimer = window.setTimeout(() => {
    dealPhase.value = 'sort'
    dealHand.value = sortCards(cards)
  }, 1050)
  dealTimer = window.setTimeout(() => { dealing.value = false }, 2200)
}

// ---- 再來一局邀請 ----
const inviteDismissed = ref<number | null>(null)
const localInviteDeadline = ref(0)
const showInvite = computed(() =>
  !!state.value?.rematchInvite && state.value?.rematchRoundId !== inviteDismissed.value,
)
const inviteCountdown = computed(() =>
  Math.max(0, Math.ceil((localInviteDeadline.value - nowMs.value) / 1000)),
)
function acceptInvite() {
  const rid = state.value?.rematchRoundId
  if (rid) joinRoom(rid)
}
function declineInvite() {
  const rid = state.value?.rematchRoundId ?? null
  inviteDismissed.value = rid
  forceLobby.value = true // 退出 → 回大廳
  // 通知後端我退出了 → 其他人不必等我,可立即開牌
  fetch(`${API}/thirteen/decline`, { method: 'POST', headers: headers(), body: JSON.stringify({ roundId: rid }) }).catch(() => {})
}
// 已選再戰後反悔:離開再戰房(退回賭本)→ 回大廳
async function cancelRematch() {
  await leaveRoom()
  forceLobby.value = true
}

// ---- 衍生 ----
const forceLobby = ref(false) // 結算後按「回大廳」先在前端回大廳(後端結算房還會留30秒)
const showLobby = computed(() => !!state.value?.inLobby || forceLobby.value)
const seatedCount = computed(() => state.value?.seats?.length ?? 0)
const myResult = computed(() => state.value?.seats?.find((x) => x.mine))
// 凍結賭本 = 該房底注 × 36(房間內用 state.baseBet)
const escrowNeeded = computed(() => Number(state.value?.baseBet ?? config.value.baseBet) * 12 * (config.value.maxPlayers - 1))
const isWaiting = computed(() => state.value?.status === 'WAITING')
const canStart = computed(() => !!state.value?.isHost && isWaiting.value && seatedCount.value >= config.value.minPlayers)

// ---- WS + 心跳 ----
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
    ws = createReconnectingStomp(`/topic/thirteen/${clanId}`, (body) => {
      if (body === 'THIRTEEN_UPDATED') fetchRound()
      else if (body === 'THIRTEEN_CHAT') loadChat()
    })
  }
  tickTimer = window.setInterval(() => (nowMs.value = Date.now()), 250)
  heartbeat = window.setInterval(fetchRound, 8000)
  audio.armAutoStart() // 第一次點擊後自動播背景音樂
})
onUnmounted(() => {
  audio.dispose()
  if (ws) ws.disconnect()
  if (tickTimer) clearInterval(tickTimer)
  if (heartbeat) clearInterval(heartbeat)
  if (resultTimer) clearTimeout(resultTimer)
  if (celeTimer) clearTimeout(celeTimer)
  if (dealTimer) clearTimeout(dealTimer)
  if (sortTimer) clearTimeout(sortTimer)
  fetch(`${API}/thirteen/leave`, { method: 'POST', headers: headers() }).catch(() => {})
})
</script>

<template>
  <div class="t13-shell">
    <!-- 尊榮中獎動畫 -->
    <transition name="t13-cele">
      <div v-if="celebrate" class="t13-celebrate" :class="celebrate.type" @click="celebrate = null">
        <div class="t13-cele-burst">{{ celebrate.type === 'win' ? '🎉' : '🀄' }}</div>
        <div class="t13-cele-text">{{ celebrate.text }}</div>
      </div>
    </transition>

    <!-- 開局發牌特效:從牌堆把我的牌一張張發出來,再整理排序 -->
    <transition name="t13-cele">
      <div v-if="dealing" class="t13-dealing">
        <div class="t13-deck"><span></span><span></span><span></span></div>
        <div class="t13-deal-text">{{ dealPhase === 'deal' ? '🀄 發牌中…' : '✋ 整理牌…' }}</div>
        <transition-group name="t13-deal" tag="div" class="t13-deal-hand">
          <div
            v-for="(c, i) in dealHand"
            :key="c"
            class="t13-card deal"
            :class="suitClass(c)"
            :style="dealPhase === 'deal' ? { animationDelay: (i * 70) + 'ms' } : {}"
          >
            <span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span>
          </div>
        </transition-group>
      </div>
    </transition>

    <!-- 智能理牌:挑一種 -->
    <transition name="t13-cele">
      <div v-if="showSuggest" class="t13-suggest-mask" @click.self="showSuggest = false">
        <div class="t13-suggest">
          <div class="t13-suggest-title">🪄 選一種理牌（最佳 {{ suggestOptions.length }} 種）</div>
          <div class="t13-suggest-opts">
            <div v-for="(o, oi) in suggestOptions" :key="oi" class="t13-suggest-opt" :class="{ rec: oi === 0 }">
              <div class="t13-suggest-tag">
                {{ OPT_TAGS[oi] ?? ('方案 ' + (oi + 1)) }}<span v-if="oi === 0" class="rec-badge">推薦</span>
              </div>
              <div v-for="(row, ri) in [o.back, o.middle, o.front]" :key="ri" class="t13-suggest-row">
                <span class="rl">{{ ri === 0 ? '尾' : ri === 1 ? '中' : '頭' }}</span>
                <button v-for="c in displayHand(row)" :key="c" class="t13-card sm" :class="suitClass(c)" disabled>
                  <span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span>
                </button>
                <span class="ty">{{ row.length ? evaluate(row).label : '' }}</span>
              </div>
              <button class="t13-btn primary" @click="applyOption(o)">選這個</button>
            </div>
          </div>
          <button class="t13-btn ghost" @click="showSuggest = false">取消</button>
        </div>
      </div>
    </transition>

    <div class="t13-page">
      <!-- 頁首 -->
      <div class="t13-head">
        <div class="t13-title">
          🀄 十三支 <span class="t13-sub">玩家互賭 · 系統不抽頭只抽水進池</span>
          <span class="t13-audio">
            <button class="t13-audio-btn" :class="{ off: !audio.bgmOn.value }" @click="audio.toggleBgm()" :title="audio.bgmOn.value ? '關背景音樂' : '開背景音樂'">{{ audio.bgmOn.value ? '🎵' : '🔇' }}</button>
            <button class="t13-audio-btn" :class="{ off: !audio.sfxOn.value }" @click="audio.toggleSfx()" :title="audio.sfxOn.value ? '關音效' : '開音效'">{{ audio.sfxOn.value ? '🔊' : '🔈' }}</button>
          </span>
        </div>
        <div class="t13-stats">
          <div class="t13-stat"><span>彩金池</span><b>{{ config.currency }} {{ fmt(state?.poolBalance) }}</b></div>
          <div class="t13-stat"><span>我的餘額</span><b>{{ config.currency }} {{ fmt(state?.myBalance) }}</b></div>
          <div class="t13-stat"><span>底注(一水)</span><b>{{ fmt(state?.baseBet ?? config.baseBet) }}</b></div>
        </div>
      </div>

      <div v-if="loading" class="t13-empty">載入中…</div>

      <div v-else-if="!state?.thirteenEnabled" class="t13-empty">
        🚫 本血盟尚未開放十三支<br /><small>請管理員到「設置」開啟</small>
      </div>

      <template v-else>
        <!-- 在線 -->
        <div class="t13-online">
          🟢 遊戲室在線 {{ state?.online?.length ?? 0 }} 人：
          <span class="t13-online-names">{{ (state?.online ?? []).join('、') || '—' }}</span>
        </div>

        <!-- 大廳:房間清單 -->
        <div v-if="showLobby" class="t13-lobby">
          <div class="t13-lobby-head">
            <span>🀄 對戰房間</span>
            <button class="t13-btn primary mini" :disabled="busy" @click="createRoom">＋ 開房間</button>
          </div>
          <div v-if="(state?.rooms ?? []).length === 0" class="t13-lobby-empty">
            目前沒有房間。按「開房間」設定底注(1 水多少)開一桌，邀大家來玩 🎲
          </div>
          <div v-for="r in (state?.rooms ?? [])" :key="r.roundId" class="t13-room-row">
            <div class="t13-room-info">
              <div class="t13-room-host">👑 {{ r.hostName }}<span v-if="r.rematch" class="t13-room-tag">再戰</span></div>
              <div class="t13-room-meta">底注 {{ fmt(r.baseBet) }} · {{ r.players }}/{{ r.maxPlayers }} 人 · {{ r.status === 'WAITING' ? '湊人中' : '對戰中' }}</div>
            </div>
            <button
              class="t13-btn primary mini"
              :disabled="busy || r.status !== 'WAITING' || r.players >= r.maxPlayers"
              @click="joinRoom(r.roundId)"
            >
              {{ r.status !== 'WAITING' ? '進行中' : r.players >= r.maxPlayers ? '已滿' : '加入' }}
            </button>
          </div>
        </div>

        <!-- 房間內 -->
        <template v-else>
        <div class="t13-table">
          <div class="t13-table-head">
            <span v-if="state?.status === 'WAITING'">🪑 湊人中 {{ seatedCount }}/{{ state?.maxPlayers }}</span>
            <span v-else-if="state?.status === 'ARRANGING'">🃏 理牌中（{{ seatedCount }} 人對戰）</span>
            <span v-else-if="state?.status === 'SETTLED'">🏆 本局結果</span>
            <span v-if="countdown > 0" class="t13-countdown" :class="{ urgent: countdown <= 10 }">⏱ {{ countdown }}s</span>
          </div>
          <div class="t13-room-bar">房主 👑 {{ state?.hostName }} · 底注 {{ fmt(state?.baseBet) }} {{ config.currency }}（凍結 {{ fmt(escrowNeeded) }}）</div>

          <div class="t13-seats">
            <div
              v-for="s in (state?.seats ?? [])"
              :key="s.memberId"
              class="t13-seat"
              :class="{ mine: s.mine, done: s.submitted }"
            >
              <div class="t13-seat-name">
                {{ s.userName }}<span v-if="s.mine"> (你)</span>
                <button
                  v-if="state?.isHost && !s.mine && state?.status === 'WAITING'"
                  class="t13-kick" @click="kick(s.memberId, s.userName)" title="踢出"
                >✕</button>
              </div>
              <div class="t13-seat-status">
                <template v-if="state?.status === 'ARRANGING'">
                  {{ s.submitted ? '✅ 已交牌' : '🤔 理牌中…' }}
                </template>
                <template v-else-if="state?.status === 'WAITING'">就緒</template>
              </div>
            </div>
            <div v-if="seatedCount === 0" class="t13-seat empty">尚無玩家</div>
          </div>

          <!-- 房主控制 / 離開 -->
          <div class="t13-lobby-actions" v-if="state?.status === 'WAITING'">
            <button v-if="canStart" class="t13-btn primary" :disabled="busy" @click="startRoom">▶ 開始（{{ seatedCount }} 人）</button>
            <p v-else-if="state?.isHost" class="t13-note">等人到齊（至少 {{ config.minPlayers }} 人）就能按開始；滿 {{ state?.maxPlayers }} 人自動開始。</p>
            <p v-else class="t13-note">等房主開始；滿 {{ state?.maxPlayers }} 人自動開始。</p>
            <button class="t13-btn ghost" :disabled="busy" @click="leaveRoom">離開房間（退回賭本）</button>
          </div>
        </div>

        <!-- 理牌區(自己且 ARRANGING) -->
        <div v-if="state?.status === 'ARRANGING' && state?.mineSeated" class="t13-arrange">
          <div class="t13-arrange-head">
            <b>整理你的牌</b>
            <div class="t13-arrange-btns">
              <button class="t13-btn mini" :disabled="busy || state?.mySubmitted" @click="autoSuggest">🪄 智能理牌</button>
              <button class="t13-btn mini ghost" :disabled="busy || state?.mySubmitted" @click="resetArrange">↺ 重置</button>
            </div>
          </div>

          <div v-if="foulNow" class="t13-foul">⚠️ 倒水！必須 後墩 ≥ 中墩 ≥ 前墩，這樣交牌會輸給每一家</div>

          <p class="t13-arrange-tip">① 先點下面的【尾墩/中墩/頭墩】選區 → ② 連點手牌就一直放進去（放滿自動跳下一區）</p>

          <!-- 三墩(點標題選為目標區) -->
          <div
            v-for="z in (['back','middle','front'] as const)"
            :key="z"
            class="t13-zone"
            :class="{ active: activeZone === z && !state?.mySubmitted, foul: foulNow }"
            @click="setActive(z)"
          >
            <div class="t13-zone-label">
              <span class="t13-zone-name">{{ ZNAME[z] }}<span v-if="activeZone === z && !state?.mySubmitted" class="t13-zone-pick">← 放這裡</span></span>
              <span class="t13-zone-cap">{{ zCards(z).length }}/{{ ZCAP[z] }}</span>
              <span class="t13-zone-type">{{ z === 'back' ? evalBack : z === 'middle' ? evalMiddle : evalFront }}</span>
            </div>
            <div class="t13-zone-cards">
              <button
                v-for="c in zCards(z)"
                :key="c"
                class="t13-card"
                :class="suitClass(c)"
                @click.stop="removeToPool(c)"
              >
                <span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span>
              </button>
              <span v-if="zCards(z).length === 0" class="t13-zone-hint">
                {{ activeZone === z ? '👇 點手牌放進來' : '點這列選為目標區' }}
              </span>
            </div>
          </div>

          <!-- 手牌池 -->
          <div class="t13-pool">
            <div class="t13-zone-label">手牌（點一下就放入【{{ ZNAME[activeZone] }}】）</div>
            <div class="t13-zone-cards">
              <button
                v-for="c in pool"
                :key="c"
                class="t13-card"
                :class="suitClass(c)"
                @click="addToActive(c)"
              >
                <span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span>
              </button>
              <span v-if="pool.length === 0" class="t13-zone-hint">手牌都擺好了 👍</span>
            </div>
          </div>

          <button
            class="t13-btn primary big"
            :disabled="busy || state?.mySubmitted || !allPlaced"
            @click="submit"
          >
            {{ state?.mySubmitted ? '✅ 已交牌，等其他人…' : (allPlaced ? '交牌' : `還要擺 ${13 - front.length - middle.length - back.length} 張`) }}
          </button>
        </div>

        <div v-else-if="state?.status === 'ARRANGING' && !state?.mineSeated" class="t13-empty">
          🃏 本桌對戰中，等這局結束再加入吧
        </div>

        <!-- 開牌結果 -->
        <div v-if="state?.status === 'SETTLED'" class="t13-result">
          <div v-if="myResult" class="t13-myresult" :class="{ win: (myResult.netUnits ?? 0) > 0, lose: (myResult.netUnits ?? 0) < 0 }">
            <template v-if="myResult.foul">😵 你倒水了，輸 {{ config.currency }} {{ fmt(Math.abs(myResult.settleAmount ?? 0)) }}</template>
            <template v-else-if="(myResult.netUnits ?? 0) > 0">🎉 你贏了 {{ myResult.netUnits }} 水（{{ config.currency }} +{{ fmt(myResult.settleAmount) }}{{ (myResult.rake ?? 0) > 0 ? `，抽水 ${fmt(myResult.rake)}` : '' }}）</template>
            <template v-else-if="(myResult.netUnits ?? 0) < 0">😢 你輸了 {{ Math.abs(myResult.netUnits ?? 0) }} 水（{{ config.currency }} {{ fmt(myResult.settleAmount) }}）</template>
            <template v-else>😐 平手</template>
            <span v-if="(myResult.poolWin ?? 0) > 0" class="t13-pool-hit">🀄 特殊牌中彩金池 +{{ fmt(myResult.poolWin) }}！</span>
          </div>

          <div class="t13-reveal">
            <div
              v-for="s in (state?.seats ?? [])"
              :key="s.memberId"
              class="t13-reveal-seat"
              :class="{ mine: s.mine, foul: s.foul }"
            >
              <div class="t13-reveal-head">
                <span class="nm">{{ s.userName }}<span v-if="s.mine"> (你)</span></span>
                <span class="net" :class="{ pos: (s.netUnits ?? 0) > 0, neg: (s.netUnits ?? 0) < 0 }">
                  {{ (s.netUnits ?? 0) > 0 ? '+' : '' }}{{ s.netUnits ?? 0 }} 水
                </span>
              </div>
              <div class="t13-badges">
                <span v-if="s.foul" class="bad foul">倒水</span>
                <span v-if="s.specialZh" class="bad special">{{ s.specialZh }}</span>
                <span v-if="s.autoArranged" class="bad auto">自動</span>
                <span v-if="(s.poolWin ?? 0) > 0" class="bad pool">中池 +{{ fmt(s.poolWin) }}</span>
              </div>
              <div v-for="(row, i) in [s.back, s.middle, s.front]" :key="i" class="t13-reveal-row">
                <span class="rl">{{ i === 0 ? '尾' : i === 1 ? '中' : '頭' }}</span>
                <button v-for="c in displayHand(row ?? [])" :key="c" class="t13-card sm" :class="suitClass(c)" disabled>
                  <span class="r">{{ rankLabel(c) }}</span><span class="s">{{ suitSym(c) }}</span>
                </button>
                <span class="ty">{{ (row && row.length) ? evaluate(row).label : '' }}</span>
              </div>
            </div>
          </div>

          <!-- 系統自動詢問:再戰 / 退出(30秒考慮期,內嵌,所有人決定完才一起開) -->
          <div v-if="state?.rematchJoined" class="t13-rematch-box joined">
            <div class="t13-rematch-head">
              <span>✅ 你已選再戰</span>
              <span class="t13-rematch-count" :class="{ urgent: inviteCountdown <= 10 }">⏱ {{ inviteCountdown }}s</span>
            </div>
            <div class="t13-rematch-sub">
              等其他人決定中…已 <b>{{ state?.rematchPlayers ?? 0 }}/{{ state?.rematchExpected ?? 0 }}</b> 人再戰。大家決定完或時間到就一起開打。
            </div>
            <div class="t13-rematch-btns">
              <button class="t13-btn ghost" :disabled="busy" @click="cancelRematch">取消再戰並退出</button>
            </div>
          </div>
          <div v-else-if="showInvite" class="t13-rematch-box">
            <div class="t13-rematch-head">
              <span>🔁 要再戰一次嗎？</span>
              <span class="t13-rematch-count" :class="{ urgent: inviteCountdown <= 10 }">⏱ {{ inviteCountdown }}s</span>
            </div>
            <div class="t13-rematch-sub">
              已 <b>{{ state?.rematchPlayers ?? 0 }}/{{ state?.rematchExpected ?? 0 }}</b> 人選擇再戰 · 再戰需凍結賭本 {{ fmt(escrowNeeded) }} {{ config.currency }}（時間到沒選視同退出；大家決定完才會一起開）
            </div>
            <div class="t13-rematch-btns">
              <button class="t13-btn primary" :disabled="busy" @click="acceptInvite">🔁 再戰</button>
              <button class="t13-btn ghost" :disabled="busy" @click="declineInvite">🚪 退出房間</button>
            </div>
          </div>
          <div v-else class="t13-after-actions">
            <button class="t13-btn ghost" :disabled="busy" @click="forceLobby = true">🏠 回大廳</button>
          </div>
        </div>
        </template>

        <!-- 排行榜 / 我的戰績 -->
        <div class="t13-panel">
          <button class="t13-panel-toggle" @click="boardsOpen = !boardsOpen">
            🏆 排行榜 / 我的戰績 <span>{{ boardsOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="boardsOpen" class="t13-panel-body">
            <div class="t13-board-col">
              <h4>💰 賺錢排行榜</h4>
              <div v-if="leaderboard.length === 0" class="t13-board-empty">尚無戰績</div>
              <div v-for="r in leaderboard" :key="r.rank" class="t13-rank-row" :class="{ me: r.me }">
                <span class="rk">{{ r.rank }}</span>
                <span class="nm">{{ r.userName }}</span>
                <span class="games">{{ r.spins }} 局</span>
                <span class="net" :class="{ pos: r.net > 0, neg: r.net < 0 }">{{ r.net > 0 ? '+' : '' }}{{ fmt(r.net) }}</span>
              </div>
            </div>
            <div class="t13-board-col">
              <h4>📜 我的近期</h4>
              <div v-if="myHistory.length === 0" class="t13-board-empty">還沒玩過</div>
              <div v-for="h in myHistory" :key="h.id" class="t13-hist-row">
                <span class="res" :class="{ pos: h.netUnits > 0, neg: h.netUnits < 0 }">
                  {{ h.foul ? '倒水' : h.netUnits > 0 ? `贏${h.netUnits}水` : h.netUnits < 0 ? `輸${-h.netUnits}水` : '平' }}
                </span>
                <span v-if="h.special" class="sp">{{ '🀄' }}</span>
                <span class="amt" :class="{ pos: h.settleAmount > 0, neg: h.settleAmount < 0 }">
                  {{ h.settleAmount > 0 ? '+' : '' }}{{ fmt(h.settleAmount + (h.poolWin || 0)) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 聊天室 -->
        <div class="t13-panel">
          <button class="t13-panel-toggle" @click="chatOpen = !chatOpen">
            💬 賭桌聊天 <span>{{ chatOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="chatOpen" class="t13-panel-body chat">
            <div class="t13-chat-msgs">
              <div v-if="chatMessages.length === 0" class="t13-board-empty">還沒人說話，來聊兩句 🗣️</div>
              <div v-for="(m, i) in chatMessages" :key="i" class="t13-chat-msg">
                <b>{{ m.userName }}</b><span>{{ m.text }}</span>
              </div>
            </div>
            <div class="t13-chat-input">
              <input v-model="chatDraft" maxlength="100" placeholder="說點什麼…" @keyup.enter="sendChat" />
              <button :disabled="chatSending || !chatDraft.trim()" @click="sendChat">送</button>
            </div>
          </div>
        </div>

        <!-- 特殊牌型說明 -->
        <details class="t13-rules">
          <summary>📜 規則 / 特殊牌型</summary>
          <p>每人 13 張排成 頭墩(3) / 中墩(5) / 尾墩(5)，必須「後墩 ≥ 中墩 ≥ 前墩」否則倒水(輸給每一家)。每兩家逐墩比大小，各墩贏 1 水、三墩全勝為「打槍」翻倍。零和對賭，贏家抽一點水進彩金池。</p>
          <p>道獎(×2)：用 <b>鐵支</b>、<b>同花順</b>、或 <b>頭墩三條(沖三)</b> 贏該墩 → 該墩收 2 水(打槍照樣再翻倍)。</p>
          <p>特殊牌型(整副報到)：一條龍 / 至尊清龍 / 三同花順 等可額外<b>獨得/均分彩金池</b>。</p>
        </details>
      </template>
    </div>
  </div>
</template>

<style scoped>
.t13-shell { padding: 12px; color: #e5e7eb; }
.t13-page { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.t13-head { display: flex; flex-direction: column; gap: 8px; }
.t13-title { font-size: 20px; font-weight: 800; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.t13-sub { font-size: 12px; font-weight: 400; color: #94a3b8; margin-left: 6px; }
.t13-audio { margin-left: auto; display: flex; gap: 6px; }
.t13-audio-btn { background: rgba(var(--c-light-rgb), .12); border: 1px solid rgba(var(--c-light-rgb), .3); border-radius: 8px; width: 34px; height: 30px; cursor: pointer; font-size: 15px; padding: 0; }
.t13-audio-btn.off { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); opacity: .6; }
.t13-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.t13-stat { flex: 1 1 0; min-width: 110px; background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 8px 12px; }
.t13-stat span { display: block; font-size: 11px; color: #94a3b8; }
.t13-stat b { font-size: 16px; color: var(--c-light); }
.t13-empty { text-align: center; color: #94a3b8; padding: 40px 12px; background: #131722; border-radius: 12px; line-height: 1.8; }
.t13-online { font-size: 12px; color: #94a3b8; background: #131722; border-radius: 8px; padding: 6px 10px; }
.t13-online-names { color: #cbd5e1; }
/* 大廳 */
.t13-lobby { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; }
.t13-lobby-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800; margin-bottom: 10px; }
.t13-lobby-empty { color: #94a3b8; font-size: 13px; text-align: center; padding: 24px 8px; line-height: 1.7; }
.t13-room-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; margin-bottom: 8px; background: rgba(255,255,255,.03); }
.t13-room-host { font-weight: 700; display: flex; align-items: center; gap: 6px; }
.t13-room-tag { font-size: 10px; background: rgba(var(--c-light-rgb),.2); color: var(--c-light); border-radius: 5px; padding: 1px 6px; }
.t13-room-meta { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.t13-room-bar { font-size: 12px; color: #cbd5e1; margin-bottom: 10px; }
.t13-kick { margin-left: 8px; border: none; background: rgba(248,113,113,.18); color: #fca5a5; border-radius: 6px; width: 20px; height: 20px; cursor: pointer; font-weight: 800; line-height: 1; padding: 0; }
.t13-kick:hover { background: rgba(248,113,113,.32); }
.t13-table { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; }
.t13-table-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 10px; }
.t13-countdown { color: #fbbf24; font-variant-numeric: tabular-nums; }
.t13-countdown.urgent { color: #f87171; }
.t13-seats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.t13-seat { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 10px; }
.t13-seat.mine { border-color: var(--c-light); }
.t13-seat.done { border-color: rgba(34,197,94,.5); }
.t13-seat.empty { grid-column: 1 / -1; text-align: center; color: #64748b; }
.t13-seat-name { font-weight: 700; }
.t13-seat-status { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.t13-lobby-actions { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.t13-note { font-size: 11px; color: #64748b; margin: 0; }
.t13-btn { border: none; border-radius: 10px; padding: 12px 16px; font-weight: 700; cursor: pointer; font-size: 15px; }
.t13-btn.primary { background: var(--c-light); color: var(--c-on); }
.t13-btn.primary:disabled { background: #3a4356; color: #9ca3af; cursor: not-allowed; }
.t13-btn.ghost { background: rgba(255,255,255,.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,.12); }
.t13-btn.big { width: 100%; padding: 14px; font-size: 16px; }
.t13-btn.mini { padding: 7px 12px; font-size: 13px; }
.t13-arrange { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.t13-arrange-head { display: flex; justify-content: space-between; align-items: center; }
.t13-arrange-btns { display: flex; gap: 8px; }
.t13-foul { background: rgba(248,113,113,.15); border: 1px solid rgba(248,113,113,.4); color: #fca5a5; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-weight: 700; }
.t13-arrange-tip { font-size: 12px; color: #94a3b8; background: rgba(var(--c-light-rgb),.08); border-radius: 8px; padding: 8px 10px; margin: 0; line-height: 1.6; }
.t13-zone { border: 1px dashed rgba(255,255,255,.18); border-radius: 10px; padding: 8px; cursor: pointer; transition: border-color .15s, background .15s; }
.t13-zone.active { border: 2px solid var(--c-light); background: rgba(var(--c-light-rgb),.1); padding: 7px; }
.t13-zone.foul { border-color: rgba(248,113,113,.4); }
.t13-zone-name { font-weight: 700; color: #cbd5e1; }
.t13-zone-pick { color: var(--c-light); font-weight: 800; margin-left: 6px; }
.t13-zone-label { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.t13-zone-cap { color: #cbd5e1; }
.t13-zone-type { margin-left: auto; color: var(--c-light); font-weight: 700; }
.t13-zone-cards { display: flex; flex-wrap: wrap; gap: 6px; min-height: 70px; align-items: center; }
.t13-zone-hint { font-size: 12px; color: #475569; }
.t13-pool { border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; }
.t13-card {
  width: 50px; height: 68px; border-radius: 8px; background: #f8fafc; color: #0f172a;
  border: 2px solid transparent; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-weight: 800; cursor: pointer; padding: 0; line-height: 1;
}
.t13-card .r { font-size: 21px; }
.t13-card .s { font-size: 22px; font-weight: 900; line-height: 1; }
/* 四色牌:黑桃黑 / 紅心紅 / 方塊藍 / 梅花綠 — 黑桃梅花一眼分辨 */
.t13-card.su-s { color: #0f172a; }
.t13-card.su-h { color: #e11d48; }
.t13-card.su-d { color: #2563eb; }
.t13-card.su-c { color: #15a34a; }
.t13-card.sm { width: 40px; height: 55px; }
.t13-card.sm .r { font-size: 16px; }
.t13-card.sm .s { font-size: 18px; }
.t13-card:disabled { cursor: default; }
.t13-result { display: flex; flex-direction: column; gap: 10px; }
.t13-myresult { text-align: center; font-weight: 800; font-size: 16px; padding: 12px; border-radius: 12px; background: #131722; }
.t13-myresult.win { background: rgba(34,197,94,.15); color: #86efac; }
.t13-myresult.lose { background: rgba(248,113,113,.12); color: #fca5a5; }
.t13-pool-hit { display: block; color: #fbbf24; font-size: 14px; margin-top: 4px; }
.t13-reveal { display: flex; flex-direction: column; gap: 8px; }
.t13-reveal-seat { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 10px; }
.t13-reveal-seat.mine { border-color: var(--c-light); }
.t13-reveal-seat.foul { border-color: rgba(248,113,113,.4); }
.t13-reveal-head { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px; }
.net.pos { color: #86efac; } .net.neg { color: #fca5a5; }
.t13-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.bad { font-size: 11px; padding: 2px 7px; border-radius: 6px; font-weight: 700; }
.bad.foul { background: rgba(248,113,113,.2); color: #fca5a5; }
.bad.special { background: rgba(251,191,36,.2); color: #fbbf24; }
.bad.auto { background: rgba(148,163,184,.2); color: #cbd5e1; }
.bad.pool { background: rgba(var(--c-light-rgb),.2); color: var(--c-light); }
.t13-reveal-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.t13-reveal-row .rl { font-size: 11px; color: #64748b; width: 16px; }
.t13-reveal-row .ty { font-size: 12px; color: var(--c-light); margin-left: 6px; }
.t13-rules { background: #131722; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #94a3b8; }
.t13-rules summary { cursor: pointer; color: #cbd5e1; font-weight: 700; }
.t13-rules p { line-height: 1.7; }

/* 開牌翻牌動畫(整桌依序浮現) */
.t13-reveal-seat { animation: t13-flip-in .45s cubic-bezier(.2,.7,.3,1) both; }
.t13-reveal-seat:nth-child(2) { animation-delay: .12s; }
.t13-reveal-seat:nth-child(3) { animation-delay: .24s; }
.t13-reveal-seat:nth-child(4) { animation-delay: .36s; }
@keyframes t13-flip-in {
  from { opacity: 0; transform: perspective(600px) rotateX(-35deg) translateY(14px); }
  to   { opacity: 1; transform: perspective(600px) rotateX(0) translateY(0); }
}

/* 面板(排行榜/聊天) */
.t13-panel { background: #131722; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; }
.t13-panel-toggle { width: 100%; background: transparent; border: none; color: #cbd5e1; font-weight: 700; padding: 12px; cursor: pointer; display: flex; justify-content: space-between; font-size: 14px; }
.t13-panel-body { padding: 0 12px 12px; display: flex; gap: 14px; }
.t13-board-col { flex: 1 1 0; min-width: 0; }
.t13-board-col h4 { margin: 0 0 8px; font-size: 13px; color: #94a3b8; }
.t13-board-empty { font-size: 12px; color: #64748b; padding: 8px 0; }
.t13-rank-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.05); }
.t13-rank-row.me { color: var(--c-light); font-weight: 700; }
.t13-rank-row .rk { width: 18px; color: #94a3b8; }
.t13-rank-row .nm { flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t13-rank-row .games { font-size: 11px; color: #64748b; }
.t13-rank-row .net.pos, .t13-hist-row .res.pos, .t13-hist-row .amt.pos { color: #86efac; }
.t13-rank-row .net.neg, .t13-hist-row .res.neg, .t13-hist-row .amt.neg { color: #fca5a5; }
.t13-hist-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.05); }
.t13-hist-row .res { width: 56px; }
.t13-hist-row .amt { margin-left: auto; }
.t13-panel-body.chat { flex-direction: column; }
.t13-chat-msgs { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
.t13-chat-msg { font-size: 13px; line-height: 1.4; }
.t13-chat-msg b { color: var(--c-light); margin-right: 6px; }
.t13-chat-msg span { color: #cbd5e1; word-break: break-word; }
.t13-chat-input { display: flex; gap: 8px; margin-top: 10px; }
.t13-chat-input input { flex: 1 1 0; min-width: 0; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 9px 12px; color: #f1f5f9; outline: none; }
.t13-chat-input input:focus { border-color: var(--c-light); }
.t13-chat-input button { flex: 0 0 52px; height: 38px; align-self: center; border: none; border-radius: 8px; background: var(--c-light); color: var(--c-on); font-weight: 700; cursor: pointer; box-sizing: border-box; }
.t13-chat-input button:disabled { background: #3a4356; color: #9ca3af; }

/* 尊榮中獎動畫 */
.t13-celebrate { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer;
  background: radial-gradient(circle at center, rgba(var(--c-light-rgb),.25), rgba(0,0,0,.82)); }
.t13-celebrate.pool { background: radial-gradient(circle at center, rgba(251,191,36,.3), rgba(0,0,0,.85)); }
.t13-cele-burst { font-size: 96px; animation: t13-pop .6s cubic-bezier(.2,1.4,.4,1) both, t13-spin 2.5s ease-in-out infinite .6s; }
.t13-cele-text { font-size: 26px; font-weight: 900; color: #fff; text-shadow: 0 2px 18px rgba(var(--c-light-rgb),.9); text-align: center; padding: 0 20px; animation: t13-pop .5s ease both .15s; }
.t13-celebrate.pool .t13-cele-text { text-shadow: 0 2px 18px rgba(251,191,36,.9); }
@keyframes t13-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
@keyframes t13-spin { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.12); } }
.t13-cele-enter-active, .t13-cele-leave-active { transition: opacity .35s; }
.t13-cele-enter-from, .t13-cele-leave-to { opacity: 0; }

/* 開局發牌特效:牌堆 + 一張張發出我的牌 + 整理 */
.t13-dealing { position: fixed; inset: 0; z-index: 9998; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: rgba(8,10,18,.92); }
.t13-deck { position: relative; width: 46px; height: 64px; }
.t13-deck span { position: absolute; inset: 0; border-radius: 7px; border: 2px solid #fff;
  background: repeating-linear-gradient(45deg, var(--c-light), var(--c-light) 5px, var(--c-deep) 5px, var(--c-deep) 10px);
  animation: t13-deck-pulse 1s ease-in-out infinite; }
.t13-deck span:nth-child(2) { transform: translate(3px, -3px); opacity: .8; }
.t13-deck span:nth-child(3) { transform: translate(6px, -6px); opacity: .6; }
@keyframes t13-deck-pulse { 0%,100% { box-shadow: 0 0 0 rgba(var(--c-light-rgb),0); } 50% { box-shadow: 0 0 18px rgba(var(--c-light-rgb),.8); } }
.t13-deal-text { font-size: 20px; font-weight: 900; color: var(--c-light); text-shadow: 0 2px 14px rgba(var(--c-light-rgb),.7); }
.t13-deal-hand { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; max-width: 340px; }
.t13-card.deal { animation: t13-card-deal .45s cubic-bezier(.2,.8,.3,1) both; }
@keyframes t13-card-deal {
  0% { opacity: 0; transform: translate(-40vw, -180px) rotate(-120deg) scale(.5); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: translate(0,0) rotate(0) scale(1); }
}
/* 整理:重新排序時卡片平滑滑到定位 */
.t13-deal-move { transition: transform .5s cubic-bezier(.2,.7,.3,1); }

/* 再來一局邀請 */
.t13-invite-mask { position: fixed; inset: 0; z-index: 9997; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.7); padding: 20px; }
.t13-invite { background: #1b2030; border: 1px solid rgba(var(--c-light-rgb),.4); border-radius: 16px; padding: 22px; max-width: 360px; width: 100%; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
.t13-invite-emoji { font-size: 52px; animation: t13-pop .5s cubic-bezier(.2,1.4,.4,1) both; }
.t13-invite-title { font-size: 18px; font-weight: 800; color: #fff; margin: 8px 0 4px; }
.t13-invite-count { font-size: 14px; font-weight: 800; color: #fbbf24; margin-bottom: 8px; }
.t13-invite-sub { font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 16px; }
.t13-invite-btns { display: flex; flex-direction: column; gap: 10px; }
.t13-invite-btns .t13-btn { width: 100%; box-sizing: border-box; padding: 14px; font-size: 15px; }
.t13-after-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.t13-after-actions .t13-btn { flex: 1 1 0; min-width: 140px; }
/* 結算後內嵌再戰區 */
.t13-rematch-box { background: rgba(var(--c-light-rgb), .08); border: 1px solid rgba(var(--c-light-rgb), .4); border-radius: 12px; padding: 12px; }
.t13-rematch-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 16px; }
.t13-rematch-count { color: #fbbf24; font-variant-numeric: tabular-nums; }
.t13-rematch-count.urgent { color: #f87171; }
.t13-rematch-sub { font-size: 12px; color: #94a3b8; margin: 6px 0 10px; line-height: 1.6; }
.t13-rematch-sub b { color: var(--c-light); }
.t13-rematch-btns { display: flex; gap: 10px; }
.t13-rematch-btns .t13-btn { flex: 1 1 0; }

/* 智能理牌選項 */
.t13-suggest-mask { position: fixed; inset: 0; z-index: 9997; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.72); padding: 16px; }
.t13-suggest { background: #1b2030; border: 1px solid rgba(var(--c-light-rgb),.4); border-radius: 16px; padding: 16px; max-width: 420px; width: 100%; max-height: 88vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
.t13-suggest-title { font-size: 16px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 12px; }
.t13-suggest-opts { display: flex; flex-direction: column; gap: 10px; }
.t13-suggest-opt { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px; background: rgba(255,255,255,.03); }
.t13-suggest-opt.rec { border-color: rgba(var(--c-light-rgb),.55); background: rgba(var(--c-light-rgb),.06); }
.t13-suggest-tag { font-weight: 800; color: var(--c-light); font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.rec-badge { font-size: 11px; background: var(--c-light); color: var(--c-on); border-radius: 6px; padding: 1px 7px; font-weight: 800; }
.t13-suggest-row { display: flex; align-items: center; gap: 4px; margin-bottom: 5px; }
.t13-suggest-row .rl { font-size: 11px; color: #94a3b8; width: 16px; flex: 0 0 auto; }
.t13-suggest-row .ty { font-size: 12px; color: var(--c-light); margin-left: 6px; white-space: nowrap; }
.t13-suggest-opt .t13-btn.primary { width: 100%; margin-top: 8px; padding: 10px; }
</style>
