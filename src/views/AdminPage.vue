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
  { key: 'codes', label: '🎟️ 推廣碼', desc: '管理推廣者' },
  { key: 'extend', label: '⏰ 血盟延期', desc: '收款 + 延長 + 自動算抽成' },
  { key: 'payments', label: '💵 付款記錄', desc: '查所有收款' },
  { key: 'commissions', label: '💰 抽成結算', desc: '撥款給推廣者' },
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
  { plan: 'MONTHLY', label: '月繳', days: 30, amount: 2000 },
  { plan: 'YEARLY', label: '年繳', days: 365, amount: 20000 },
  { plan: 'LARGE_MONTHLY', label: '100人月', days: 30, amount: 3500 },
  { plan: 'LARGE_YEARLY', label: '100人年', days: 365, amount: 35000 },
  { plan: 'TRIAL_EXTENSION', label: '試用延長', days: 7, amount: 0 },
  { plan: 'CUSTOM', label: '自訂', days: 0, amount: 0 },
] as const

function applyPlanPreset(plan: ExtendForm['plan']) {
  const p = planPresets.find((x) => x.plan === plan)
  if (!p) return
  extendForm.value.plan = p.plan
  if (p.days) extendForm.value.days = p.days
  if (p.amount) extendForm.value.amount = p.amount
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
          class="gate-input"
          @keyup.enter="saveToken"
        />
        <button class="btn primary block" @click="saveToken">進入</button>
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
          <button class="btn ghost sm" @click="refreshAll">🔄 全部重新整理</button>
          <button class="btn danger-ghost sm" @click="clearToken">登出</button>
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
          <div class="tab-label">{{ t.label }}</div>
          <div class="tab-desc">{{ t.desc }}</div>
        </button>
      </nav>

      <!-- ===== Tab: 推廣碼 ===== -->
      <section v-if="activeTab === 'codes'" class="panel">
        <div class="panel-head">
          <h2>🎟️ 推廣碼管理</h2>
          <button class="btn ghost sm" @click="loadCodes">重新整理</button>
        </div>

        <div class="card form-card">
          <div class="card-title">➕ 新增推廣碼</div>
          <div class="grid-form">
            <label>
              <span>推廣碼 *</span>
              <input v-model="codeForm.code" placeholder="例: PROMO001" />
            </label>
            <label>
              <span>推廣人姓名 *</span>
              <input v-model="codeForm.ownerName" placeholder="例: 王小明" />
            </label>
            <label>
              <span>聯絡方式</span>
              <input v-model="codeForm.ownerContact" placeholder="LINE / 電話 / Email" />
            </label>
            <label>
              <span>抽成 % *</span>
              <input v-model.number="codeForm.commissionRate" type="number" min="0" max="100" step="0.01" />
            </label>
          </div>
          <button class="btn primary" @click="createCode">建立</button>
        </div>

        <div class="card">
          <div class="card-title">📋 所有推廣碼 ({{ codes.length }})</div>
          <div v-if="codesLoading" class="loading">載入中...</div>
          <div v-else-if="!codes.length" class="empty">還沒有任何推廣碼</div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>推廣碼</th>
                <th>推廣人</th>
                <th>聯絡</th>
                <th>抽成</th>
                <th>狀態</th>
                <th>建立時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in codes" :key="c.id">
                <td>
                  <code class="code-tag" @click="copy(c.code)">{{ c.code }}</code>
                </td>
                <td>{{ c.ownerName }}</td>
                <td class="muted">{{ c.ownerContact || '-' }}</td>
                <td>{{ c.commissionRate }}%</td>
                <td>
                  <span :class="['pill', c.enabled ? 'pill-on' : 'pill-off']">
                    {{ c.enabled ? '啟用' : '停用' }}
                  </span>
                </td>
                <td class="muted">{{ fmtDate(c.createdAt) }}</td>
                <td>
                  <button class="btn sm" :class="c.enabled ? 'danger-ghost' : 'primary'" @click="toggleCode(c)">
                    {{ c.enabled ? '停用' : '啟用' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===== Tab: 延期 ===== -->
      <section v-if="activeTab === 'extend'" class="panel">
        <div class="panel-head">
          <h2>⏰ 血盟延期 + 收款</h2>
          <span class="head-hint">這個動作會: 延長血盟有效期 + 紀錄付款 + 自動建抽成 (如有推廣碼)</span>
        </div>

        <div class="card form-card">
          <div class="card-title">📥 收到匯款後填這裡</div>

          <div class="preset-row">
            <button
              v-for="p in planPresets"
              :key="p.plan"
              class="preset-btn"
              :class="{ active: extendForm.plan === p.plan }"
              @click="applyPlanPreset(p.plan)"
            >
              {{ p.label }}
            </button>
          </div>

          <div class="grid-form">
            <label class="span-2">
              <span>血盟 ID *</span>
              <input v-model="extendForm.clanId" placeholder="從血盟設定頁複製" />
            </label>
            <label>
              <span>延長天數 *</span>
              <input v-model.number="extendForm.days" type="number" min="1" />
            </label>
            <label>
              <span>收款金額 (NT$)</span>
              <input v-model.number="extendForm.amount" type="number" min="0" />
            </label>
            <label class="span-2">
              <span>備註 (匯款帳號末五碼等)</span>
              <input v-model="extendForm.note" placeholder="例: 玉山末五 12345" />
            </label>
          </div>

          <button class="btn primary lg" @click="submitExtend">🚀 送出延期 + 紀錄收款</button>
        </div>

        <div v-if="extendResult" class="card result-card">
          <div class="card-title">✅ 處理完成</div>
          <div class="result-grid">
            <div><span class="muted">血盟 ID</span><strong>{{ extendResult.clanId }}</strong></div>
            <div><span class="muted">新到期時間</span><strong>{{ fmtDateMs(extendResult.expiresAtMs) }}</strong></div>
            <div><span class="muted">付款記錄 ID</span><strong>#{{ extendResult.paymentId }}</strong></div>
            <div v-if="extendResult.commissionId">
              <span class="muted">抽成記錄 ID</span>
              <strong>#{{ extendResult.commissionId }} ({{ fmtMoney(extendResult.commissionAmount) }})</strong>
            </div>
            <div v-else class="muted">此血盟未綁定推廣碼,無抽成</div>
          </div>
        </div>
      </section>

      <!-- ===== Tab: 付款記錄 ===== -->
      <section v-if="activeTab === 'payments'" class="panel">
        <div class="panel-head">
          <h2>💵 付款記錄</h2>
        </div>

        <div class="card filter-card">
          <div class="filter-row">
            <input v-model="paymentFilter.clanId" placeholder="血盟 ID" />
            <input v-model="paymentFilter.referralCode" placeholder="推廣碼" />
            <button class="btn primary sm" @click="loadPayments">查詢</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">{{ payments.length }} 筆付款</div>
          <div v-if="paymentsLoading" class="loading">載入中...</div>
          <div v-else-if="!payments.length" class="empty">沒有資料</div>
          <table v-else class="data-table">
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
                <td>#{{ p.id }}</td>
                <td><code class="code-tag" @click="copy(p.clanId)">{{ p.clanId }}</code></td>
                <td>{{ p.plan }}</td>
                <td class="money">{{ fmtMoney(p.amount) }}</td>
                <td>{{ p.extendDays }} 天</td>
                <td>
                  <code v-if="p.referralCodeSnapshot" class="code-tag">{{ p.referralCodeSnapshot }}</code>
                  <span v-else class="muted">-</span>
                </td>
                <td class="muted">{{ p.note || '-' }}</td>
                <td class="muted">{{ fmtDate(p.receivedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===== Tab: 抽成 ===== -->
      <section v-if="activeTab === 'commissions'" class="panel">
        <div class="panel-head">
          <h2>💰 抽成結算</h2>
        </div>

        <div class="card filter-card">
          <div class="filter-row">
            <select v-model="commissionFilter.status">
              <option value="">全部狀態</option>
              <option value="PENDING">待結算 PENDING</option>
              <option value="SETTLED">已結算 SETTLED</option>
              <option value="CANCELLED">已取消 CANCELLED</option>
            </select>
            <input v-model="commissionFilter.referralCode" placeholder="推廣碼" />
            <button class="btn primary sm" @click="loadCommissions">查詢</button>
          </div>
        </div>

        <div class="card sum-card">
          <div class="sum-row">
            <span>共 <strong>{{ commissions.length }}</strong> 筆</span>
            <span>總金額 <strong class="money-big">{{ fmtMoney(commissionTotal) }}</strong></span>
          </div>
        </div>

        <div class="card">
          <div v-if="commissionsLoading" class="loading">載入中...</div>
          <div v-else-if="!commissions.length" class="empty">沒有資料</div>
          <table v-else class="data-table">
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
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in commissions" :key="c.id">
                <td>#{{ c.id }}</td>
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
                <td class="muted">{{ fmtDate(c.createdAt) }}</td>
                <td class="muted">{{ fmtDate(c.settledAt) }}</td>
                <td>
                  <div class="btn-group" v-if="c.status === 'PENDING'">
                    <button class="btn primary sm" @click="settleCommission(c)">✅ 結算</button>
                    <button class="btn danger-ghost sm" @click="cancelCommission(c)">取消</button>
                  </div>
                  <span v-else class="muted-sm">—</span>
                </td>
              </tr>
            </tbody>
          </table>
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
}

/* ===== Token gate ===== */
.gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at top, rgba(245, 196, 81, 0.1), transparent 60%),
    #0a0b10;
}
.gate-card {
  width: 100%;
  max-width: 380px;
  padding: 36px 28px;
  background: rgba(22, 24, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.gate-emoji {
  font-size: 3rem;
  margin-bottom: 8px;
}
.gate-card h1 {
  margin: 0 0 4px;
  font-size: 1.5rem;
  color: #f1f5f9;
}
.gate-sub {
  color: #94a3b8;
  margin: 0 0 22px;
  font-size: 0.9rem;
}
.gate-input {
  width: 100%;
  padding: 12px 14px;
  margin-bottom: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #f1f5f9;
  font-family: monospace;
  font-size: 0.9rem;
}
.gate-input:focus {
  outline: none;
  border-color: #ffd166;
}
.gate-hint {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 0.78rem;
}

/* ===== Main layout ===== */
.main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 24px 60px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1.15rem;
  font-weight: 800;
  color: #ffd166;
}
.brand-emoji {
  font-size: 1.5rem;
}
.topbar-right {
  display: inline-flex;
  gap: 8px;
}

/* ===== Tabs ===== */
.tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}
@media (max-width: 760px) {
  .tabs {
    grid-template-columns: repeat(2, 1fr);
  }
}
.tab {
  padding: 14px;
  background: rgba(22, 24, 34, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: #cbd5e1;
  cursor: pointer;
  text-align: left;
  transition: all 0.18s;
  font-family: inherit;
}
.tab:hover {
  border-color: rgba(245, 196, 81, 0.3);
  transform: translateY(-1px);
}
.tab.active {
  border-color: #ffd166;
  background: linear-gradient(180deg, rgba(245, 196, 81, 0.12), rgba(22, 24, 34, 0.6));
  color: #ffd166;
}
.tab-label {
  font-weight: 800;
  font-size: 0.95rem;
  margin-bottom: 2px;
}
.tab-desc {
  font-size: 0.72rem;
  color: #64748b;
}
.tab.active .tab-desc {
  color: #94a3b8;
}

/* ===== Panel / Card ===== */
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.panel-head h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #f1f5f9;
}
.head-hint {
  color: #64748b;
  font-size: 0.82rem;
}
.card {
  background: rgba(22, 24, 34, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 20px;
}
.card-title {
  font-weight: 800;
  font-size: 1rem;
  margin-bottom: 14px;
  color: #f1f5f9;
}

/* ===== Form ===== */
.grid-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width: 600px) {
  .grid-form {
    grid-template-columns: 1fr;
  }
}
.grid-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.grid-form label.span-2 {
  grid-column: span 2;
}
@media (max-width: 600px) {
  .grid-form label.span-2 {
    grid-column: span 1;
  }
}
.grid-form span {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
}
.grid-form input,
.filter-row input,
.filter-row select {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  font-family: inherit;
  font-size: 0.9rem;
}
.grid-form input:focus,
.filter-row input:focus,
.filter-row select:focus {
  outline: none;
  border-color: #ffd166;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.preset-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: #cbd5e1;
  font-size: 0.78rem;
  cursor: pointer;
  font-family: inherit;
}
.preset-btn:hover {
  border-color: rgba(245, 196, 81, 0.4);
  color: #ffd166;
}
.preset-btn.active {
  background: rgba(245, 196, 81, 0.15);
  border-color: #ffd166;
  color: #ffd166;
}

/* ===== Filter ===== */
.filter-card {
  padding: 14px 18px;
}
.filter-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-row > * {
  flex: 1;
  min-width: 160px;
}
.filter-row > button {
  flex: 0 0 auto;
}

/* ===== Result ===== */
.result-card {
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.07), rgba(22, 24, 34, 0.55));
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.result-grid > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}
.result-grid strong {
  color: #f1f5f9;
  font-size: 0.95rem;
}

/* ===== Sum card ===== */
.sum-card {
  background: linear-gradient(135deg, rgba(245, 196, 81, 0.08), rgba(22, 24, 34, 0.6));
  border-color: rgba(245, 196, 81, 0.25);
}
.sum-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  flex-wrap: wrap;
  gap: 12px;
}
.sum-row strong {
  color: #ffd166;
}
.money-big {
  font-size: 1.4rem !important;
}

