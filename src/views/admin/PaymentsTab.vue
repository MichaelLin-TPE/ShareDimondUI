<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdminClient, fmtDate, fmtMoney } from '@/composables/adminClient'

const { callApi, showToast, copy } = useAdminClient()

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

onMounted(loadPayments)
defineExpose({ refresh: loadPayments })
</script>

<template>
  <div class="panel">
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
  </div>
</template>
