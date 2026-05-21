<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAdminClient, fmtDate } from '@/composables/adminClient'

const { callApi, showToast, copy } = useAdminClient()

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

onMounted(loadCodes)
defineExpose({ refresh: loadCodes })
</script>

<template>
  <div class="panel">
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
  </div>
</template>
