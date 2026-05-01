<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const API_BASE = 'https://api.gameshare-system.com'
const TOKEN_KEY = 'admin_token_v1'

// ===== Token gate =====
const adminToken = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
const tokenInput = ref<string>('')
const authed = computed(() => !!adminToken.value)

function saveToken() {
  if (!tokenInput.value.trim()) return
  adminToken.value = tokenInput.value.trim()
  localStorage.setItem(TOKEN_KEY, adminToken.value)
  tokenInput.value = ''
  refreshAll()
}
function clearToken() {
  adminToken.value = ''
  localStorage.removeItem(TOKEN_KEY)
}

// ===== Fetch helper =====
async function callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken.value,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Admin token 無效或已失效,請重新輸入')
  }
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return text ? JSON.parse(text) : ({} as T)
}

// ===== Tabs =====
const activeTab = ref<'codes' | 'extend' | 'payments' | 'commissions'>('codes')
const tabs = [
  { key: 'codes', label: '推廣碼', emoji: '🎟️' },
  { key: 'extend', label: '血盟延期', emoji: '⏰' },
  { key: 'payments', label: '付款記錄', emoji: '💵' },
  { key: 'commissions', label: '抽成結算', emoji: '💰' },
] as const

// ===== Toast =====
type Toast = { id: number; type: 'success' | 'error' | 'info'; msg: string }
const toasts = ref<Toast[]>([])
let toastSeq = 0
function showToast(type: Toast['type'], msg: string) {
  const id = ++toastSeq
  toasts.value.push({ id, type, msg })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 4000)
}

// ===== 推廣碼 =====
type ReferralCode = {
  id: number
  code: string
  ownerName: string
  ownerContact: string
  commissionRate: number
  enabled: boolean
  createdAt: string
}
const codes = ref<ReferralCode[]>([])
const codeForm = ref({ code: '', ownerName: '', ownerContact: '', commissionRate: 20 })
const codesLoading = ref(false)

