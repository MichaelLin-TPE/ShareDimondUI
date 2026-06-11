<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useBalanceStore } from '@/stores/balanceTool'
import { useAlert } from '@/utils/alerts'
import { generateSignature } from '@/utils/SignTools'
import type { Balance } from '@/types/balance'

const API = 'https://api.gameshare-system.com'

const authStore = useAuthStore()
const balanceStore = useBalanceStore()

const isLeader = computed(() => authStore.member?.role === 'LEADER')

// ---- 狀態 ----
const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣']

const loading = ref(true)
const spinning = ref(false)

const config = ref({
  currency: '',
  enabled: true,
  betAmount: 10,
  rakeRate: 0.02,
  maxPayout: 1000000,
  rtp: 0,
  houseEdge: 0,
})

const walletBalance = ref(0)
const jackpotBalance = ref(0)
const reels = ref<string[]>(['🍒', '🔔', '7️⃣'])
const clientSeed = ref('')

// 莊家座位
const banker = ref({ hasBanker: false, bankerName: '', bankroll: 0, isMe: false })

// 下注倍率
const betMultipliers = ref<number[]>([1, 2, 3, 5, 10])
const selectedMultiplier = ref(1)
const effectiveBet = computed(() => Number(config.value.betAmount || 0) * selectedMultiplier.value)

// 自動轉
const autoRunning = ref(false)
const autoTotal = ref(0)
const autoDone = ref(0)
let autoStop = false

const lastResult = ref<{ win: boolean; payout: number; multiplier: number; message: string } | null>(null)
const fair = ref<{ serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number } | null>(null)
const showFair = ref(false)

// 777 頭獎尊榮動畫
const showJackpot = ref(false)
const jackpotWin = ref(0) // 滾動中的總額
const jackpotPoolWin = ref(0) // 其中獨得彩金池的部分
function triggerJackpot(total: number, poolWin = 0) {
  showJackpot.value = true
  jackpotPoolWin.value = poolWin
  jackpotWin.value = 0
  const dur = 1400
  const t0 = Date.now()
  const tick = () => {
    const p = Math.min(1, (Date.now() - t0) / dur)
    const eased = 0.5 - Math.cos(p * Math.PI) / 2 // ease-in-out
    jackpotWin.value = Math.floor(total * eased)
    if (p < 1) requestAnimationFrame(tick)
    else jackpotWin.value = total
  }
  requestAnimationFrame(tick)
}
function closeJackpot() {
  showJackpot.value = false
}

// ---- 工具 ----
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
// 一律不顯示小數點（虛擬幣為整數）
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

// 機率 → 「每 N 把」
function oddsText(p: number): string {
  if (!p || p <= 0) return ''
  return '每 ' + Math.round(1 / p).toLocaleString('en-US') + ' 把'
}

// 是否可下注（不含 spinning / auto 狀態）
const eligible = computed(
  () =>
    config.value.enabled &&
    banker.value.hasBanker &&
    !banker.value.isMe &&
    walletBalance.value >= effectiveBet.value &&
    effectiveBet.value <= banker.value.bankroll,
)
const canSpin = computed(() => !spinning.value && !autoRunning.value && eligible.value)

// 不能下注的原因（給提示用）
function ineligibleReason(): string {
  if (!config.value.enabled) return '拉霸機目前未開放'
  if (!banker.value.hasBanker) return '目前沒有莊家，先坐莊或等人坐莊'
  if (banker.value.isMe) return '你是莊家，不能玩自己的莊'
  if (effectiveBet.value > banker.value.bankroll)
    return `下注額不可超過莊家本金 ${fmt(banker.value.bankroll)}，請降低倍率`
  if (walletBalance.value < effectiveBet.value) return '餘額不足'
  return ''
}

interface PayRow {
  reels: string
  label: string
  mult: string
  odds: string
}

