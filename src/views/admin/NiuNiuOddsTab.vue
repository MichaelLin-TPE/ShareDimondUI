<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useAdminClient } from '@/composables/adminClient'

const { callApi, showToast } = useAdminClient()

type ClanSummary = { clanId: string; name: string; clanLeaderName: string }
type Odds = { tian: number; di: number; xuan: number; huang: number }

const clans = ref<ClanSummary[]>([])
const clanId = ref('')
const odds = ref<Odds>({ tian: 50, di: 50, xuan: 50, huang: 50 })
const loading = ref(false)
const saving = ref(false)

// 顯示勝率覆蓋(-1=用真實統計 / 0~100=強制顯示該值;完全不影響開牌)
type Disp = { tian: number; di: number; xuan: number; huang: number }
const disp = ref<Disp>({ tian: -1, di: -1, xuan: -1, huang: -1 })
const dispSaving = ref(false)

const POS = [
  { key: 'tian', zh: '天' },
  { key: 'di', zh: '地' },
  { key: 'xuan', zh: '玄' },
  { key: 'huang', zh: '黃' },
] as const

const bankerAvg = computed(() =>
  Math.round(100 - (odds.value.tian + odds.value.di + odds.value.xuan + odds.value.huang) / 4),
)
const biased = computed(() =>
  [odds.value.tian, odds.value.di, odds.value.xuan, odds.value.huang].some((r) => r !== 50),
)

