<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdminClient, fmtDate } from '@/composables/adminClient'

const { callApi, showToast, copy } = useAdminClient()

type LicenseStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED'
type LicensePlan = 'PERPETUAL' | 'SUBSCRIPTION'
type License = {
  id: number
  serial: string
  status: LicenseStatus
  plan: LicensePlan
  expiresAt: string | null
  boundFingerprint: string | null
  boundAt: string | null
  ownerNote: string | null
  lastSeenAt: string | null
  lastAppVer: string | null
  createdAt: string
}

const list = ref<License[]>([])
const loading = ref(false)
const form = ref<{ plan: LicensePlan; expiresAt: string; ownerNote: string }>({
  plan: 'PERPETUAL',
  expiresAt: '',
  ownerNote: '',
})

async function load() {
  loading.value = true
  try {
    list.value = await callApi<License[]>('GET', '/admin/license')
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (form.value.plan === 'SUBSCRIPTION' && !form.value.expiresAt) {
    showToast('error', '訂閱制必填到期日')
    return
  }
  try {
    const lic = await callApi<License>('POST', '/admin/license', {
      plan: form.value.plan,
      expiresAt: form.value.plan === 'SUBSCRIPTION' ? form.value.expiresAt : '',
      ownerNote: form.value.ownerNote.trim(),
    })
    showToast('success', `序號已產生:${lic.serial}(已複製)`)
    copy(lic.serial)
    form.value = { plan: 'PERPETUAL', expiresAt: '', ownerNote: '' }
    await load()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

async function setStatus(l: License, value: LicenseStatus, confirmMsg?: string) {
  if (confirmMsg && !window.confirm(confirmMsg)) return
  try {
    await callApi('PUT', `/admin/license/${l.id}/status?value=${value}`)
    showToast('success', `${l.serial} → ${statusText(value)}`)
    await load()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

async function resetDevice(l: License) {
  if (!window.confirm(`重置「${l.serial}」的綁定機器?\n對方就能在新的一台電腦重新啟用。`)) return
  try {
    await callApi('POST', `/admin/license/${l.id}/reset-device`)
    showToast('success', `${l.serial} 已重置機器綁定`)
    await load()
  } catch (e) {
    showToast('error', (e as Error).message)
  }
}

function statusText(s: LicenseStatus) {
  return s === 'ACTIVE' ? '啟用中' : s === 'DISABLED' ? '已停用' : '已吊銷'
}
function planText(p: LicensePlan) {
  return p === 'PERPETUAL' ? '永久' : '訂閱'
}
function shortFp(fp: string | null) {
  return fp ? fp.slice(0, 10) + '…' : ''
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<template>
  <div class="panel">
    <!-- 產生序號 -->
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>➕ 產生授權序號</h2>
          <p>產生後把序號給對方,對方在 MotionHunter 貼上啟用(一序號綁一台機器)</p>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <label class="field-wrap">
            <span class="label">方案 *</span>
            <select v-model="form.plan" class="field">
              <option value="PERPETUAL">永久</option>
              <option value="SUBSCRIPTION">訂閱(到期停用)</option>
            </select>
          </label>
          <label v-if="form.plan === 'SUBSCRIPTION'" class="field-wrap">
            <span class="label">到期日 *</span>
            <input v-model="form.expiresAt" type="date" class="field" />
          </label>
          <label class="field-wrap">
            <span class="label">備註(給誰)</span>
            <input v-model="form.ownerNote" class="field" placeholder="例: 王小明 / LINE abc" />
          </label>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-lg" @click="create">產生序號</button>
        </div>
      </div>
    </div>

    <!-- 序號列表 -->
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>📋 所有序號</h2>
          <p>共 {{ list.length }} 筆</p>
        </div>
        <button class="btn btn-ghost" @click="load">🔄 重新整理</button>
      </div>
      <div class="card-body p-0">
        <div v-if="loading" class="state state-loading">載入中...</div>
        <div v-else-if="!list.length" class="state state-empty">
          <div class="state-emoji">📭</div>
          <div>還沒有任何序號</div>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>序號</th>
                <th>狀態</th>
                <th>方案</th>
                <th>到期</th>
                <th>綁定機器</th>
                <th>最後上線</th>
                <th>備註</th>
                <th class="th-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in list" :key="l.id">
                <td><code class="code-tag" @click="copy(l.serial)">{{ l.serial }}</code></td>
                <td>
                  <span :class="['pill', l.status === 'ACTIVE' ? 'pill-on' : 'pill-off']">
                    {{ statusText(l.status) }}
                  </span>
                </td>
                <td>{{ planText(l.plan) }}</td>
                <td class="muted small">{{ l.plan === 'SUBSCRIPTION' ? fmtDate(l.expiresAt) : '—' }}</td>
                <td class="muted small">
                  <span v-if="l.boundFingerprint" :title="l.boundFingerprint">
                    {{ shortFp(l.boundFingerprint) }}
                  </span>
                  <span v-else>未啟用</span>
                </td>
                <td class="muted small">{{ l.lastSeenAt ? fmtDate(l.lastSeenAt) : '—' }}</td>
                <td class="muted small">{{ l.ownerNote || '—' }}</td>
                <td class="td-actions">
                  <button
                    v-if="l.status !== 'ACTIVE'"
                    class="btn btn-row btn-primary"
                    @click="setStatus(l, 'ACTIVE')"
                  >
                    啟用
                  </button>
                  <button
                    v-if="l.status === 'ACTIVE'"
                    class="btn btn-row btn-danger-ghost"
                    @click="setStatus(l, 'DISABLED')"
                  >
                    停用
                  </button>
                  <button
                    v-if="l.status !== 'REVOKED'"
                    class="btn btn-row btn-danger-ghost"
                    @click="setStatus(l, 'REVOKED', `確定吊銷「${l.serial}」?此序號將永久失效(可再啟用)。`)"
                  >
                    吊銷
                  </button>
                  <button
                    v-if="l.boundFingerprint"
                    class="btn btn-row btn-ghost"
                    @click="resetDevice(l)"
                  >
                    重置機器
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