// 後端動態賠率表（含機率）；未載入前用靜態 fallback
const paytable = ref<PayRow[]>([])
const STATIC_PAYTABLE: PayRow[] = [
  { reels: '7️⃣ 7️⃣ 7️⃣', label: '頭獎', mult: '×30', odds: '' },
  { reels: '⭐ ⭐ ⭐', label: '', mult: '×16', odds: '' },
  { reels: '🔔 🔔 🔔', label: '', mult: '×8', odds: '' },
  { reels: '🍋 🍋 🍋', label: '', mult: '×4', odds: '' },
  { reels: '🍒 🍒 🍒', label: '', mult: '×3', odds: '' },
  { reels: '7️⃣ 7️⃣ ·', label: '', mult: '×2.5', odds: '' },
  { reels: '⭐ ⭐ ·', label: '', mult: '×1.7', odds: '' },
  { reels: '🍒/🍋/🔔 兩個', label: '小賺', mult: '×1.2~1.3', odds: '' },
]
const displayPaytable = computed<PayRow[]>(() =>
  paytable.value.length ? paytable.value : STATIC_PAYTABLE,
)

// ---- API ----
async function loadConfig() {
  const res = await fetch(`${API}/slot/config`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  config.value = {
    currency: d.currency ?? '',
    enabled: d.enabled,
    betAmount: Number(d.betAmount),
    rakeRate: Number(d.rakeRate),
    maxPayout: Number(d.maxPayout),
    rtp: Number(d.rtp),
    houseEdge: Number(d.houseEdge),
  }
  if (Array.isArray(d.betMultipliers) && d.betMultipliers.length) {
    betMultipliers.value = d.betMultipliers
    if (!betMultipliers.value.includes(selectedMultiplier.value)) {
      selectedMultiplier.value = betMultipliers.value[0] ?? 1
    }
  }
  paytable.value = Array.isArray(d.paytable)
    ? d.paytable.map(
        (r: { reels: string; label?: string; multiplier: number; probability: number }): PayRow => ({
          reels: r.reels,
          label: r.label || '',
          mult: '×' + r.multiplier,
          odds: oddsText(r.probability),
        }),
      )
    : []
}

async function loadJackpot() {
  const res = await fetch(`${API}/slot/jackpot-pools`, { headers: headers() })
  if (!res.ok) return
  const list: { currencyCode: string; balance: number }[] = await res.json()
  const pool = list.find((p) => p.currencyCode === config.value.currency)
  jackpotBalance.value = pool ? Number(pool.balance) : 0
}

async function loadWallet() {
  const res = await fetch(`${API}/getBalance`, { headers: headers() })
  if (!res.ok) return
  // /getBalance 回傳 { memberBalanceResponseList, clanBalanceResponseList }
  const data: { memberBalanceResponseList?: Balance[]; clanBalanceResponseList?: Balance[] } =
    await res.json()
  const list = data.memberBalanceResponseList ?? []
  balanceStore.setBalanceList(list)
  const w = list.find((b) => b.currency === config.value.currency)
  walletBalance.value = w ? Number(w.balance) : 0
}

async function loadBank() {
  const res = await fetch(`${API}/slot/bank`, { headers: headers() })
  if (!res.ok) return
  const d = await res.json()
  banker.value = {
    hasBanker: !!d.hasBanker,
    bankerName: d.bankerName ?? '',
    bankroll: Number(d.bankroll ?? 0),
    isMe: !!d.isMe,
  }
}

async function loadAll() {
  loading.value = true
  try {
    await loadConfig()
    await Promise.all([loadWallet(), loadJackpot(), loadBank()])
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 坐莊 / 搶莊
async function takeBank() {
  const challenge = banker.value.hasBanker
  const title = challenge ? '搶莊' : '我要坐莊'
  const hint = challenge
    ? `本金必須大於現任莊家 ${fmt(banker.value.bankroll)}`
    : '輸入你要投入的本金（= 最多可輸的金額）'
  const input = await useAlert.inputDialog(hint, title)
  const amount = Number(input)
  if (!amount || amount <= 0) return
  if (challenge && amount <= banker.value.bankroll) {
    useAlert.error(`搶莊本金必須大於現任莊家 ${fmt(banker.value.bankroll)}`)
    return
  }
  try {
    const res = await fetch(`${API}/slot/bank/take`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ amount }),
    })
    const d = await res.json()
    if (!res.ok) {
      useAlert.error(d.message ?? '坐莊失敗')
      return
    }
    useAlert.success(d.message)
    await Promise.all([loadBank(), loadWallet()])
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
    if (!res.ok) {
      useAlert.error(d.message ?? '下莊失敗')
      return
    }
    useAlert.success(d.message)
    await Promise.all([loadBank(), loadWallet()])
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

let animTimer: number | undefined
function startAnim() {
  animTimer = window.setInterval(() => {
    reels.value = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!)
  }, 70)
}
function stopAnim() {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = undefined
  }
}

