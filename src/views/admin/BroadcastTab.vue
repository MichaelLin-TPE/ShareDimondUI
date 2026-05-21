<script setup lang="ts">
import { ref } from 'vue'
import { useAdminClient } from '@/composables/adminClient'

const { callApi, showToast } = useAdminClient()

type BroadcastResult = {
  totalLeaders: number
  sent: number
  skippedNoEmail: number
  failed: number
  failedEmails: string[]
}

const broadcasting = ref(false)
const broadcastResult = ref<BroadcastResult | null>(null)

// 預覽 — 跟後端 AdminBroadcastService.buildBody 對齊
const broadcastSubject = '【Diamond Core】感謝您使用我們的分寶系統 💎'
const broadcastBody = [
  '親愛的 [會長名稱] 會長,您好',
  '',
  '感謝您選擇 Diamond Core 遊戲分寶系統,讓「[血盟名稱]」的血盟分寶、',
  '競標、提領流程更輕鬆透明。',
  '',
  '如果您在使用上有任何疑問或需求,我們很樂意提供協助:',
  '・免費試用與諮詢',
  '・一對一教學服務',
  '・客製化功能開發',
  '',
  'LINE 客服:https://lin.ee/QlLZrQa',
  '網站:https://gameshare-system.com',
  '',
  '我們會盡快回覆,協助您把血盟營運得更順暢。',
  '',
  '祝您遊戲愉快,血盟興旺!',
  '',
  '— Diamond Core 團隊',
].join('\n')

async function broadcastLeaders() {
  if (broadcasting.value) return
  const ok = window.confirm(
    '確定要發信給所有現任血盟會長嗎?\n\n(同一帳號當多盟會長只寄一次,沒填 Email 的會跳過)',
  )
  if (!ok) return
  broadcasting.value = true
  broadcastResult.value = null
  try {
    const res = await callApi<BroadcastResult>('POST', '/admin/broadcast/leaders')
    broadcastResult.value = res
    showToast(
      'success',
      `寄信完成:成功 ${res.sent} / 略過無 Email ${res.skippedNoEmail} / 失敗 ${res.failed}`,
    )
  } catch (e) {
    showToast('error', (e as Error).message)
  } finally {
    broadcasting.value = false
  }
}
</script>

<template>
  <div class="panel">
    <div class="card">
      <div class="card-head">
        <div class="card-head-text">
          <h2>📧 一鍵發信給所有血盟會長</h2>
          <p>
            對象:所有目前 status = ACTIVE、role = LEADER 的會長,依 email 自動去重
            (同一帳號當多盟會長只寄一次)
          </p>
        </div>
      </div>
      <div class="card-body">
        <div class="bc-block">
          <div class="bc-label">📬 信件主旨</div>
          <div class="bc-subject">{{ broadcastSubject }}</div>
        </div>

        <div class="bc-block">
          <div class="bc-label">✉️ 信件內文預覽</div>
          <div class="bc-preview">{{ broadcastBody }}</div>
        </div>

        <div class="bc-actions">
          <button
            type="button"
            class="btn btn-primary btn-lg"
            :disabled="broadcasting"
            @click="broadcastLeaders"
          >
            {{ broadcasting ? '寄信中…' : '📨 一鍵發送給所有會長' }}
          </button>
        </div>

        <div v-if="broadcastResult" class="bc-result">
          <h3>📊 寄送結果</h3>
          <ul>
            <li>會長總數:<strong>{{ broadcastResult.totalLeaders }}</strong></li>
            <li>✅ 成功寄出:<strong>{{ broadcastResult.sent }}</strong></li>
            <li>⏭️ 略過 (沒填 Email):<strong>{{ broadcastResult.skippedNoEmail }}</strong></li>
            <li>❌ 失敗:<strong>{{ broadcastResult.failed }}</strong></li>
          </ul>
          <div v-if="broadcastResult.failedEmails.length > 0" class="bc-failed">
            <div class="bc-failed-title">失敗的 Email:</div>
            <div class="bc-failed-list">
              <code v-for="e in broadcastResult.failedEmails" :key="e">{{ e }}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
