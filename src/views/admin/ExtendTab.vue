<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAdminClient, fmtMoney, fmtDateMs } from '@/composables/adminClient'

const { callApi, showToast, copy } = useAdminClient()

// ===== 延期表單 =====
type ExtendForm = {
  clanId: string
  days: number
  amount: number
  plan: 'MONTHLY' | 'YEARLY' | 'LARGE_MONTHLY' | 'LARGE_YEARLY' | 'TRIAL_EXTENSION' | 'CUSTOM'
  note: string
}
const extendForm = ref<ExtendForm>({
  clanId: '',
  days: 30,
  amount: 2000,
  plan: 'MONTHLY',
  note: '',
})
const extendResult = ref<{
  clanId: string
  expiresAtMs: number
  paymentId: number
  commissionId: number | null
  commissionAmount: number | null
} | null>(null)

const planPresets = [
  { plan: 'MONTHLY', label: '月繳', sub: '30 天 / NT$2,000', days: 30, amount: 2000 },
  { plan: 'YEARLY', label: '年繳', sub: '365 天 / NT$20,000', days: 365, amount: 20000 },
  { plan: 'LARGE_MONTHLY', label: '100 人月', sub: '30 天 / NT$3,500', days: 30, amount: 3500 },
  { plan: 'LARGE_YEARLY', label: '100 人年', sub: '365 天 / NT$35,000', days: 365, amount: 35000 },
  { plan: 'TRIAL_EXTENSION', label: '試用延長', sub: '7 天 / 免費', days: 7, amount: 0 },
  { plan: 'CUSTOM', label: '自訂', sub: '手動填', days: 0, amount: 0 },
] as const

function applyPlanPreset(plan: ExtendForm['plan']) {
  const p = planPresets.find((x) => x.plan === plan)
  if (!p) return
  extendForm.value.plan = p.plan
  if (p.days) extendForm.value.days = p.days
  if (p.plan !== 'CUSTOM') extendForm.value.amount = p.amount
}