// 單次轉動（假設呼叫端已確認可下注）。回傳是否成功，可繼續。
async function spinOnce(fast = false): Promise<Record<string, unknown> | null> {
  spinning.value = true
  lastResult.value = null
  startAnim()
  try {
    const [res] = await Promise.all([
      fetch(`${API}/slot/spin`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          clientSeed: clientSeed.value || undefined,
          betMultiplier: selectedMultiplier.value,
        }),
      }),
      delay(fast ? 320 : 900),
    ])
    const d = await res.json()
    stopAnim()
    if (!res.ok) {
      useAlert.error(d.message ?? '拉霸失敗')
      return null
    }
    reels.value = d.reels
    walletBalance.value = Number(d.balanceAfter)
    jackpotBalance.value = Number(d.jackpotBalance)
    lastResult.value = {
      win: d.win,
      payout: Number(d.payout),
      multiplier: Number(d.multiplier),
      message: d.message,
    }
    fair.value = {
      serverSeed: d.serverSeed,
      serverSeedHash: d.serverSeedHash,
      clientSeed: d.clientSeed,
      nonce: d.nonce,
    }
    const list = balanceStore.balanceList.map((b) =>
      b.currency === config.value.currency ? { ...b, balance: String(d.balanceAfter) } : b,
    )
    balanceStore.setBalanceList(list)
    await loadBank() // 莊家本金已變動
    if (d.jackpot)
      triggerJackpot(Number(d.payout) + Number(d.poolWin || 0), Number(d.poolWin || 0)) // 777 尊榮動畫(含彩金池)
    return d
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗，請稍後再試')
    return null
  } finally {
    stopAnim()
    spinning.value = false
  }
}

// 手動單轉
async function spin() {
  if (spinning.value || autoRunning.value) return
  if (!eligible.value) {
    useAlert.error(ineligibleReason())
    return
  }
  await spinOnce(false)
}

// 自動轉 N 次（轉前防呆：餘額是否夠 N 次）
async function startAuto(times: number) {
  if (autoRunning.value || spinning.value) return
  // 防呆
  if (!eligible.value) {
    useAlert.error(ineligibleReason())
    return
  }
  const need = effectiveBet.value * times
  if (walletBalance.value < need) {
    useAlert.error(
      `餘額不足：自動轉 ${times} 次需要 ${fmt(need)} ${config.value.currency}，你目前只有 ${fmt(walletBalance.value)}`,
    )
    return
  }

  autoStop = false
  autoRunning.value = true
  autoTotal.value = times
  autoDone.value = 0
  const startWallet = walletBalance.value
  let jackpotStopped = false
  try {
    for (let i = 0; i < times; i++) {
      if (autoStop) break
      if (!eligible.value) {
        useAlert.error('自動轉中止：' + ineligibleReason())
        break
      }
      const d = await spinOnce(true)
      autoDone.value = i + 1
      if (!d) break
      if (d.jackpot) {
        jackpotStopped = true // 中頭獎,停下放尊榮動畫,不再續轉
        break
      }
      if (autoStop) break
      await delay(260)
    }
  } finally {
    autoRunning.value = false
    // 中頭獎時不跳結算 toast(讓尊榮動畫獨佔畫面)
    if (!jackpotStopped) {
      const net = walletBalance.value - startWallet
      const sign = net >= 0 ? '+' : '−'
      useAlert.success(`自動轉結束（${autoDone.value} 次）淨${net >= 0 ? '賺' : '賠'} ${sign}${fmt(Math.abs(net))}`)
    }
  }
}

