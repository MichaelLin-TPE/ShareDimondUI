<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { generateSignature } from '@/utils/SignTools'
import { resetSession } from '@/utils/session'
import { useAlert } from '@/utils/alerts'

// 假人監控:神盾天堂伺服器內 AI 假人的即時狀態。
// 資料流:L1Server com.add.bot.BotWebReport 每 5 秒 POST /bot/heartbeat(X-Bot-Token)
//        → 後端 botmonitor 記憶體原樣存 JSON(kind = l1-bots)→ 這頁輪詢 /bot/bindings。
// 綁定用的 token 在 L1Server config/bot.properties 的 BotWebToken。網址加 ?demo=1 看示範資料(不需登入)。

const API = 'https://api.gameshare-system.com'
const POLL_MS = 5000
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const demo = computed(() => route.query.demo === '1')

interface Named { name: string; n: number }
interface Buff { name: string; sec: number }
interface BotSnap {
  name: string; cls: string; lv: number; lvDay: number; expPct: number
  clan: string; clanRank: string
  str: number; dex: number; con: number; intel: number; wis: number; cha: number; ac: number; mr: number
  hp: number; maxHp: number; mp: number; maxMp: number
  map: string; x: number; y: number; dead: boolean; goal: string; haste: boolean; brave: boolean
  target: { name: string; lv: number; hpPct: number } | null
  buffs: Buff[]
  adena: number; adenaDay: number; net: number; gained: number; sold: number; spent: number
  // 以下欄位舊版伺服器(還沒重啟的)不會送,一律當可選處理,讀取走 n0()
  aidIn?: number; aidOut?: number; clanIn?: number; clanOut?: number; clanChest?: number
  deaths: number; attacks: number; hits: number; kills: number; dayMin: number; bornMin: number
  topKills: Named[]; topLoot: Named[]
}
interface FleetStatus { kind: 'l1-bots'; v: number; ts: number; running: boolean; realPlayers: number; bots: BotSnap[] }
interface Binding { token: string; name: string; online: boolean; ageMs: number; status: unknown }
interface Fleet { token: string; name: string; online: boolean; ageMs: number; data: FleetStatus }

function isFleet(s: unknown): s is FleetStatus {
  if (!s || typeof s !== 'object') return false
  const o = s as { kind?: unknown; bots?: unknown }
  return o.kind === 'l1-bots' && Array.isArray(o.bots)
}
function isEmptyStatus(s: unknown) {
  return !s || (typeof s === 'object' && Object.keys(s as object).length === 0)
}

const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return { Authorization: `Bearer ${authStore.authToken}`, 'Content-Type': 'application/json', Sign: generateSignature(ts), TimeStamp: ts }
}

/** 後端登入逾時回 HTTP 400 + {status:-999},全站攔截器只接 401,這裡自己接:清 session 回登入頁 */
function expired(d: unknown): boolean {
  const o = d as { status?: unknown; message?: unknown } | null
  const hit = !!o && (o.status === -999 || (typeof o.message === 'string' && o.message.includes('expired token')))
  if (hit) {
    useAlert.error('登入逾時,請重新登入')
    resetSession()
    router.replace('/login')
  }
  return hit
}

const bindings = ref<Binding[]>([])
const loaded = ref(false)
const loadError = ref('')

async function load() {
  if (demo.value || !authStore.isLogin) return
  if (document.visibilityState === 'hidden') return   // 分頁沒在看就不打 API,切回來時立刻補一次(見 onVisible)
  try {
    const res = await fetch(`${API}/bot/bindings`, { headers: headers() })
    const body: unknown = await res.json()
    if (expired(body)) return
    if (!res.ok || !Array.isArray(body)) throw new Error(`HTTP ${res.status}`)
    bindings.value = body as Binding[]
    loadError.value = ''
    updateLedgerStreaks()   // 每次輪詢更新「連續對不起來」的次數(跨日重置那一瞬間的假警報要靠它濾掉)
  } catch {
    loadError.value = '讀取失敗,5 秒後自動重試'
  } finally {
    loaded.value = true
  }
}

const fleets = computed<Fleet[]>(() => {
  if (demo.value) return [DEMO_FLEET]
  return bindings.value.flatMap((b) => (isFleet(b.status) ? [{ token: b.token, name: b.name, online: b.online, ageMs: b.ageMs, data: b.status }] : []))
})
/** 已綁定但伺服器還沒送過資料的(剛綁好、伺服器沒重啟) */
const waiting = computed(() => (demo.value ? [] : bindings.value.filter((b) => isEmptyStatus(b.status))))

