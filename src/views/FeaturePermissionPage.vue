<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const authStore = useAuthStore()
const API = 'https://api.gameshare-system.com'

interface FeatureRow {
  key: string
  label: string
  tier: 'MEMBER' | 'OFFICER' | 'LEADER'
  enabled: boolean
}

const rows = ref<FeatureRow[]>([])
const loading = ref(false)
const savingKey = ref<string | null>(null)

function authHeaders() {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await fetch(`${API}/clan-feature`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message || '讀取失敗')
      return
    }
    rows.value = data
  } catch {
    useAlert.error('讀取失敗')
  } finally {
    loading.value = false
  }
}

async function toggle(row: FeatureRow) {
  if (savingKey.value) return
  const next = !row.enabled
  savingKey.value = row.key
  try {
    const res = await fetch(`${API}/clan-feature`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ key: row.key, enabled: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message || '更新失敗')
      return
    }
    row.enabled = next
    useAlert.success(`「${row.label}」已${next ? '啟用' : '停用'}`)
  } catch {
    useAlert.error('更新失敗')
  } finally {
    savingKey.value = null
  }
}

const memberFeatures = computed(() => rows.value.filter((r) => r.tier === 'MEMBER'))
const officerFeatures = computed(() => rows.value.filter((r) => r.tier === 'OFFICER'))

onMounted(load)
</script>

<template>
  <div class="fp-wrap">
    <div class="fp-head">
      <h1>🎛️ 功能權限</h1>
      <p class="fp-sub">
        開 / 關本血盟的功能。關掉的功能整個血盟都用不了(選單會隱藏、操作也會被擋)。功能不會改變所屬角色,只是能被停用。
      </p>
    </div>

    <div v-if="loading" class="fp-loading">載入中…</div>

    <template v-else>
      <section class="fp-section">
        <div class="fp-section-title">🟢 會員功能</div>
        <div class="fp-list">
          <div v-for="r in memberFeatures" :key="r.key" class="fp-row">
            <span class="fp-label">{{ r.label }}</span>
            <div class="cs-toggle" :class="{ active: r.enabled }" @click="toggle(r)">
              <div class="cs-toggle-track"><div class="cs-toggle-handle"></div></div>
              <span class="cs-toggle-text">{{ r.enabled ? '啟用中' : '已停用' }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="fp-section">
        <div class="fp-section-title">🟡 幹部功能</div>
        <div class="fp-list">
          <div v-for="r in officerFeatures" :key="r.key" class="fp-row">
            <span class="fp-label">{{ r.label }}</span>
            <div class="cs-toggle" :class="{ active: r.enabled }" @click="toggle(r)">
              <div class="cs-toggle-track"><div class="cs-toggle-handle"></div></div>
              <span class="cs-toggle-text">{{ r.enabled ? '啟用中' : '已停用' }}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="fp-locked">
        🔒 會長專屬功能(改成員角色、踢人、基金分配、血盟設定、血盟基金、全員錢包、操作日誌、賭場賠率)永遠可用、不列於此,以策安全。
      </div>
    </template>
  </div>
</template>

<style scoped>
.fp-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 4px 40px;
}
.fp-head h1 {
  color: #f1f5f9;
  font-size: 1.4rem;
  margin: 0 0 6px;
}
.fp-sub {
  color: #94a3b8;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0 0 18px;
}
.fp-loading {
  color: #94a3b8;
  text-align: center;
  padding: 40px 0;
}
.fp-section {
  margin-bottom: 22px;
}
.fp-section-title {
  color: var(--c-light);
  font-weight: 700;
  font-size: 1rem;
  margin: 0 0 10px;
}
.fp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #141726;
  border: 1px solid #2e3147;
  border-radius: 12px;
  padding: 10px 14px;
}
.fp-label {
  color: #e2e8f0;
  font-size: 0.95rem;
  font-weight: 600;
}
.fp-locked {
  margin-top: 8px;
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.5;
  background: rgba(var(--c-deep-rgb), 0.25);
  border: 1px dashed #2e3147;
  border-radius: 12px;
  padding: 12px 14px;
}

/* cs-toggle：沿用血盟設置頁的開關樣式 */
.cs-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 0 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  height: 40px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.cs-toggle-track {
  width: 42px;
  height: 22px;
  background: #2e3147;
  border-radius: 100px;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
}
.cs-toggle.active .cs-toggle-track {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.35);
}
.cs-toggle-handle {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: left 0.25s;
}
.cs-toggle.active .cs-toggle-handle {
  left: 23px;
}
.cs-toggle-text {
  color: #e2e8f0;
  font-size: 0.82rem;
  font-weight: 600;
  min-width: 3.5em;
  text-align: left;
}
</style>