function stopAuto() {
  autoStop = true
}

onMounted(loadAll)
</script>

<template>
  <div class="slot-container">
    <div class="title-wrap">
      <h2 class="title">🎰 拉霸機</h2>
      <p class="subtitle">用 {{ config.currency || '基準幣' }} 試手氣 · 玩家當莊，你跟莊家對賭</p>
    </div>

    <!-- 上方資訊卡 -->
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">我的餘額</div>
        <div class="stat-value">{{ fmt(walletBalance) }}</div>
        <div class="stat-unit">{{ config.currency }}</div>
      </div>
      <div class="stat-card jackpot">
        <div class="stat-label">🏆 彩金池</div>
        <div class="stat-value">{{ fmt(jackpotBalance) }}</div>
        <div class="stat-unit">{{ config.currency }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本次下注</div>
        <div class="stat-value">{{ fmt(effectiveBet) }}</div>
        <div class="stat-unit">{{ config.currency }} · ×{{ selectedMultiplier }}</div>
      </div>
    </section>

    <!-- 莊家座位 -->
    <section class="banker-card" :class="{ mine: banker.isMe, empty: !banker.hasBanker }">
      <div class="banker-info">
        <div class="banker-line">
          <span class="banker-emoji">👑</span>
          <span class="banker-name">
            <template v-if="banker.hasBanker">
              莊家：{{ banker.bankerName }}<span v-if="banker.isMe">（你）</span>
            </template>
            <template v-else>目前沒有莊家</template>
          </span>
        </div>
        <div v-if="banker.hasBanker" class="banker-roll">
          本金 {{ fmt(banker.bankroll) }} {{ config.currency }} · 單次最高可贏 ≈ {{ fmt(banker.bankroll) }}
        </div>
        <div v-else class="banker-roll">先有人坐莊才能玩</div>
      </div>
      <div class="banker-actions">
        <button v-if="banker.isMe" class="bank-btn leave" @click="leaveBank">下莊</button>
        <button v-else class="bank-btn take" @click="takeBank">
          {{ banker.hasBanker ? '搶莊' : '我要坐莊' }}
        </button>
      </div>
    </section>

    <!-- 機台 -->
    <section class="machine" :class="{ win: lastResult?.win }">
      <div class="reels">
        <div v-for="(s, i) in reels" :key="i" class="reel" :class="{ rolling: spinning }">
          {{ s }}
        </div>
      </div>

      <div class="result-line">
        <template v-if="loading">載入中…</template>
        <template v-else-if="spinning">轉動中…</template>
        <template v-else-if="lastResult">
          <span :class="lastResult.win ? 'res-win' : 'res-lose'">
            {{ lastResult.message }}
            <template v-if="lastResult.payout > 0">
              （×{{ lastResult.multiplier }}，+{{ fmt(lastResult.payout) }} {{ config.currency }}）
            </template>
          </span>
        </template>
        <template v-else>拉一把試試 👇</template>
      </div>

      <div class="mult-row">
        <span class="mult-label">倍率</span>
        <div class="mult-group">
          <button
            v-for="m in betMultipliers"
            :key="m"
            class="mult-btn"
            :class="{ active: selectedMultiplier === m }"
            :disabled="spinning || autoRunning"
            @click="selectedMultiplier = m"
          >
            {{ m }}x
          </button>
        </div>
      </div>

      <button class="spin-btn" :disabled="!canSpin || loading" @click="spin">
        <span v-if="spinning && !autoRunning">🎲 轉動中…</span>
        <span v-else>SPIN（-{{ fmt(effectiveBet) }} {{ config.currency }}）</span>
      </button>

      <!-- 自動轉 -->
      <div class="auto-row" v-if="!autoRunning">
        <button class="auto-btn" :disabled="!canSpin || loading" @click="startAuto(10)">
          ⟳ 自動轉 10 次
        </button>
        <button class="auto-btn" :disabled="!canSpin || loading" @click="startAuto(30)">
          ⟳ 自動轉 30 次
        </button>
      </div>
      <div class="auto-running" v-else>
        <span class="auto-progress">自動轉中… {{ autoDone }} / {{ autoTotal }}</span>
        <button class="auto-stop" @click="stopAuto">■ 停止</button>
      </div>

      <p v-if="!config.enabled && !loading" class="closed-hint">⚠️ 拉霸機目前未開放</p>
      <p v-else-if="!loading && !banker.hasBanker" class="closed-hint">⏳ 等待有人坐莊</p>
      <p v-else-if="!loading && banker.isMe" class="closed-hint">👑 你是莊家，不能玩自己的莊</p>
      <p v-else-if="!loading && effectiveBet > banker.bankroll" class="closed-hint">
        ⚠️ 此注超過莊家本金，請降低倍率
      </p>
    </section>

    <!-- 賠率表 -->
    <section class="card">
      <div class="card-head">
        <h3 class="card-title">賠率表</h3>
        <span class="rtp-badge" v-if="config.rtp">
          返還率 {{ (config.rtp * 100).toFixed(1) }}%
        </span>
      </div>
      <div class="paytable">
        <div v-for="row in displayPaytable" :key="row.reels" class="pay-row">
          <span class="pay-reel">{{ row.reels }}</span>
          <span class="pay-odds">{{ row.odds }}</span>
          <span v-if="row.label" class="pay-label">{{ row.label }}</span>
          <span class="pay-mult">{{ row.mult }}</span>
        </div>
      </div>
    </section>

    <!-- 公平驗證 -->
    <section class="card" v-if="fair">
      <button class="collapse-head" @click="showFair = !showFair">
        <span>🔒 本局公平驗證 (provably fair)</span>
        <span>{{ showFair ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showFair" class="fair-body">
        <p class="fair-note">
          結果 = HMAC-SHA256(serverSeed, clientSeed:nonce)，可自行重算驗證未被竄改。
        </p>
        <div class="fair-row"><span>serverSeed</span><code>{{ fair.serverSeed }}</code></div>
        <div class="fair-row"><span>hash</span><code>{{ fair.serverSeedHash }}</code></div>
        <div class="fair-row"><span>clientSeed</span><code>{{ fair.clientSeed }}</code></div>
        <div class="fair-row"><span>nonce</span><code>{{ fair.nonce }}</code></div>
      </div>
    </section>

    <p v-if="isLeader" class="leader-link">⚙️ 下注額與輸贏分配請到「血盟設置 → 拉霸機設定」調整</p>

    <!-- 777 尊榮頭獎動畫 -->
    <Teleport to="body">
      <div v-if="showJackpot" class="jp-overlay" @click="closeJackpot">
        <div class="jp-rays"></div>
        <span
          v-for="n in 18"
          :key="n"
          class="jp-confetti"
          :style="{
            left: (n * 5.5) + '%',
            animationDelay: (n % 6) * 0.18 + 's',
            background: ['#ffd166', '#6cf2ff', '#b46eff', '#ff6b9d', '#44d62c'][n % 5],
          }"
        ></span>
        <div class="jp-card" @click.stop>
          <div class="jp-title">🎰 JACKPOT 頭獎 🎰</div>
          <div class="jp-reels">
            <span class="jp-7">7️⃣</span><span class="jp-7">7️⃣</span><span class="jp-7">7️⃣</span>
          </div>
          <div class="jp-amount">+{{ fmt(jackpotWin) }}</div>
          <div class="jp-currency">{{ config.currency }}</div>
          <div v-if="jackpotPoolWin > 0" class="jp-pool">💰 獨得彩金池 +{{ fmt(jackpotPoolWin) }}</div>
          <button class="jp-close" @click="closeJackpot">太爽啦！收下 🎉</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.slot-container {
  padding: 24px 18px 60px;
  max-width: 560px;
  margin: 0 auto;
}

.title-wrap {
  text-align: center;
  margin-bottom: 18px;
}
.title {
  margin: 0 0 4px;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-light);
  text-shadow: 0 0 6px rgba(var(--c-light-rgb), 0.45), 0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

/* 資訊卡 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.stat-card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 12px 10px;
  text-align: center;
}
.stat-card.jackpot {
  border-color: rgba(var(--c-light-rgb), 0.45);
  box-shadow: 0 0 14px rgba(var(--c-deep-rgb), 0.2);
}
.stat-label {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  color: #f1f5f9;
  line-height: 1.1;
}
.stat-unit {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 2px;
}

/* 莊家卡 */
.banker-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 14px;
}
.banker-card.mine {
  border-color: rgba(var(--c-light-rgb), 0.5);
}
.banker-card.empty {
  border-style: dashed;
}
.banker-info {
  min-width: 0;
}
.banker-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.banker-emoji {
  font-size: 1.1rem;
}
.banker-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #f1f5f9;
}
.banker-roll {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
}
.banker-actions {
  flex: 0 0 auto;
}
.bank-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto; /* 寬度隨字長度 */
  padding: 9px 14px; /* 貼字, 用 padding 撐大小 */
  border: none;
  border-radius: 9px;
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  box-sizing: border-box;
  cursor: pointer;
}
.bank-btn.take {
  color: var(--c-on);
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
}
.bank-btn.leave {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

/* 機台 */
.machine {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 16px;
  padding: 22px 18px;
  margin-bottom: 18px;
  transition: box-shadow 0.3s;
}
.machine.win {
  box-shadow: 0 0 24px rgba(var(--c-light-rgb), 0.5);
  border-color: var(--c-light);
}
.reels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.reel {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  line-height: 1;
  background: #0e0f13;
  border: 1px solid #24263a;
  border-radius: 12px;
  user-select: none;
}
.reel.rolling {
  filter: blur(1px);
  opacity: 0.9;
}
.result-line {
  text-align: center;
  min-height: 24px;
  margin-bottom: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #cbd5e1;
}
.res-win {
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.5);
}
.res-lose {
  color: #94a3b8;
}
.mult-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.mult-label {
  font-size: 0.8rem;
  color: #94a3b8;
  flex: 0 0 auto;
}
.mult-group {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
}
.mult-btn {
  flex: 1 1 0;
  height: 38px;
  border: 1px solid #24263a;
  border-radius: 8px;
  background: #0e0f13;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s;
}
.mult-btn:hover:not(:disabled):not(.active) {
  color: #fff;
  border-color: rgba(var(--c-light-rgb), 0.4);
}
.mult-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-color: transparent;
}
.mult-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin-btn {
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  color: var(--c-on);
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.4);
  transition: transform 0.1s, opacity 0.2s;
}
.spin-btn:active:not(:disabled) {
  transform: scale(0.98);
}
.spin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 自動轉 */
.auto-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.auto-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 42px;
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
  border-radius: 10px;
  background: rgba(var(--c-light-rgb), 0.08);
  color: var(--c-light);
  font-size: 0.88rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.auto-btn:hover:not(:disabled) {
  background: rgba(var(--c-light-rgb), 0.16);
}
.auto-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.auto-running {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.auto-progress {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--c-light);
}
.auto-stop {
  height: 42px;
  padding: 0 22px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.14);
  color: #fca5a5;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}