async function submitExtend() {
  if (!extendForm.value.clanId.trim()) {
    showToast('error', 'clanId 必填')
    return
  }
  if (extendForm.value.days <= 0) {
    showToast('error', '延長天數必須 > 0')
    return
  }
  try {
    const res = await callApi<typeof extendResult.value>(
      'POST',
      `/admin/clan/${encodeURIComponent(extendForm.value.clanId.trim())}/extend`,
      {
        days: extendForm.value.days,
        amount: extendForm.value.amount,
        plan: extendForm.value.plan,
        note: extendForm.value.note,
      },
    )
    extendResult.value = res
    showToast('success', '延期成功!')
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

// ===== 血盟列表 =====
type ClanSummary = {
  clanId: string
  name: string
  clanLeaderName: string
  referralCode: string | null
  enableClan: boolean
  expiresAtMs: number | null
}
const clans = ref<ClanSummary[]>([])
const clansLoading = ref(false)
const clanSearch = ref<string>('')
const filteredClans = computed<ClanSummary[]>(() => {
  const q = clanSearch.value.trim().toLowerCase()
  if (!q) return clans.value
  return clans.value.filter(
    (c) =>
      c.clanId.toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.clanLeaderName || '').toLowerCase().includes(q) ||
      (c.referralCode || '').toLowerCase().includes(q),
  )
})

async function loadClans() {
  clansLoading.value = true
  try {
    clans.value = await callApi<ClanSummary[]>('GET', '/admin/clan')
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    clansLoading.value = false
  }
}

function pickClan(c: ClanSummary) {
  extendForm.value.clanId = c.clanId
  showToast('info', `已填入: ${c.name}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function daysFromNow(ms: number | null) {
  if (!ms) return null
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000))
}

onMounted(loadClans)
defineExpose({ refresh: loadClans })
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>📥 收到匯款後填這裡</h2>
          <p>會自動延長血盟有效期 + 紀錄付款 + 建立抽成 (如有推廣碼)</p>
        </div>
      </div>
      <div class="card-body">
        <div class="preset-section">
          <div class="label" style="margin-bottom: 10px">快速套用方案</div>
          <div class="preset-grid">
            <button
              v-for="p in planPresets"
              :key="p.plan"
              class="preset-card"
              :class="{ active: extendForm.plan === p.plan }"
              @click="applyPlanPreset(p.plan)"
            >
              <span class="preset-label">{{ p.label }}</span>
              <span class="preset-sub">{{ p.sub }}</span>
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="form-grid">
          <label class="field-wrap span-2">
            <span class="label">血盟 ID *</span>
            <input v-model="extendForm.clanId" class="field" placeholder="從血盟設定頁複製" />
          </label>
          <label class="field-wrap">
            <span class="label">延長天數 *</span>
            <input v-model.number="extendForm.days" type="number" min="1" class="field" />
          </label>
          <label class="field-wrap">
            <span class="label">收款金額 (NT$)</span>
            <input v-model.number="extendForm.amount" type="number" min="0" class="field" />
          </label>
          <label class="field-wrap span-2">
            <span class="label">備註 (匯款帳號末五碼等)</span>
            <input v-model="extendForm.note" class="field" placeholder="例: 玉山末五 12345" />
          </label>
        </div>

        <div class="card-actions">
          <button class="btn btn-primary btn-block btn-lg" @click="submitExtend">
            🚀 送出延期 + 紀錄收款
          </button>
        </div>
      </div>
    </div>

    <!-- 血盟列表 -->
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>📚 所有血盟</h2>
          <p>共 {{ clans.length }} 個血盟,點「使用」會自動填入上方 ID 欄位</p>
        </div>
        <button class="btn btn-ghost" @click="loadClans">🔄 重新整理</button>
      </div>
      <div class="card-body">
        <input
          v-model="clanSearch"
          class="field"
          placeholder="🔍 搜尋血盟名稱 / ID / 盟主 / 推廣碼"
          style="margin-bottom: 14px"
        />
      </div>
      <div class="card-body p-0">
        <div v-if="clansLoading" class="state state-loading">載入中...</div>
        <div v-else-if="!filteredClans.length" class="state state-empty">
          <div class="state-emoji">📭</div>
          <div>{{ clans.length ? '沒有符合的血盟' : '還沒有任何血盟' }}</div>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>血盟名稱</th>
                <th>盟主</th>
                <th>血盟 ID</th>
                <th>推廣碼</th>
                <th>到期</th>
                <th>剩餘</th>
                <th>狀態</th>
                <th class="th-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredClans" :key="c.clanId">
                <td><strong>{{ c.name }}</strong></td>
                <td class="muted">{{ c.clanLeaderName || '-' }}</td>
                <td>
                  <code class="code-tag" @click="copy(c.clanId)" title="點擊複製">{{ c.clanId }}</code>
                </td>
                <td>
                  <code v-if="c.referralCode" class="code-tag">{{ c.referralCode }}</code>
                  <span v-else class="muted">-</span>
                </td>
                <td class="muted small">{{ fmtDateMs(c.expiresAtMs) }}</td>
                <td>
                  <span
                    :class="[
                      'pill',
                      (daysFromNow(c.expiresAtMs) ?? 0) <= 0
                        ? 'pill-cancelled'
                        : (daysFromNow(c.expiresAtMs) ?? 0) <= 3
                          ? 'pill-pending'
                          : 'pill-settled',
                    ]"
                  >
                    {{ daysFromNow(c.expiresAtMs) === null ? '-' : daysFromNow(c.expiresAtMs) + ' 天' }}
                  </span>
                </td>
                <td>
                  <span :class="['pill', c.enableClan ? 'pill-on' : 'pill-off']">
                    {{ c.enableClan ? '啟用' : '停用' }}
                  </span>
                </td>
                <td class="td-actions">
                  <button class="btn btn-row btn-primary" @click="pickClan(c)">使用</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="extendResult" class="card card-success">
      <div class="card-head">
        <div class="card-head-text">
          <h2>✅ 處理完成</h2>
          <p>血盟已成功延長</p>
        </div>
      </div>
      <div class="card-body">
        <div class="result-grid">
          <div class="result-item">
            <span class="result-label">血盟 ID</span>
            <strong>{{ extendResult.clanId }}</strong>
          </div>
          <div class="result-item">
            <span class="result-label">新到期時間</span>
            <strong>{{ fmtDateMs(extendResult.expiresAtMs) }}</strong>
          </div>
          <div class="result-item">
            <span class="result-label">付款記錄 ID</span>
            <strong>#{{ extendResult.paymentId }}</strong>
          </div>
          <div v-if="extendResult.commissionId" class="result-item result-item-money">
            <span class="result-label">抽成記錄 #{{ extendResult.commissionId }}</span>
            <strong class="money-big">{{ fmtMoney(extendResult.commissionAmount) }}</strong>
          </div>
          <div v-else class="result-item result-item-muted">
            <span class="result-label">抽成</span>
            <strong>此血盟未綁推廣碼</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