// ── 綁定 ──
const bindToken = ref('')
const bindName = ref('神盾天堂 假人')
const binding = ref(false)
const bindMsg = ref('')
const bindOk = ref(false)
const showBind = ref(false)

async function doBind() {
  const token = bindToken.value.trim()
  if (token.length < 6) {
    bindOk.value = false
    bindMsg.value = 'token 太短,請從伺服器 config/bot.properties 的 BotWebToken 整段複製'
    return
  }
  binding.value = true
  bindMsg.value = ''
  try {
    const res = await fetch(`${API}/bot/bind`, { method: 'POST', headers: headers(), body: JSON.stringify({ token, name: bindName.value.trim() }) })
    const d = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; msg?: string }
    if (expired(d)) return
    bindOk.value = res.ok && d.success !== false
    bindMsg.value = bindOk.value ? '綁定成功,伺服器回報後就會出現' : (d.message || d.msg || `綁定失敗(HTTP ${res.status})`)
    if (bindOk.value) {
      bindToken.value = ''
      showBind.value = false
      await load()
    }
  } catch {
    bindOk.value = false
    bindMsg.value = '連線失敗,稍後再試'
  } finally {
    binding.value = false
  }
}

async function unbind(token: string, name: string) {
  if (!window.confirm(`解除「${name}」的綁定?之後要重新貼 token 才看得到。`)) return
  await fetch(`${API}/bot/unbind`, { method: 'POST', headers: headers(), body: JSON.stringify({ token }) }).catch(() => undefined)
  await load()
}

