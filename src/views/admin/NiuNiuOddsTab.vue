<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAdminClient } from '@/composables/adminClient'

const { callApi, showToast } = useAdminClient()

type ClanSummary = { clanId: string; name: string; clanLeaderName: string }
type Odds = { tian: number; di: number; xuan: number; huang: number }

const clans = ref<ClanSummary[]>([])
const clanId = ref('')
const odds = ref<Odds>({ tian: 50, di: 50, xuan: 50, huang: 50 })
const loading = ref(false)
const saving = ref(false)

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
            <select v-model="clanId" class="field" @change="loadOdds">
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
          <h2>閒家贏率</h2>
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
</style>