.closed-hint {
  text-align: center;
  color: #f59e0b;
  font-size: 0.85rem;
  margin: 12px 0 0;
}

/* 通用卡片 */
.card {
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid #24263a;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #f1f5f9;
}
.rtp-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
  border-radius: 999px;
  padding: 3px 10px;
}

/* 賠率表 */
.paytable {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pay-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}
.pay-reel {
  font-size: 1rem;
  letter-spacing: 2px;
  flex: 0 0 auto;
}
.pay-odds {
  flex: 1 1 auto;
  font-size: 0.72rem;
  color: #94a3b8;
}
.pay-label {
  flex: 0 0 auto;
  font-size: 0.68rem;
  color: var(--c-on);
  background: var(--c-light);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 700;
}
.pay-mult {
  flex: 0 0 auto;
  min-width: 48px;
  text-align: right;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--c-light);
}

/* 收合 */
.collapse-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}
.fair-body {
  margin-top: 12px;
}
.fair-note {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 10px;
  line-height: 1.5;
}
.fair-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.fair-row span {
  font-size: 0.72rem;
  color: #94a3b8;
}
.fair-row code {
  font-size: 0.72rem;
  color: #cbd5e1;
  word-break: break-all;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 6px;
  border-radius: 6px;
}

/* 盟主設定提示 */
/* ===== 777 尊榮頭獎動畫 ===== */
.jp-overlay {
  position: fixed;
  inset: 0;
  z-index: 100002; /* 蓋過所有彈窗 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, rgba(20, 16, 0, 0.82), rgba(0, 0, 0, 0.92));
  overflow: hidden;
  animation: jp-fadein 0.25s ease;
}
@keyframes jp-fadein {
  from {
    opacity: 0;
  }
}
.jp-rays {
  position: absolute;
  width: 160vmax;
  height: 160vmax;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(255, 209, 102, 0.16) 0deg 8deg,
    transparent 8deg 16deg
  );
  animation: jp-spin 18s linear infinite;
  pointer-events: none;
}
@keyframes jp-spin {
  to {
    transform: rotate(360deg);
  }
}
.jp-confetti {
  position: absolute;
  top: -20px;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.9;
  animation: jp-fall 2.6s linear infinite;
  pointer-events: none;
}
@keyframes jp-fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(105vh) rotate(540deg);
    opacity: 0.8;
  }
}
.jp-card {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 30px 28px 26px;
  border-radius: 20px;
  background: linear-gradient(160deg, #2a2410, #14110a);
  border: 2px solid #ffd166;
  box-shadow:
    0 0 40px rgba(255, 209, 102, 0.55),
    0 0 90px rgba(255, 160, 0, 0.3);
  animation: jp-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes jp-pop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.jp-title {
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 1px;
  background: linear-gradient(90deg, #ffd166, #fff3c4, #ffd166);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: jp-pulse 1.1s ease-in-out infinite;
}
@keyframes jp-pulse {
  50% {
    filter: brightness(1.4);
  }
}
.jp-reels {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 14px 0 6px;
}
.jp-7 {
  font-size: 3.4rem;
  line-height: 1;
  filter: drop-shadow(0 0 12px rgba(255, 209, 102, 0.9));
  animation: jp-bounce 0.7s ease infinite alternate;
}
.jp-7:nth-child(2) {
  animation-delay: 0.12s;
}
.jp-7:nth-child(3) {
  animation-delay: 0.24s;
}
@keyframes jp-bounce {
  to {
    transform: translateY(-10px) scale(1.08);
  }
}
.jp-amount {
  margin-top: 10px;
  font-size: 2.6rem;
  font-weight: 900;
  color: #ffd166;
  text-shadow: 0 0 18px rgba(255, 209, 102, 0.7);
  font-variant-numeric: tabular-nums;
}
.jp-currency {
  font-size: 0.9rem;
  color: #e2c98a;
  margin-top: 2px;
}
.jp-pool {
  margin-top: 10px;
  font-size: 0.95rem;
  font-weight: 800;
  color: #fff3c4;
  background: rgba(255, 209, 102, 0.18);
  border: 1px solid rgba(255, 209, 102, 0.5);
  border-radius: 999px;
  padding: 5px 14px;
  display: inline-block;
}
.jp-close {
  margin-top: 20px;
  height: 46px;
  padding: 0 26px;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  color: #14110a;
  background: linear-gradient(135deg, #ffe08a, #ffb300);
  box-shadow: 0 6px 18px rgba(255, 160, 0, 0.45);
}

.leader-link {
  text-align: center;
  font-size: 0.8rem;
  color: #64748b;
  margin: 4px 0 0;
}
</style>