let timer: number | undefined
const onVisible = () => {
  if (document.visibilityState === 'visible') load()
}
onMounted(() => {
  load()
  timer = window.setInterval(load, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

// ── 顯示用 ──
const fmt = (n: number) => Math.round(n).toLocaleString('zh-TW')
const signed = (n: number) => (n > 0 ? '+' : '') + fmt(n)
const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a * 100) / b))) : 0)
function timeLeft(sec: number) {
  if (sec < 0) return '常駐'
  if (sec >= 3600) return `${Math.floor(sec / 3600)} 時 ${Math.floor((sec % 3600) / 60)} 分`
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
function duration(min: number) {
  if (min < 60) return `${min} 分`
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return d > 0 ? `${d} 天 ${h} 時` : `${h} 時 ${min % 60} 分`
}
function state(b: BotSnap) {
  if (b.dead) return { text: '死亡', tone: 'bad' }
  if (b.target) return { text: '戰鬥中', tone: 'fight' }
  if (b.goal.includes('回村') || b.goal.includes('逃')) return { text: '回村', tone: 'warn' }
  return { text: '行動中', tone: 'calm' }
}
function totals(f: Fleet) {
  const bots = f.data.bots
  return {
    net: bots.reduce((s, b) => s + b.net, 0),
    kills: bots.reduce((s, b) => s + b.kills, 0),
    deaths: bots.reduce((s, b) => s + b.deaths, 0),
    fighting: bots.filter((b) => !!b.target && !b.dead).length,
    // ⚠️ clanChest 是全隊共用的倉庫餘額,每隻假人都送同一個數字 → 只能取一次,不可以累加
    chest: bots.length ? n0(bots[0]!.clanChest) : 0,
    offBooks: bots.filter((b) => showOffBooks(f, b)).length,
  }
}
/** 伺服器還沒重啟時舊心跳沒有這些欄位,一律補 0,不要讓畫面出現 NaN */
const n0 = (v: number | undefined) => (typeof v === 'number' ? v : 0)

/**
 * 伺服器端的對帳等式(BotRules.netFromFlows):
 *   net = 撿到 + 賣雜物 − 花掉 − 給隊友 + 收到 − 存倉庫 + 領倉庫
 * 對不起來就是又出現沒被記錄的金流 —— 這頁的用途之一就是把它抓出來,所以直接顯示差額。
 */
function ledgerDiff(b: BotSnap) {
  return b.net - (b.gained + b.sold - b.spent - n0(b.aidOut) + n0(b.aidIn) - n0(b.clanOut) + n0(b.clanIn))
}

/**
 * 跨日重置有一瞬間的時序空窗,會讓等式短暫不成立,所以要連續兩次才亮警示:
 * 伺服器 resetDaily() 先把流量歸零(BotPlayer.java:2475-2482),最後一行才更新 adenaAtDayStart(:2485);
 * 心跳是另一條執行緒讀快照、兩邊沒有共用鎖,剛好卡在中間的那一次會拿到「流量 0、日初還是昨天的值」。
 * 不能改用 dayMin 判斷:_dayStart 在 :2483 就更新了,比 adenaAtDayStart 早,卡在 2482~2483 的快照 dayMin 還是舊值。
 */
const ledgerStreak = ref<Record<string, number>>({})
const ledgerKey = (f: Fleet, b: BotSnap) => `${f.token}/${b.name}`
function updateLedgerStreaks() {
  const next: Record<string, number> = {}
  for (const f of fleets.value)
    for (const b of f.data.bots) {
      const k = ledgerKey(f, b)
      next[k] = ledgerDiff(b) !== 0 ? (ledgerStreak.value[k] ?? 0) + 1 : 0
    }
  ledgerStreak.value = next   // 重建而不是累加:假人消失了對應的計數也跟著清掉
}
/** 連續兩次都對不起來才算真的有問題(示範資料沒有輪詢,不做防抖) */
function showOffBooks(f: Fleet, b: BotSnap) {
  if (demo.value) return ledgerDiff(b) !== 0
  return (ledgerStreak.value[ledgerKey(f, b)] ?? 0) >= 2
}

/** 血盟倉庫只認這些階級(伺服器 BotRules.canUseClanWarehouse);其他階級拿不到倉庫互助,標黃提醒 */
const WAREHOUSE_RANKS = ['聯盟副君主', '聯盟君主', '聯盟修習騎士', '聯盟守護騎士', '修習騎士', '守護騎士', '君主']
/** 基本素質:六圍 + AC/MR(含裝備後的實際值) */
function attrs(b: BotSnap) {
  return [
    { k: 'STR', v: n0(b.str) }, { k: 'DEX', v: n0(b.dex) }, { k: 'CON', v: n0(b.con) },
    { k: 'INT', v: n0(b.intel) }, { k: 'WIS', v: n0(b.wis) }, { k: 'CHA', v: n0(b.cha) },
    { k: 'AC', v: n0(b.ac) }, { k: 'MR', v: n0(b.mr) },
  ]
}

/** 頂部等級一覽:等級高到低、同級照名字排 */
function levelSummary(f: Fleet) {
  const sorted = [...f.data.bots].sort((a, b) => b.lv - a.lv || a.name.localeCompare(b.name, 'zh-TW', { numeric: true }))
  const lvs = sorted.map((b) => b.lv)
  return {
    sorted,
    max: lvs.length ? Math.max(...lvs) : 0,
    min: lvs.length ? Math.min(...lvs) : 0,
    avg: lvs.length ? (lvs.reduce((s, v) => s + v, 0) / lvs.length).toFixed(1) : '0',
  }
}

// ── 示範資料(?demo=1)──
function demoBot(p: Partial<BotSnap>): BotSnap {
  return {
    name: 'AI騎士', cls: '騎士', lv: 18, lvDay: 16, expPct: 42, hp: 210, maxHp: 260, mp: 12, maxMp: 20,
    clan: '神盾AI', clanRank: '守護騎士',
    str: 16, dex: 12, con: 14, intel: 8, wis: 11, cha: 10, ac: -18, mr: 12,
    // 這四筆金流要讓 ledgerDiff 等於 0(跟伺服器 BotRules.netFromFlows 同一條等式);clanChest 是全隊共用值
    aidIn: 0, aidOut: 2000, clanIn: 8000, clanOut: 6000, clanChest: 128400,
    map: '說話之島', x: 32600, y: 32920, dead: false, goal: '攻擊 楊果里恩', haste: true, brave: true,
    target: { name: '楊果里恩', lv: 18, hpPct: 55 }, buffs: [],
    adena: 48200, adenaDay: 31000, net: 17200, gained: 21500, sold: 3100, spent: 7400,
    deaths: 1, attacks: 1320, hits: 948, kills: 212, dayMin: 196, bornMin: 1880,
    topKills: [{ name: '楊果里恩', n: 64 }, { name: '食屍鬼', n: 51 }, { name: '萊肯', n: 38 }, { name: '骷髏', n: 30 }],
    topLoot: [{ name: '綠色藥水', n: 9 }, { name: '骨頭碎片', n: 7 }, { name: '強化綠色藥水', n: 3 }, { name: '魔法書 (通暢氣脈術)', n: 1 }],
    ...p,
  }
}
const DEMO_FLEET: Fleet = {
  token: 'demo', name: '神盾天堂 假人(示範資料)', online: true, ageMs: 2000,
  data: {
    kind: 'l1-bots', v: 1, ts: Date.now(), running: true, realPlayers: 3,
    bots: [
      demoBot({}),
      demoBot({
        name: 'AI法師', cls: '法師', lv: 21, lvDay: 19, expPct: 77, hp: 96, maxHp: 150, mp: 64, maxMp: 180, brave: false,
        str: 8, dex: 10, con: 9, intel: 18, wis: 15, cha: 12, ac: -6, mr: 28,
        aidIn: 1500, aidOut: 0, clanIn: 0, clanOut: 1500,
        map: '海音地監 2樓', goal: '攻擊 受詛咒的 鼠人', target: { name: '受詛咒的 鼠人', lv: 28, hpPct: 18 },
        buffs: [{ name: '通暢氣脈術', sec: 214 }, { name: '加速魔力回復', sec: 95 }],
        adena: 36900, adenaDay: 29000, net: 7900, gained: 12800, sold: 900, spent: 5800, deaths: 3, attacks: 610, hits: 455, kills: 133,
        topKills: [{ name: '受詛咒的 鼠人', n: 47 }, { name: '多眼怪', n: 40 }, { name: '蟹人', n: 29 }],
        topLoot: [{ name: '空的魔法卷軸(等級2)', n: 11 }, { name: '綠色藥水', n: 6 }],
      }),
      demoBot({
        name: 'AI妖精', cls: '妖精', lv: 15, lvDay: 15, expPct: 8, hp: 0, maxHp: 170, mp: 30, maxMp: 70, dead: true, haste: false, brave: false,
        clan: '', clanRank: '',   // 還沒入盟:用不到血盟倉庫互助
        str: 11, dex: 16, con: 10, intel: 12, wis: 12, cha: 14, ac: -9, mr: 15,
        aidIn: 0, aidOut: 0, clanIn: 0, clanOut: 0,   // 未入盟:沒有倉庫金流
        map: '古魯丁地監 3樓', goal: '死亡,等待回村', target: null, buffs: [],
        adena: 9100, adenaDay: 12600, net: -3500, gained: 2100, sold: 0, spent: 5600, deaths: 5, attacks: 280, hits: 190, kills: 41,
        topKills: [{ name: '骷髏弓箭手', n: 22 }, { name: '食屍鬼', n: 19 }], topLoot: [],
      }),
    ],
  },
}
</script>

<template>
  <div class="fleet">
    <!-- 不用 <header>:全站樣式在 ≤768px 會把所有 header 藏起來(那是網站頂欄用的),手機上標題跟假人名字會消失 -->
    <div class="top">
      <div>
        <div class="eyebrow">神盾天堂 · 伺服器</div>
        <h1>假人監控</h1>
        <p class="sub">伺服器裡 AI 假人的即時狀態,每 5 秒更新。</p>
      </div>
      <div class="top-actions">
        <span v-if="demo" class="pill demo">示範資料</span>
        <button v-if="authStore.isLogin" type="button" class="btn ghost" @click="router.push('/clan')">回主頁</button>
      </div>
    </div>

    <div v-if="!demo && !authStore.isLogin" class="gate">
      <p class="gate-title">請先登入</p>
      <p class="gate-sub">登入後把伺服器的 token 綁定到你的帳號,就能隨時看假人在做什麼。</p>
      <button type="button" class="btn primary" @click="router.push('/login')">前往登入</button>
    </div>

    <template v-else>
      <p v-if="loadError" class="notice bad">{{ loadError }}</p>

      <!-- 綁定:沒有任何假人資料時直接展開 -->
      <section v-if="!demo" class="bind" :class="{ open: showBind || (!fleets.length && !waiting.length) }">
        <button v-if="fleets.length || waiting.length" type="button" class="bind-toggle" @click="showBind = !showBind">
          {{ showBind ? '收起' : '綁定另一台伺服器' }}
        </button>
        <div v-if="showBind || (!fleets.length && !waiting.length)" class="bind-body">
          <h2>綁定伺服器</h2>
          <p class="hint">打開伺服器的 <code>config/bot.properties</code>,把 <code>BotWebToken</code> 後面那串整段複製,貼到下面。綁定一次就好,伺服器重啟後會自動開始回報。</p>
          <div class="bind-row">
            <input v-model="bindToken" class="in token" placeholder="l1bots-xxxxxxxxxxxxxxxxxxxxxxxx" spellcheck="false" aria-label="伺服器 token" />
            <input v-model="bindName" class="in name" maxlength="20" placeholder="取個名字" aria-label="名稱" />
            <button type="button" class="btn primary" :disabled="binding" @click="doBind">{{ binding ? '綁定中…' : '綁定' }}</button>
          </div>
          <p v-if="bindMsg" class="notice" :class="bindOk ? 'ok' : 'bad'">{{ bindMsg }}</p>
        </div>
      </section>

      <section v-for="w in waiting" :key="w.token" class="waiting">
        <span class="dot"></span>
        <b>{{ w.name }}</b> 已綁定,還沒收到伺服器回報。確認 bot.properties 的 BotWebEnabled = true,並重啟伺服器。
        <button type="button" class="link" @click="unbind(w.token, w.name)">解除</button>
      </section>

      <p v-if="loaded && !fleets.length && !waiting.length && bindings.length" class="notice">
        你綁定的都是 MotionHunter 機器人,請到 <button type="button" class="link" @click="router.push('/bot-monitor')">打怪機器人監控</button> 查看。
      </p>

      <section v-for="f in fleets" :key="f.token" class="server">
        <div class="server-head">
          <div class="server-name">
            <span class="dot" :class="{ on: f.online }"></span>
            <h2>{{ f.name }}</h2>
            <span class="age" :class="{ off: !f.online }">{{ f.online ? `${Math.round(f.ageMs / 1000)} 秒前更新` : '離線' }}</span>
          </div>
          <button v-if="!demo" type="button" class="link" @click="unbind(f.token, f.name)">解除綁定</button>
        </div>

        <div v-if="f.data.bots.length" class="levels">
          <div class="levels-head">
            <h3>等級一覽</h3>
            <span>最高 Lv{{ levelSummary(f).max }} · 最低 Lv{{ levelSummary(f).min }} · 平均 {{ levelSummary(f).avg }}</span>
          </div>
          <ul class="level-list">
            <li v-for="b in levelSummary(f).sorted" :key="b.name" class="lvchip" :class="{ dead: b.dead }">
              <span class="lvname">{{ b.name }}</span>
              <b>Lv{{ b.lv }}</b>
            </li>
          </ul>
        </div>

        <div class="stats">
          <div class="stat"><label>假人</label><b>{{ f.data.bots.length }}</b><span>{{ totals(f).fighting }} 隻戰鬥中</span></div>
          <div class="stat"><label>真人在線</label><b>{{ f.data.realPlayers }}</b><span>{{ f.data.running ? '假人運作中' : '假人已停止' }}</span></div>
          <div class="stat"><label>今日淨收益</label><b :class="{ neg: totals(f).net < 0 }">{{ signed(totals(f).net) }}</b><span>全部假人加總(不含血盟倉庫)</span></div>
          <div class="stat"><label>血盟倉庫</label><b>{{ fmt(totals(f).chest) }}</b><span>全隊共用金庫,存進去的錢不算在淨收益裡</span></div>
          <div class="stat"><label>今日擊殺</label><b>{{ fmt(totals(f).kills) }}</b><span>死亡 {{ totals(f).deaths }} 次</span></div>
        </div>

        <p v-if="totals(f).offBooks" class="notice bad">{{ totals(f).offBooks }} 隻假人的金流對不起來(連續兩次),代表有沒被記錄到的天幣進出。</p>
        <p v-if="!f.data.bots.length" class="notice">伺服器在線,但目前沒有假人在跑。</p>

        <div class="grid">
          <article v-for="b in f.data.bots" :key="b.name" class="bot" :class="{ dead: b.dead }">
            <div class="bot-head">
              <div class="who">
                <span class="cls">{{ b.cls }}</span>
                <h3>{{ b.name }}</h3>
              </div>
              <span class="state" :class="state(b).tone">{{ state(b).text }}</span>
            </div>

            <div class="lvline">
              <span class="lv">Lv <b>{{ b.lv }}</b></span>
              <span v-if="b.lv > b.lvDay" class="up">今日 +{{ b.lv - b.lvDay }}</span>
              <div class="bar exp" role="img" :aria-label="`經驗 ${b.expPct}%`"><i :style="{ width: b.expPct + '%' }"></i></div>
              <span class="pct">{{ b.expPct }}%</span>
            </div>

            <div class="clanline">
              <span class="clanchip" :class="{ none: !b.clan }"><em>血盟</em>{{ b.clan || '未入盟' }}</span>
              <span v-if="b.clanRank" class="clanchip rank" :class="{ warn: !WAREHOUSE_RANKS.includes(b.clanRank) }" :title="WAREHOUSE_RANKS.includes(b.clanRank) ? '這個階級可以用血盟倉庫' : '這個階級用不了血盟倉庫,拿不到倉庫互助'"><em>階級</em>{{ b.clanRank }}</span>
            </div>

            <div class="vitals">
              <div class="vital"><label>HP</label><div class="bar hp"><i :style="{ width: pct(b.hp, b.maxHp) + '%' }"></i></div><span>{{ b.hp }}/{{ b.maxHp }}</span></div>
              <div class="vital"><label>MP</label><div class="bar mp"><i :style="{ width: pct(b.mp, b.maxMp) + '%' }"></i></div><span>{{ b.mp }}/{{ b.maxMp }}</span></div>
            </div>

            <div class="attrs">
              <div v-for="a in attrs(b)" :key="a.k" class="attr"><label>{{ a.k }}</label><b>{{ a.v }}</b></div>
            </div>

            <dl class="kv">
              <div><dt>位置</dt><dd>{{ b.map }}</dd></div>
              <div><dt>在做什麼</dt><dd>{{ b.goal || '—' }}</dd></div>
              <div>
                <dt>目標</dt>
                <dd v-if="b.target" class="target">
                  {{ b.target.name }} <small>Lv{{ b.target.lv }}</small>
                  <span class="bar thp"><i :style="{ width: b.target.hpPct + '%' }"></i></span>
                </dd>
                <dd v-else class="muted">—</dd>
              </div>
            </dl>

            <div class="block">
              <h4>BUFF</h4>
              <div class="chips">
                <span v-if="b.haste" class="chip">加速</span>
                <span v-if="b.brave" class="chip">勇敢</span>
                <span v-for="x in b.buffs" :key="x.name" class="chip">{{ x.name }}<em>{{ timeLeft(x.sec) }}</em></span>
                <span v-if="!b.haste && !b.brave && !b.buffs.length" class="muted">沒有</span>
              </div>
            </div>

            <div class="block money">
              <div class="net">
                <label>今日淨收益</label>
                <b :class="{ neg: b.net < 0 }">{{ signed(b.net) }}</b>
              </div>
              <div class="flows">
                <span>現有 <b>{{ fmt(b.adena) }}</b></span>
                <span>打怪撿到 <b>{{ fmt(b.gained) }}</b></span>
                <span>賣雜物 <b>{{ fmt(b.sold) }}</b></span>
                <span>花掉 <b>{{ fmt(b.spent) }}</b></span>
                <span>給隊友 <b>{{ fmt(n0(b.aidOut)) }}</b></span>
                <span>收到 <b>{{ fmt(n0(b.aidIn)) }}</b></span>
                <span>存倉庫 <b>{{ fmt(n0(b.clanOut)) }}</b></span>
                <span>領倉庫 <b>{{ fmt(n0(b.clanIn)) }}</b></span>
              </div>
              <p v-if="showOffBooks(f, b)" class="offbooks">帳目差 {{ signed(ledgerDiff(b)) }}:有沒被記錄到的金流</p>
            </div>

            <div class="lists">
              <div class="block">
                <h4>打到 <small>共 {{ fmt(b.kills) }} 隻</small></h4>
                <ol v-if="b.topKills.length">
                  <li v-for="k in b.topKills" :key="k.name"><span>{{ k.name }}</span><b>{{ fmt(k.n) }}</b></li>
                </ol>
                <p v-else class="muted">還沒有</p>
              </div>
              <div class="block">
                <h4>撿到</h4>
                <ol v-if="b.topLoot.length">
                  <li v-for="k in b.topLoot" :key="k.name"><span>{{ k.name }}</span><b>{{ fmt(k.n) }}</b></li>
                </ol>
                <p v-else class="muted">還沒有</p>
              </div>
            </div>

            <footer class="bot-foot">
              <span>死亡 {{ b.deaths }} 次</span>
              <span>命中 {{ pct(b.hits, b.attacks) }}%</span>
              <span>今日 {{ duration(b.dayMin) }}</span>
              <span v-if="b.bornMin >= 0">創角 {{ duration(b.bornMin) }}</span>
            </footer>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.fleet {
  --ink: #e9edf7;
  --ink-2: rgba(233, 237, 247, 0.72);
  --ink-3: rgba(233, 237, 247, 0.48);
  --line: rgba(var(--c-light-rgb), 0.16);
  --panel: rgba(255, 255, 255, 0.035);
  --good: #3ddc97;
  --bad: #ff6b7a;
  --warn: #ffc15e;
  width: 100%;
  min-height: 100vh;
  padding: 32px clamp(16px, 4vw, 48px) 64px;
  color: var(--ink);
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(var(--c-deep-rgb), 0.16), transparent 60%),
    radial-gradient(900px 400px at 100% 0%, rgba(var(--c-light-rgb), 0.1), transparent 60%),
    #070b16;
  font-size: 15px;
  box-sizing: border-box;
}
.fleet *, .fleet *::before, .fleet *::after { box-sizing: border-box; }
.fleet button { all: unset; box-sizing: border-box; cursor: pointer; }
.fleet button:focus-visible, .fleet input:focus-visible { outline: 2px solid var(--c-light); outline-offset: 2px; }
.fleet input { all: unset; box-sizing: border-box; }
.fleet h1, .fleet h2, .fleet h3, .fleet h4, .fleet p, .fleet dl, .fleet dd, .fleet ol { margin: 0; }