async function loadClans() {
  try {
    clans.value = await callApi<ClanSummary[]>('GET', '/admin/clan')
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}
async function loadOdds() {
  if (!clanId.value) return
  loading.value = true
  try {
    odds.value = await callApi<Odds>('GET', `/admin/niuniu-odds?clanId=${encodeURIComponent(clanId.value)}`)
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!clanId.value) {
    showToast('error', '請先選血盟')
    return
  }
  saving.value = true
  try {
    odds.value = await callApi<Odds>(
      'POST',
      `/admin/niuniu-odds?clanId=${encodeURIComponent(clanId.value)}`,
      odds.value,
    )
    showToast('success', '已套用 ✅（下一局結算生效）')
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}
async function loadDisp() {
  if (!clanId.value) return
  try {
    disp.value = await callApi<Disp>('GET', `/admin/niuniu-display?clanId=${encodeURIComponent(clanId.value)}`)
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}
function selectClan() {
  loadOdds()
  loadDisp()
}
async function saveDisp() {
  if (!clanId.value) {
    showToast('error', '請先選血盟')
    return
  }
  dispSaving.value = true
  try {
    disp.value = await callApi<Disp>(
      'POST',
      `/admin/niuniu-display?clanId=${encodeURIComponent(clanId.value)}`,
      disp.value,
    )
    showToast('success', '顯示勝率已套用 ✅')
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    dispSaving.value = false
  }
}
function resetDispReal() {
  disp.value = { tian: -1, di: -1, xuan: -1, huang: -1 }
  saveDisp()
}
function clampAll() {
  for (const p of POS) {
    const v = Math.max(0, Math.min(100, Math.round(Number(odds.value[p.key]) || 0)))
    odds.value[p.key] = v
  }
}
function setAll(v: number) {
  odds.value = { tian: v, di: v, xuan: v, huang: v }
}
function resetFair() {
  setAll(50)
}
function bankerDominate() {
  setAll(0)
} // 閒家全 0% = 莊家必贏
function playerDominate() {
  setAll(100)
} // 閒家全 100% = 莊家必輸

// ── 自動遞增/遞減 測試工具（純前端定時打現有端點）──
const ramp = ref({ start: 50, dir: 'down' as 'up' | 'down', step: 5, intervalSec: 10, min: 0, max: 100 })
const rampRunning = ref(false)
const rampCurrent = ref(0)
const rampLog = ref<{ t: string; v: number }[]>([])
let rampTimer: ReturnType<typeof setInterval> | null = null

function nowHms() {
  const d = new Date()
  return d.toLocaleTimeString('zh-TW', { hour12: false })
}
async function applyValue(v: number) {
  disp.value = { tian: v, di: v, xuan: v, huang: v }   // 只改顯示勝率,不動開牌
  await callApi<Disp>('POST', `/admin/niuniu-display?clanId=${encodeURIComponent(clanId.value)}`, disp.value)
  rampLog.value.unshift({ t: nowHms(), v })
  if (rampLog.value.length > 60) rampLog.value.pop()
}
async function startRamp() {
  if (!clanId.value) {
    showToast('error', '請先選血盟')
    return
  }
  if (rampRunning.value) return
  const r = ramp.value
  r.step = Math.max(1, Math.round(r.step))
  r.intervalSec = Math.max(1, Math.round(r.intervalSec))
  r.min = Math.max(0, Math.min(100, Math.round(r.min)))
  r.max = Math.max(0, Math.min(100, Math.round(r.max)))
  rampCurrent.value = Math.max(r.min, Math.min(r.max, Math.round(r.start)))
  rampLog.value = []
  rampRunning.value = true
  try {
    await applyValue(rampCurrent.value)
  } catch (e) {
    rampRunning.value = false
    showToast('error', (e as Error).message)
    return
  }
  rampTimer = setInterval(rampTick, r.intervalSec * 1000)
  showToast('success', `開始掃描：${rampCurrent.value}% 起，每 ${r.intervalSec}s ${r.dir === 'up' ? '＋' : '－'}${r.step}%`)
}
async function rampTick() {
  const r = ramp.value
  const next = rampCurrent.value + (r.dir === 'up' ? r.step : -r.step)
  if (next < r.min || next > r.max) {
    stopRamp()
    showToast('info', `掃描完成（已到${r.dir === 'up' ? '上限' : '下限'} ${r.dir === 'up' ? r.max : r.min}%）`)
    return
  }
  rampCurrent.value = next
  try {
    await applyValue(next)
  } catch (e) {
    stopRamp()
    showToast('error', '套用失敗，已停止：' + (e as Error).message)
  }
}
function stopRamp() {
  rampRunning.value = false
  if (rampTimer) {
    clearInterval(rampTimer)
    rampTimer = null
  }
}
onUnmounted(stopRamp)

onMounted(loadClans)
defineExpose({ refresh: loadClans })
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>🎮 百人牛牛開牌機率（測試用）</h2>
          <p>調各位置「閒家贏率 %」。50% = 公平（不動發牌）；非 50% 時結算會重洗到吻合，牌面與結果一定一致。</p>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field-wrap span-2">
            <span class="label">選血盟</span>
            <select v-model="clanId" class="field" @change="selectClan">
              <option value="">— 請選擇血盟 —</option>
              <option v-for="c in clans" :key="c.clanId" :value="c.clanId">
                {{ c.name }}（{{ c.clanLeaderName || '?' }}）
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div v-if="clanId" class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>閒家贏率（開牌控制 · 真的洗牌）</h2>
          <p>
            目前莊家平均贏率約 <strong>{{ bankerAvg }}%</strong>
            <span v-if="!biased">· ⚖️ 目前公平（皆 50%）</span>
            <span v-else style="color: #f59e0b">· ⚠️ 目前有偏差（非公平）</span>
          </p>
        </div>
        <button class="btn btn-ghost" :disabled="loading" @click="loadOdds">🔄 重新載入</button>
      </div>
      <div class="card-body">
        <div v-if="loading" class="state state-loading">載入中…</div>
        <template v-else>
          <div v-for="p in POS" :key="p.key" class="odds-row">
            <span class="odds-zh">{{ p.zh }}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              v-model.number="odds[p.key]"
              class="odds-range"
            />
            <input
              type="number"
              min="0"
              max="100"
              v-model.number="odds[p.key]"
              class="field odds-num"
              @blur="clampAll"
            />
            <span class="odds-pct">閒 {{ odds[p.key] }}% / 莊 {{ 100 - odds[p.key] }}%</span>
          </div>

          <div class="divider"></div>

          <div class="preset-grid">
            <button class="preset-card" @click="resetFair">
              <span class="preset-label">⚖️ 公平</span><span class="preset-sub">全部 50%</span>
            </button>
            <button class="preset-card" @click="bankerDominate">
              <span class="preset-label">👑 莊家必贏</span><span class="preset-sub">閒家 0%</span>
            </button>
            <button class="preset-card" @click="playerDominate">
              <span class="preset-label">🧑 閒家必贏</span><span class="preset-sub">閒家 100%</span>
            </button>
          </div>

          <div class="card-actions">
            <button class="btn btn-primary btn-block btn-lg" :disabled="saving" @click="save">
              💾 套用（下一局結算生效）
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 🖥️ 顯示勝率覆蓋（只改給玩家看的數字，不影響開牌） -->
    <div v-if="clanId" class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>🖥️ 顯示勝率覆蓋</h2>
          <p>
            直接改「給玩家看的近2日勝率 %」，<strong>完全不影響上面的開牌控制</strong>。
            <br />每格填 <strong>-1 = 用真實統計</strong>；填 <strong>0~100 = 強制顯示該數字</strong>。
          </p>
        </div>
        <button class="btn btn-ghost" @click="loadDisp">🔄 重新載入</button>
      </div>
      <div class="card-body">
        <div v-for="p in POS" :key="p.key" class="odds-row">
          <span class="odds-zh">{{ p.zh }}</span>
          <input
            type="number"
            min="-1"
            max="100"
            v-model.number="disp[p.key]"
            class="field odds-num"
          />
          <span class="odds-pct">
            {{ disp[p.key] < 0 ? '用真實統計' : `顯示 閒 ${disp[p.key]}%` }}
          </span>
        </div>
        <div class="card-actions" style="display: flex; gap: 10px">
          <button class="btn btn-ghost" :disabled="dispSaving" @click="resetDispReal">↩️ 全部還原真實(-1)</button>
          <button class="btn btn-primary" style="flex: 1" :disabled="dispSaving" @click="saveDisp">
            💾 套用顯示勝率
          </button>
        </div>
      </div>
    </div>

    <!-- 🧪 自動遞增/遞減 測試工具（作用在「顯示勝率」） -->
    <div v-if="clanId" class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>🧪 顯示勝率 自動遞增／遞減</h2>
          <p>從「起始機率」開始，每隔 N 秒把四位置<strong>顯示勝率</strong>一起 ＋／－ 一步，直到上/下限。只改顯示、不影響開牌。</p>
        </div>
      </div>
      <div class="card-body">
        <div class="ramp-grid">
          <label class="rf"><span>起始機率 %</span>
            <input type="number" min="0" max="100" v-model.number="ramp.start" class="field" :disabled="rampRunning" />
          </label>
          <label class="rf"><span>方向</span>
            <select v-model="ramp.dir" class="field" :disabled="rampRunning">
              <option value="down">遞減 －</option>
              <option value="up">遞增 ＋</option>
            </select>
          </label>
          <label class="rf"><span>每步 %</span>
            <input type="number" min="1" max="100" v-model.number="ramp.step" class="field" :disabled="rampRunning" />
          </label>
          <label class="rf"><span>間隔（秒）</span>
            <input type="number" min="1" max="3600" v-model.number="ramp.intervalSec" class="field" :disabled="rampRunning" />
          </label>
          <label class="rf"><span>下限 %</span>
            <input type="number" min="0" max="100" v-model.number="ramp.min" class="field" :disabled="rampRunning" />
          </label>
          <label class="rf"><span>上限 %</span>
            <input type="number" min="0" max="100" v-model.number="ramp.max" class="field" :disabled="rampRunning" />
          </label>
        </div>

        <div class="ramp-status">
          <span v-if="rampRunning" class="ramp-live">
            ▶ 掃描中 · 目前 <strong>{{ rampCurrent }}%</strong>（閒 {{ rampCurrent }}% / 莊 {{ 100 - rampCurrent }}%）
          </span>
          <span v-else class="ramp-idle">■ 未啟動</span>
        </div>

        <div class="card-actions ramp-actions">
          <button v-if="!rampRunning" class="btn btn-primary btn-lg" @click="startRamp">▶ 開始掃描</button>
          <button v-else class="btn btn-danger btn-lg" @click="stopRamp">■ 停止</button>
        </div>

        <div v-if="rampLog.length" class="ramp-log">
          <div class="ramp-log-head">套用紀錄（新→舊）</div>
          <div v-for="(l, i) in rampLog" :key="i" class="ramp-log-row">
            <span class="ramp-log-t">{{ l.t }}</span>
            <span class="ramp-log-v">閒 {{ l.v }}% / 莊 {{ 100 - l.v }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.odds-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.odds-zh {
  flex: 0 0 28px;
  font-size: 1.2rem;
  font-weight: 900;
  color: var(--c-light, #d8b4fe);
  text-align: center;
}
.odds-range {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: var(--c-light, #a855f7);
  cursor: pointer;
}
.odds-num {
  flex: 0 0 72px;
  text-align: center;
}
.odds-pct {
  flex: 0 0 130px;
  font-size: 0.82rem;
  color: #94a3b8;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 560px) {
  .odds-row {
    flex-wrap: wrap;
  }
  .odds-pct {
    flex: 1 1 100%;
    text-align: left;
  }
}

.ramp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.rf {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rf span {
  font-size: 0.8rem;
  color: #94a3b8;
}
.ramp-status {
  margin: 14px 0 4px;
  font-size: 0.95rem;
}
.ramp-live {
  color: #4ade80;
  font-weight: 700;
}
.ramp-idle {
  color: #64748b;
}
.ramp-actions {
  margin-top: 6px;
}
.btn-danger {
  background: linear-gradient(135deg, #dc2626, #991b1b);
  color: #fff;
}
.ramp-log {
  margin-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
  max-height: 220px;
  overflow-y: auto;
}
.ramp-log-head {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 6px;
}
.ramp-log-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.84rem;
  padding: 3px 0;
  font-variant-numeric: tabular-nums;
}
.ramp-log-t {
  color: #64748b;
}
.ramp-log-v {
  color: #cbd5e1;
}
@media (max-width: 560px) {
  .ramp-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
