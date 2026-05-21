<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdminClient, fmtDate, fmtMoney } from '@/composables/adminClient'

const { callApi, showToast, copy } = useAdminClient()

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
const commissionFilter = ref<{
  status: '' | 'PENDING' | 'SETTLED' | 'CANCELLED'
  referralCode: string
}>({
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
    const res = await callApi<{
      count: number
      totalCommission: number
      records: CommissionRecord[]
    }>('GET', `/admin/commission${qs ? '?' + qs : ''}`)
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

onMounted(loadCommissions)
defineExpose({ refresh: loadCommissions })
</script>

<template>
  <div class="panel">
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
  </div>
</template>