.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; max-width: 1400px; margin: 0 auto 24px; }
.eyebrow { font-size: 12px; letter-spacing: 0.16em; color: var(--c-light); margin-bottom: 6px; }
.top h1 { font-size: clamp(26px, 3.4vw, 34px); font-weight: 700; letter-spacing: 0.02em; }
.sub { color: var(--ink-3); margin-top: 6px; }
.top-actions { display: flex; align-items: center; gap: 10px; }

.btn { display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 18px; border-radius: 10px; font-weight: 600; font-size: 14px; white-space: nowrap; }
.btn.primary { background: linear-gradient(135deg, var(--c-light), var(--c-deep)); color: var(--c-on); }
.btn.primary[disabled] { opacity: 0.55; cursor: default; }
.btn.ghost { border: 1px solid var(--line); color: var(--ink-2); }
.btn.ghost:hover { color: var(--ink); border-color: rgba(var(--c-light-rgb), 0.4); }
.link { color: var(--c-light); font-size: 14px; }
.link:hover { text-decoration: underline; }
.pill { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-2); }
.pill.demo { border-color: rgba(var(--c-light-rgb), 0.45); color: var(--c-light); }

.gate { max-width: 460px; margin: 80px auto; text-align: center; padding: 36px 28px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); display: grid; gap: 12px; justify-items: center; }
.gate-title { font-size: 20px; font-weight: 700; }
.gate-sub { color: var(--ink-3); line-height: 1.7; }