async function loadCodes() {
  codesLoading.value = true
  try {
    codes.value = await callApi<ReferralCode[]>('GET', '/admin/referral-code')
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    codesLoading.value = false
  }
}
async function createCode() {
  if (!codeForm.value.code.trim() || !codeForm.value.ownerName.trim()) {
    showToast('error', '推廣碼 + 推廣人姓名必填')
    return
  }
  try {
    await callApi('POST', '/admin/referral-code', {
      code: codeForm.value.code.trim(),
      ownerName: codeForm.value.ownerName.trim(),
      ownerContact: codeForm.value.ownerContact.trim(),
      commissionRate: codeForm.value.commissionRate,
    })
    showToast('success', `推廣碼「${codeForm.value.code}」建立成功`)
    codeForm.value = { code: '', ownerName: '', ownerContact: '', commissionRate: 20 }
    await loadCodes()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}
async function toggleCode(c: ReferralCode) {
  try {
    const action = c.enabled ? 'disable' : 'enable'
    await callApi('PUT', `/admin/referral-code/${encodeURIComponent(c.code)}/${action}`)
    showToast('success', `${c.code} 已${c.enabled ? '停用' : '啟用'}`)
    await loadCodes()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

// ===== 延期 =====
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

// ===== 付款記錄 =====
type PaymentRecord = {
  id: number
  clanId: string
  amount: number
  plan: string
  extendDays: number
  referralCodeSnapshot: string | null
  note: string | null
  receivedAt: string
}
const payments = ref<PaymentRecord[]>([])
const paymentFilter = ref({ clanId: '', referralCode: '' })
const paymentsLoading = ref(false)
async function loadPayments() {
  paymentsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (paymentFilter.value.clanId.trim()) params.set('clanId', paymentFilter.value.clanId.trim())
    if (paymentFilter.value.referralCode.trim())
      params.set('referralCode', paymentFilter.value.referralCode.trim())
    const qs = params.toString()
    payments.value = await callApi<PaymentRecord[]>(
      'GET',
      `/admin/payment${qs ? '?' + qs : ''}`,
    )
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    paymentsLoading.value = false
  }
}

// ===== 抽成結算 =====
type CommissionRecord = {
  id: number
  paymentId: number
  clanId: string
  referralCode: string
  ownerName: string
  baseAmount: number
  commissionRate: number
  commissionAmount: number
  status: 'PENDING' | 'SETTLED' | 'CANCELLED'
  settledAt: string | null
  settleNote: string | null
  createdAt: string
}
const commissions = ref<CommissionRecord[]>([])
const commissionTotal = ref<number>(0)
const commissionFilter = ref<{ status: '' | 'PENDING' | 'SETTLED' | 'CANCELLED'; referralCode: string }>({
  status: 'PENDING',
  referralCode: '',
})
const commissionsLoading = ref(false)
async function loadCommissions() {
  commissionsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (commissionFilter.value.status) params.set('status', commissionFilter.value.status)
    if (commissionFilter.value.referralCode.trim())
      params.set('referralCode', commissionFilter.value.referralCode.trim())
    const qs = params.toString()
    const res = await callApi<{ count: number; totalCommission: number; records: CommissionRecord[] }>(
      'GET',
      `/admin/commission${qs ? '?' + qs : ''}`,
    )
    commissions.value = res.records
    commissionTotal.value = res.totalCommission
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    commissionsLoading.value = false
  }
}
async function settleCommission(c: CommissionRecord) {
  const note = prompt(`結算 ${c.referralCode} 的 NT$${c.commissionAmount}\n請輸入撥款備註 (可空):`)
  if (note === null) return
  try {
    await callApi('POST', `/admin/commission/${c.id}/settle`, { settleNote: note })
    showToast('success', '已標記為結算')
    await loadCommissions()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}
async function cancelCommission(c: CommissionRecord) {
  if (!confirm(`確定取消這筆 NT$${c.commissionAmount} 的抽成?\n(只能取消 PENDING 狀態)`)) return
  const note = prompt('取消原因 (可空):')
  if (note === null) return
  try {
    await callApi('POST', `/admin/commission/${c.id}/cancel`, { settleNote: note })
    showToast('success', '已取消')
    await loadCommissions()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

// ===== Helpers =====
function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return '-'
  return 'NT$ ' + Math.round(n).toLocaleString()
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  return s.replace('T', ' ').slice(0, 19)
}
function fmtDateMs(ms: number | null | undefined) {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('zh-TW', { hour12: false })
}
function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => showToast('info', '已複製: ' + text))
}

function refreshAll() {
  if (!authed.value) return
  loadCodes()
  loadPayments()
  loadCommissions()
}

onMounted(() => {
  if (authed.value) refreshAll()
})
</script>

<template>
  <div class="admin-root">
    <!-- ===== Token gate ===== -->
    <div v-if="!authed" class="gate">
      <div class="gate-card">
        <div class="gate-emoji">🔐</div>
        <h1>Admin 登入</h1>
        <p class="gate-sub">請輸入管理員 Token</p>
        <input
          v-model="tokenInput"
          type="password"
          placeholder="X-Admin-Token"
          class="field"
          @keyup.enter="saveToken"
        />
        <button class="btn btn-primary btn-block" @click="saveToken">進入</button>
        <p class="gate-hint">Token 會儲存在本機,下次自動登入</p>
      </div>
    </div>

    <!-- ===== Main ===== -->
    <div v-else class="main">
      <!-- Header -->
      <header class="topbar">
        <div class="brand">
          <span class="brand-emoji">⚙️</span>
          <span class="brand-text">Diamond Core Admin</span>
        </div>
        <div class="topbar-right">
          <button class="btn btn-ghost" @click="refreshAll">🔄 全部重新整理</button>
          <button class="btn btn-danger-ghost" @click="clearToken">登出</button>
        </div>
      </header>

      <!-- Tabs -->
      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >
          <span class="tab-emoji">{{ t.emoji }}</span>
          <span class="tab-label">{{ t.label }}</span>
        </button>
      </nav>

      <!-- ===== Tab: 推廣碼 ===== -->
      <section v-if="activeTab === 'codes'" class="panel">
        <!-- 新增 -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>➕ 新增推廣碼</h2>
              <p>建立新推廣者的推廣碼,推廣者把碼給盟主,盟主建立血盟時填入</p>
            </div>
          </div>
          <div class="card-body">
            <div class="form-grid">
              <label class="field-wrap">
                <span class="label">推廣碼 *</span>
                <input v-model="codeForm.code" class="field" placeholder="例: PROMO001" />
              </label>
              <label class="field-wrap">
                <span class="label">推廣人姓名 *</span>
                <input v-model="codeForm.ownerName" class="field" placeholder="例: 王小明" />
              </label>
              <label class="field-wrap">
                <span class="label">聯絡方式</span>
                <input v-model="codeForm.ownerContact" class="field" placeholder="LINE / 電話 / Email" />
              </label>
              <label class="field-wrap">
                <span class="label">抽成 % *</span>
                <input
                  v-model.number="codeForm.commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="field"
                />
              </label>
            </div>
            <div class="card-actions">
              <button class="btn btn-primary btn-lg" @click="createCode">建立推廣碼</button>
            </div>
          </div>
        </div>

        <!-- 列表 -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>📋 所有推廣碼</h2>
              <p>共 {{ codes.length }} 筆</p>
            </div>
            <button class="btn btn-ghost" @click="loadCodes">🔄 重新整理</button>
          </div>
          <div class="card-body p-0">
            <div v-if="codesLoading" class="state state-loading">載入中...</div>
            <div v-else-if="!codes.length" class="state state-empty">
              <div class="state-emoji">📭</div>
              <div>還沒有任何推廣碼</div>
            </div>
            <div v-else class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>推廣碼</th>
                    <th>推廣人</th>
                    <th>聯絡</th>
                    <th>抽成</th>
                    <th>狀態</th>
                    <th>建立時間</th>
                    <th class="th-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in codes" :key="c.id">
                    <td>
                      <code class="code-tag" @click="copy(c.code)">{{ c.code }}</code>
                    </td>
                    <td><strong>{{ c.ownerName }}</strong></td>
                    <td class="muted">{{ c.ownerContact || '-' }}</td>
                    <td><strong class="rate">{{ c.commissionRate }}%</strong></td>
                    <td>
                      <span :class="['pill', c.enabled ? 'pill-on' : 'pill-off']">
                        {{ c.enabled ? '啟用中' : '已停用' }}
                      </span>
                    </td>
                    <td class="muted small">{{ fmtDate(c.createdAt) }}</td>
                    <td class="td-actions">
                      <button
                        class="btn btn-row"
                        :class="c.enabled ? 'btn-danger-ghost' : 'btn-primary'"
                        @click="toggleCode(c)"
                      >
                        {{ c.enabled ? '停用' : '啟用' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Tab: 延期 ===== -->
      <section v-if="activeTab === 'extend'" class="panel">
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>📥 收到匯款後填這裡</h2>
              <p>會自動延長血盟有效期 + 紀錄付款 + 建立抽成 (如有推廣碼)</p>
            </div>
          </div>
          <div class="card-body">
            <!-- preset -->
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

            <!-- form -->
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
      </section>

      <!-- ===== Tab: 付款記錄 ===== -->
      <section v-if="activeTab === 'payments'" class="panel">
        <!-- filter -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>🔍 查詢付款記錄</h2>
            </div>
          </div>
          <div class="card-body">
            <div class="filter-grid">
              <label class="field-wrap">
                <span class="label">血盟 ID</span>
                <input v-model="paymentFilter.clanId" class="field" placeholder="留空查全部" />
              </label>
              <label class="field-wrap">
                <span class="label">推廣碼</span>
                <input v-model="paymentFilter.referralCode" class="field" placeholder="留空查全部" />
              </label>
              <div class="filter-action">
                <button class="btn btn-primary btn-block" @click="loadPayments">查詢</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 列表 -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>📋 付款記錄</h2>
              <p>共 {{ payments.length }} 筆</p>
            </div>
          </div>
          <div class="card-body p-0">
            <div v-if="paymentsLoading" class="state state-loading">載入中...</div>
            <div v-else-if="!payments.length" class="state state-empty">
              <div class="state-emoji">📭</div>
              <div>沒有資料</div>
            </div>
            <div v-else class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>血盟 ID</th>
                    <th>方案</th>
                    <th>金額</th>
                    <th>延長</th>
                    <th>推廣碼</th>
                    <th>備註</th>
                    <th>時間</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in payments" :key="p.id">
                    <td><strong>#{{ p.id }}</strong></td>
                    <td><code class="code-tag" @click="copy(p.clanId)">{{ p.clanId }}</code></td>
                    <td><span class="pill pill-info">{{ p.plan }}</span></td>
                    <td class="money">{{ fmtMoney(p.amount) }}</td>
                    <td class="muted">{{ p.extendDays }} 天</td>
                    <td>
                      <code v-if="p.referralCodeSnapshot" class="code-tag">{{ p.referralCodeSnapshot }}</code>
                      <span v-else class="muted">-</span>
                    </td>
                    <td class="muted small">{{ p.note || '-' }}</td>
                    <td class="muted small">{{ fmtDate(p.receivedAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Tab: 抽成 ===== -->
      <section v-if="activeTab === 'commissions'" class="panel">
        <!-- filter -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>🔍 查詢抽成記錄</h2>
            </div>
          </div>
          <div class="card-body">
            <div class="filter-grid">
              <label class="field-wrap">
                <span class="label">狀態</span>
                <select v-model="commissionFilter.status" class="field">
                  <option value="">全部狀態</option>
                  <option value="PENDING">待結算 PENDING</option>
                  <option value="SETTLED">已結算 SETTLED</option>
                  <option value="CANCELLED">已取消 CANCELLED</option>
                </select>
              </label>
              <label class="field-wrap">
                <span class="label">推廣碼</span>
                <input v-model="commissionFilter.referralCode" class="field" placeholder="留空查全部" />
              </label>
              <div class="filter-action">
                <button class="btn btn-primary btn-block" @click="loadCommissions">查詢</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 統計 -->
        <div class="card card-stat">
          <div class="card-body">
            <div class="stat-row">
              <div class="stat-item">
                <div class="stat-label">筆數</div>
                <div class="stat-value">{{ commissions.length }}</div>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <div class="stat-label">總金額</div>
                <div class="stat-value stat-value-money">{{ fmtMoney(commissionTotal) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 列表 -->
        <div class="card">
          <div class="card-head">
            <div class="card-head-text">
              <h2>📋 抽成清單</h2>
            </div>
          </div>
          <div class="card-body p-0">
            <div v-if="commissionsLoading" class="state state-loading">載入中...</div>
            <div v-else-if="!commissions.length" class="state state-empty">
              <div class="state-emoji">📭</div>
              <div>沒有資料</div>
            </div>
            <div v-else class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>推廣碼 / 推廣人</th>
                    <th>血盟 ID</th>
                    <th>基準金額</th>
                    <th>抽成%</th>
                    <th>抽成金額</th>
                    <th>狀態</th>
                    <th>建立時間</th>
                    <th>結算時間</th>
                    <th class="th-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in commissions" :key="c.id">
                    <td><strong>#{{ c.id }}</strong></td>
                    <td>
                      <code class="code-tag">{{ c.referralCode }}</code>
                      <div class="muted-sm">{{ c.ownerName }}</div>
                    </td>
                    <td><code class="code-tag" @click="copy(c.clanId)">{{ c.clanId }}</code></td>
                    <td>{{ fmtMoney(c.baseAmount) }}</td>
                    <td>{{ c.commissionRate }}%</td>
                    <td class="money">{{ fmtMoney(c.commissionAmount) }}</td>
                    <td>
                      <span :class="['pill', `pill-${c.status.toLowerCase()}`]">{{ c.status }}</span>
                    </td>
                    <td class="muted small">{{ fmtDate(c.createdAt) }}</td>
                    <td class="muted small">{{ fmtDate(c.settledAt) }}</td>
                    <td class="td-actions">
                      <div v-if="c.status === 'PENDING'" class="row-actions">
                        <button class="btn btn-row btn-primary" @click="settleCommission(c)">結算</button>
                        <button class="btn btn-row btn-danger-ghost" @click="cancelCommission(c)">取消</button>
                      </div>
                      <span v-else class="muted-sm">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Toasts -->
      <div class="toast-stack">
        <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]">
          {{ t.msg }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.admin-root {
  min-height: 100vh;
  background: #0a0b10;
  color: #e2e8f0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

/* ===== Token gate ===== */
.gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at top, rgba(245, 196, 81, 0.12), transparent 60%),
    #0a0b10;
}
.gate-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.gate-emoji {
  font-size: 3rem;
  margin-bottom: 12px;
}
.gate-card h1 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  color: #f1f5f9;
  font-weight: 800;
}
.gate-sub {
  color: #94a3b8;
  margin: 0 0 24px;
  font-size: 0.9rem;
}
.gate-card .field {
  margin-bottom: 14px;
  font-family: monospace;
}
.gate-hint {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 0.78rem;
}

/* ===== Main layout ===== */
.main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 28px 80px;
}

/* ===== Topbar ===== */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 1.2rem;
  font-weight: 800;
  color: #ffd166;
}
.brand-emoji {
  font-size: 1.6rem;
}
.topbar-right {
  display: inline-flex;
  gap: 10px;
  height: 40px;
}

/* ===== Tabs ===== */
.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 28px;
  height: 56px;
}
@media (max-width: 540px) {
  .tabs {
    grid-template-columns: repeat(2, 1fr);
    height: auto;
    grid-auto-rows: 56px;
  }
}
.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  height: 56px;
  width: 100%;
  min-width: 0;
  background: rgba(22, 24, 34, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
  white-space: nowrap;
}
.tab:hover {
  border-color: rgba(245, 196, 81, 0.35);
  transform: translateY(-1px);
}
.tab.active {
  border-color: #ffd166;
  background: linear-gradient(180deg, rgba(245, 196, 81, 0.14), rgba(22, 24, 34, 0.7));
  color: #ffd166;
  box-shadow: 0 6px 18px rgba(245, 196, 81, 0.15);
}
.tab-emoji {
  font-size: 1.25rem;
  flex-shrink: 0;
  line-height: 1;
}
.tab-label {
  font-weight: 800;
  font-size: 0.95rem;
}

/* ===== Panel ===== */
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ===== Card ===== */
.card {
  background: rgba(22, 24, 34, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 64px;
}
.card-head-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.card-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #f1f5f9;
}
.card-head p {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}
.card-body {
  padding: 22px;
}
.card-body.p-0 {
  padding: 0;
}
.card-success {
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.06), rgba(22, 24, 34, 0.55));
}
.card-success .card-head h2 {
  color: #4ade80;
}
.card-stat {
  background: linear-gradient(135deg, rgba(245, 196, 81, 0.08), rgba(22, 24, 34, 0.55));
  border-color: rgba(245, 196, 81, 0.25);
}

/* ===== Form ===== */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
.field-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field-wrap.span-2 {
  grid-column: span 2;
}
@media (max-width: 600px) {
  .field-wrap.span-2 {
    grid-column: span 1;
  }
}
.label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.field {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #f1f5f9;
  font-family: inherit;
  font-size: 0.92rem;
  transition: border-color 0.15s;
}
.field:focus {
  outline: none;
  border-color: #ffd166;
}
.field::placeholder {
  color: #475569;
}
select.field {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.card-actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* ===== Filter row ===== */
.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 140px;
  gap: 14px;
  align-items: end;
}
@media (max-width: 600px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
.filter-action {
  display: flex;
  align-items: stretch;
}
.filter-action .btn {
  height: 42px;
}

/* ===== Preset ===== */
.preset-section {
  margin-bottom: 4px;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 600px) {
  .preset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.preset-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 16px;
  height: 56px;
  width: 100%;
  min-width: 0;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  color: #cbd5e1;
  white-space: nowrap;
}
.preset-card:hover {
  border-color: rgba(245, 196, 81, 0.4);
  transform: translateY(-1px);
}
.preset-card.active {
  background: linear-gradient(135deg, rgba(245, 196, 81, 0.18), rgba(245, 158, 11, 0.08));
  border-color: #ffd166;
  color: #ffd166;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.18);
}
.preset-label {
  font-weight: 800;
  font-size: 0.95rem;
}
.preset-sub {
  font-size: 0.78rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.preset-card.active .preset-sub {
  color: rgba(255, 209, 102, 0.75);
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 22px 0;
}

/* ===== Result grid ===== */
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 600px) {
  .result-grid {
    grid-template-columns: 1fr;
  }
}
.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}
.result-item.result-item-money {
  border-color: rgba(245, 196, 81, 0.35);
  background: linear-gradient(135deg, rgba(245, 196, 81, 0.08), rgba(0, 0, 0, 0.3));
}
.result-item.result-item-muted {
  opacity: 0.7;
}
.result-label {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 700;
}
.result-item strong {
  color: #f1f5f9;
  font-size: 1rem;
  word-break: break-all;
}
.money-big {
  color: #ffd166 !important;
  font-size: 1.3rem !important;
}

/* ===== Stat card ===== */
.stat-row {
  display: flex;
  align-items: stretch;
  gap: 24px;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;
  padding: 6px 0;
}
.stat-label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.stat-value {
  font-size: 1.6rem;
  font-weight: 900;
  color: #f1f5f9;
  font-variant-numeric: tabular-nums;
}
.stat-value-money {
  color: #ffd166;
}
.stat-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* ===== Table ===== */
.table-scroll {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.data-table thead {
  background: rgba(0, 0, 0, 0.3);
}
.data-table th {
  padding: 14px 16px;
  text-align: left;
  font-weight: 700;
  color: #94a3b8;
  font-size: 0.74rem;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  white-space: nowrap;
}
.data-table th.th-actions {
  text-align: right;
}
.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
.data-table td.td-actions {
  text-align: right;
}
.data-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
.data-table tbody tr:last-child td {
  border-bottom: none;
}

.muted {
  color: #64748b;
}
.muted-sm {
  color: #64748b;
  font-size: 0.78rem;
  margin-top: 3px;
}
.small {
  font-size: 0.82rem;
}
.money {
  color: #ffd166;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.rate {
  color: #ffd166;
  font-variant-numeric: tabular-nums;
}

.code-tag {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(245, 196, 81, 0.1);
  border: 1px solid rgba(245, 196, 81, 0.25);
  border-radius: 6px;
  color: #ffd166;
  font-family: monospace;
  font-size: 0.84rem;
  cursor: pointer;
  transition: all 0.15s;
}
.code-tag:hover {
  background: rgba(245, 196, 81, 0.2);
}

/* ===== Pill ===== */
.pill {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.pill-on,
.pill-pending {
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}
.pill-off,
.pill-cancelled {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.35);
}
.pill-settled {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}
.pill-info {
  background: rgba(99, 102, 241, 0.18);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.4);
}

/* ===== Action button row in table ===== */
.row-actions {
  display: inline-flex;
  gap: 6px;
}

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  padding: 0 18px;
  min-width: 88px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  transition: all 0.15s;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  white-space: nowrap;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn:active {
  transform: translateY(0);
}
.btn-row {
  height: 32px;
  padding: 0 14px;
  min-width: 64px;
  font-size: 0.8rem;
  border-radius: 8px;
}
.btn-lg {
  height: 48px;
  padding: 0 24px;
  font-size: 0.95rem;
  border-radius: 12px;
}
.btn-block {
  width: 100%;
}
.btn-primary {
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0a0b10;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
}
.btn-primary:hover {
  box-shadow: 0 8px 22px rgba(245, 158, 11, 0.45);
}
.btn-ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}
.btn-ghost:hover {
  border-color: #ffd166;
  color: #ffd166;
}
.btn-danger-ghost {
  background: transparent;
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
.btn-danger-ghost:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.5);
}

/* ===== State (loading / empty) ===== */
.state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}
.state-emoji {
  font-size: 3rem;
  margin-bottom: 8px;
  opacity: 0.6;
}

/* ===== Toast ===== */
.toast-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.toast {
  padding: 14px 20px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.92rem;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  animation: slideIn 0.25s ease-out;
  max-width: 400px;
  pointer-events: auto;
}
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
.toast-success {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
}
.toast-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
}
.toast-info {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #fff;
}
</style>