/* ===== Table ===== */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.data-table thead {
  background: rgba(0, 0, 0, 0.3);
}
.data-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  color: #94a3b8;
  font-size: 0.78rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}
.data-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
.muted {
  color: #64748b;
}
.muted-sm {
  color: #64748b;
  font-size: 0.75rem;
  margin-top: 2px;
}
.money {
  color: #ffd166;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.code-tag {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(245, 196, 81, 0.1);
  border: 1px solid rgba(245, 196, 81, 0.25);
  border-radius: 6px;
  color: #ffd166;
  font-family: monospace;
  font-size: 0.82rem;
  cursor: pointer;
}
.code-tag:hover {
  background: rgba(245, 196, 81, 0.18);
}

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}
.pill-on,
.pill-pending {
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}
.pill-off,
.pill-cancelled {
  background: rgba(100, 116, 139, 0.18);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.4);
}
.pill-settled {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.btn-group {
  display: inline-flex;
  gap: 6px;
}

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  transition: all 0.15s;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn.sm {
  padding: 6px 10px;
  font-size: 0.78rem;
}
.btn.lg {
  padding: 12px 20px;
  font-size: 0.95rem;
  width: 100%;
}
.btn.block {
  width: 100%;
}
.btn.primary {
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0a0b10;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
}
.btn.ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
}
.btn.ghost:hover {
  border-color: #ffd166;
  color: #ffd166;
}
.btn.danger-ghost {
  background: transparent;
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}
.btn.danger-ghost:hover {
  background: rgba(239, 68, 68, 0.12);
}

/* ===== Loading / Empty ===== */
.loading,
.empty {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

/* ===== Toast ===== */
.toast-stack {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toast {
  padding: 12px 18px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  animation: slideIn 0.25s ease-out;
  max-width: 380px;
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
  background: rgba(34, 197, 94, 0.95);
  color: #fff;
}
.toast-error {
  background: rgba(239, 68, 68, 0.95);
  color: #fff;
}
.toast-info {
  background: rgba(99, 102, 241, 0.95);
  color: #fff;
}
</style>