.notice { max-width: 1400px; margin: 0 auto 16px; color: var(--ink-2); font-size: 14px; }
.notice.ok { color: var(--good); }
.notice.bad { color: var(--bad); }

.bind { max-width: 1400px; margin: 0 auto 20px; }
.bind-toggle { color: var(--c-light); font-size: 14px; }
.bind-body { margin-top: 10px; padding: 20px 22px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); display: grid; gap: 12px; }
.bind-body h2 { font-size: 17px; }
.hint { color: var(--ink-2); line-height: 1.7; font-size: 14px; }
.hint code { font-family: ui-monospace, 'JetBrains Mono', Consolas, monospace; font-size: 13px; padding: 1px 6px; border-radius: 6px; background: rgba(var(--c-light-rgb), 0.1); color: var(--c-light); }
.bind-row { display: flex; gap: 10px; flex-wrap: wrap; }
.in { height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0, 0, 0, 0.25); color: var(--ink); font-size: 14px; }
.in::placeholder { color: var(--ink-3); }
.in.token { flex: 2 1 280px; font-family: ui-monospace, Consolas, monospace; }
.in.name { flex: 1 1 160px; }

.waiting { max-width: 1400px; margin: 0 auto 16px; padding: 14px 18px; border: 1px dashed var(--line); border-radius: 12px; color: var(--ink-2); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 14px; }

.server { max-width: 1400px; margin: 0 auto 36px; }
.server-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.server-name { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.server-name h2 { font-size: 19px; }
.age { font-size: 13px; color: var(--good); }
.age.off { color: var(--bad); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--bad); flex: none; }
.dot.on { background: var(--good); box-shadow: 0 0 10px rgba(61, 220, 151, 0.6); }
.waiting .dot { background: var(--warn); }

.levels { margin-bottom: 14px; padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); display: grid; gap: 10px; }
.levels-head { display: flex; justify-content: space-between; align-items: baseline; gap: 4px 12px; flex-wrap: wrap; }
.levels-head h3 { font-size: 14px; font-weight: 600; color: var(--ink-2); letter-spacing: 0.06em; }
.levels-head span { font-size: 12.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.level-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.lvchip { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 34px; padding: 6px 10px; border-radius: 8px; background: rgba(var(--c-light-rgb), 0.07); border: 1px solid rgba(var(--c-light-rgb), 0.16); font-size: 13.5px; line-height: 1.3; }
.lvname { color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
.lvchip b { flex: none; color: var(--c-light); font-weight: 700; font-variant-numeric: tabular-nums; }
.lvchip.dead { border-color: rgba(255, 107, 122, 0.4); }
.lvchip.dead b { color: var(--bad); }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 12px; margin-bottom: 18px; }
.stat { padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); display: grid; gap: 2px; }
.stat label { font-size: 12px; color: var(--ink-3); letter-spacing: 0.06em; }
.stat b { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }
.stat b.neg { color: var(--bad); }
.stat span { font-size: 12.5px; color: var(--ink-3); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }
.bot { padding: 16px 18px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); display: grid; gap: 12px; align-content: start; }
.bot.dead { border-color: rgba(255, 107, 122, 0.35); }
.bot-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.who { display: flex; align-items: center; gap: 8px; min-width: 0; }
.who h3 { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
.cls { font-size: 12px; padding: 2px 8px; border-radius: 6px; background: rgba(var(--c-light-rgb), 0.12); color: var(--c-light); flex: none; }
.state { font-size: 12.5px; padding: 3px 10px; border-radius: 999px; flex: none; border: 1px solid; }
.state.fight { color: var(--c-light); border-color: rgba(var(--c-light-rgb), 0.45); }
.state.calm { color: var(--ink-2); border-color: var(--line); }
.state.warn { color: var(--warn); border-color: rgba(255, 193, 94, 0.45); }
.state.bad { color: var(--bad); border-color: rgba(255, 107, 122, 0.5); }

.lvline { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 10px; }
.lv { font-size: 14px; color: var(--ink-2); }
.lv b { font-size: 20px; color: var(--ink); font-variant-numeric: tabular-nums; }
.up { font-size: 12px; color: var(--good); }
.pct { font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

.bar { position: relative; height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; display: block; }
.bar i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; transition: width 0.4s ease; }
.bar.exp i { background: linear-gradient(90deg, var(--c-light), var(--c-deep)); }
.bar.hp i { background: linear-gradient(90deg, #ff5d6c, #ff8a5c); }
.bar.mp i { background: linear-gradient(90deg, #4f8dff, #6cc6ff); }
.bar.thp { display: inline-block; width: 64px; height: 6px; vertical-align: middle; margin-left: 6px; }
.bar.thp i { background: #ff8a5c; }

.clanline { display: flex; flex-wrap: wrap; gap: 6px; }
.clanchip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-2); }
.clanchip em { font-style: normal; font-size: 11px; letter-spacing: 0.08em; color: var(--ink-3); }
.clanchip.none { color: var(--ink-3); border-style: dashed; }
.clanchip.rank { color: var(--c-light); border-color: rgba(var(--c-light-rgb), 0.35); }
.clanchip.rank.warn { color: var(--warn); border-color: rgba(255, 193, 94, 0.45); }

.attrs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.attr { display: grid; gap: 1px; justify-items: center; padding: 6px 4px; border-radius: 8px; background: rgba(0, 0, 0, 0.22); }
.attr label { font-size: 10.5px; letter-spacing: 0.08em; color: var(--ink-3); }
.attr b { font-size: 15px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

.vitals { display: grid; gap: 6px; }
.vital { display: grid; grid-template-columns: 26px 1fr 78px; align-items: center; gap: 10px; }
.vital label { font-size: 12px; color: var(--ink-3); }
.vital span { font-size: 13px; color: var(--ink-2); text-align: right; font-variant-numeric: tabular-nums; }

.kv { display: grid; gap: 6px; }
.kv div { display: grid; grid-template-columns: 72px 1fr; gap: 10px; font-size: 14px; }
.kv dt { color: var(--ink-3); }
.kv dd { color: var(--ink); overflow-wrap: anywhere; }
.kv small { color: var(--ink-3); }
.muted { color: var(--ink-3); font-size: 14px; }

.block h4 { font-size: 13px; color: var(--ink-3); font-weight: 600; letter-spacing: 0.06em; margin-bottom: 6px; }
.block h4 small { font-weight: 400; margin-left: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px; border-radius: 999px; background: rgba(var(--c-light-rgb), 0.1); color: var(--ink); border: 1px solid rgba(var(--c-light-rgb), 0.2); }
.chip em { font-style: normal; font-size: 12px; color: var(--c-light); font-variant-numeric: tabular-nums; }

.money { padding: 12px 14px; border-radius: 10px; background: rgba(0, 0, 0, 0.22); display: grid; gap: 8px; }
.net { display: flex; justify-content: space-between; align-items: baseline; }
.net label { font-size: 13px; color: var(--ink-3); }
.net b { font-size: 22px; font-weight: 700; color: var(--good); font-variant-numeric: tabular-nums; }
.net b.neg { color: var(--bad); }
.flows { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 13px; color: var(--ink-3); }
.flows b { color: var(--ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }
.offbooks { font-size: 12.5px; color: var(--warn); padding-top: 6px; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }

.lists { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lists ol { list-style: none; padding: 0; display: grid; gap: 4px; }
.lists li { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; color: var(--ink-2); }
.lists li span { overflow-wrap: anywhere; }
.lists li b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }

.bot-foot { display: flex; flex-wrap: wrap; gap: 6px 14px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--ink-3); }

@media (max-width: 900px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .top { flex-direction: column; }
  .grid { grid-template-columns: 1fr; }
  .lists { grid-template-columns: 1fr; }
  .level-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .btn.primary { width: 100%; }
}
</style>
