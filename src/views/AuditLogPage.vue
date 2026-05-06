<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useAlert } from '@/utils/alerts.ts'

const authStore = useAuthStore()

type Severity = 'CRITICAL' | 'WARNING' | 'INFO'
type SeverityFilter = 'ALL' | Severity

interface AuditLogItem {
  id: number
  operatorId: number
  operatorName: string
  operatorIp: string | null
  action: string
  severity: Severity
  targetType: string | null
  targetId: string | null
  targetName: string | null
  beforeData: string | null
  afterData: string | null
  summary: string | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  CHANGE_MEMBER_ROLE: '角色變更',
  REMOVE_MEMBER: '踢出成員',
  CONFIRM_MEMBER_IN: '入會通過',
  CONFIRM_MEMBER_OUT: '入會拒絕',
  SET_TREASURE_BUYER: '強設買家',
  DELETE_ATTENDANCE_BY_LEADER: '移除出席',
  UPDATE_ITEM_PRICE: '改物品底價',
  CONFIRM_WITHDRAW: '提款審核',
  SHARE_ALL: '公積金分配',
}

const SEVERITY_TABS: { key: SeverityFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'CRITICAL', label: '🔴 嚴重' },
  { key: 'WARNING', label: '🟡 警告' },
  { key: 'INFO', label: '🔵 資訊' },
]

// 篩選
const activeSeverity = ref<SeverityFilter>('ALL')
const activeAction = ref<string>('ALL')
const searchQuery = ref('')

// 資料
const items = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(0)
const size = ref(30)
const loading = ref(false)
const expanded = reactive<Record<number, boolean>>({})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))

const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('size', String(size.value))
    if (activeSeverity.value !== 'ALL') params.set('severity', activeSeverity.value)
    if (activeAction.value !== 'ALL') params.set('action', activeAction.value)
    const res = await fetch(
      `https://api.gameshare-system.com/audit-log?${params.toString()}`,
      { headers: headers() },
    )
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message ?? '取得操作日誌失敗')
      items.value = []
      total.value = 0
      return
    }
    items.value = data.items ?? []
    total.value = data.total ?? 0
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  } finally {
    loading.value = false
  }
}

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (it) =>
      (it.operatorName ?? '').toLowerCase().includes(q) ||
      (it.targetName ?? '').toLowerCase().includes(q) ||
      (it.summary ?? '').toLowerCase().includes(q),
  )
})

const setSeverity = (s: SeverityFilter) => {
  activeSeverity.value = s
  page.value = 0
  fetchLogs()
}
const setAction = (a: string) => {
  activeAction.value = a
  page.value = 0
  fetchLogs()
}
const goPrev = () => {
  if (page.value > 0) {
    page.value--
    fetchLogs()
  }
}
const goNext = () => {
  if (page.value + 1 < totalPages.value) {
    page.value++
    fetchLogs()
  }
}
const toggle = (id: number) => {
  expanded[id] = !expanded[id]
}

const formatTime = (s: string) =>
  new Date(s).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const prettyJson = (raw: string | null) => {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const severityLabel = (s: Severity) =>
  s === 'CRITICAL' ? '嚴重' : s === 'WARNING' ? '警告' : '資訊'

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="audit-page">
    <!-- 標題 -->
    <header class="audit-head">
      <div class="head-text">
        <h2 class="audit-title">🛡️ 操作日誌</h2>
        <p class="audit-sub">會長視角 · 治理動作追蹤 · 共 {{ total }} 筆</p>
      </div>
    </header>

    <!-- 嚴重度 segmented tabs -->
    <div class="seg-tabs">
      <button
        v-for="t in SEVERITY_TABS"
        :key="t.key"
        type="button"
        class="seg-btn"
        :class="{ active: activeSeverity === t.key }"
        @click="setSeverity(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 搜尋 + 動作類型 -->
    <div class="filter-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 搜尋操作者 / 目標 / 摘要..."
        class="search-input"
      />
      <div class="action-tags">
        <span
          class="action-tag"
          :class="{ 'is-active': activeAction === 'ALL' }"
          @click="setAction('ALL')"
        >全部動作</span>
        <span
          v-for="(label, key) in ACTION_LABELS"
          :key="key"
          class="action-tag"
          :class="{ 'is-active': activeAction === key }"
          @click="setAction(String(key))"
        >{{ label }}</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="log-grid">
      <div v-if="loading" class="state-card">
        <div class="state-icon">⏳</div>
        載入中...
      </div>
      <div
        v-else-if="filteredItems.length === 0"
        class="state-card"
      >
        <div class="state-icon">📂</div>
        找不到符合條件的紀錄
      </div>
      <div
        v-else
        v-for="item in filteredItems"
        :key="item.id"
        class="log-card"
        :class="`sev-${item.severity.toLowerCase()}`"
      >
        <div class="log-head">
          <span class="sev-badge" :class="`sev-badge-${item.severity.toLowerCase()}`">
            {{ severityLabel(item.severity) }}
          </span>
          <span class="action-label">
            {{ ACTION_LABELS[item.action] ?? item.action }}
          </span>
          <span class="log-time">{{ formatTime(item.createdAt) }}</span>
        </div>
        <div class="log-summary">
          {{ item.summary ?? '—' }}
        </div>
        <div class="log-meta">
          <span class="meta-chip">👤 {{ item.operatorName }}</span>
          <span v-if="item.targetName" class="meta-chip">🎯 {{ item.targetName }}</span>
          <span v-if="item.operatorIp" class="meta-chip meta-ip">🌐 {{ item.operatorIp }}</span>
        </div>
        <button
          v-if="item.beforeData || item.afterData"
          type="button"
          class="log-toggle"
          @click="toggle(item.id)"
        >
          {{ expanded[item.id] ? '收起詳情 ▲' : '查看詳情 ▼' }}
        </button>
        <div v-if="expanded[item.id]" class="log-diff">
          <div class="diff-col">
            <div class="diff-head">改前</div>
            <pre class="diff-pre">{{ prettyJson(item.beforeData) }}</pre>
          </div>
          <div class="diff-col">
            <div class="diff-head">改後</div>
            <pre class="diff-pre">{{ prettyJson(item.afterData) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 分頁 -->
    <div v-if="!loading && total > size" class="pager">
      <button
        type="button"
        class="pager-btn"
        :disabled="page === 0"
        @click="goPrev"
      >← 上一頁</button>
      <span class="pager-text">{{ page + 1 }} / {{ totalPages }}</span>
      <button
        type="button"
        class="pager-btn"
        :disabled="page + 1 >= totalPages"
        @click="goNext"
      >下一頁 →</button>
    </div>
  </div>
</template>

<style scoped>
.audit-page {
  padding: 20px;
  background-color: #0b0d14;
  color: #ffffff;
  min-height: 100%;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

/* === 標題 === */
.audit-head {
  display: flex;
  align-items: center;
  margin-bottom: 18px;
  padding-left: 48px;
  min-height: 42px;
}
.head-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.audit-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #e2e8f0;
  letter-spacing: 0.3px;
  line-height: 1.2;
}
.audit-sub {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.2;
}

/* === Segmented tabs (照搬 PersonalMarket pattern, 含 appearance reset) === */
.seg-tabs {
  display: flex;
  align-items: center;
  height: 48px;
  background-color: #14161f;
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 16px;
  gap: 4px;
  border: 1px solid #24263a;
  box-sizing: border-box;
  overflow: hidden;
}
.seg-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 38px;       /* 48 - 8 padding - 2 border = 38, 完全填滿 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  box-sizing: border-box;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
}
.seg-btn:hover {
  color: #fff;
}
.seg-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}

/* === 篩選列 === */
.filter-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.search-input {
  width: 100%;
  height: 42px;
  padding: 0 16px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.15s;
  box-sizing: border-box;
  line-height: 1;
}
.search-input::placeholder {
  color: #475569;
}
.search-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.action-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.action-tag {
  font-size: 0.82rem;
  padding: 6px 12px;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
  background: #161822;
  color: #94a3b8;
  border: 1px solid #2e3147;
  transition: all 0.15s;
  user-select: none;
  line-height: 1.2;
}
.action-tag:hover {
  background: #1f2233;
  color: #e2e8f0;
}
.action-tag.is-active {
  background: rgba(var(--c-light-rgb), 0.18);
  color: var(--c-light);
  border-color: rgba(var(--c-light-rgb), 0.5);
  font-weight: 700;
}

/* === 列表 === */
.log-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.log-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-radius: 14px;
  padding: 14px 16px;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  border-left-width: 4px;
  box-sizing: border-box;
}
.log-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
.log-card.sev-critical { border-left-color: #e74c3c; }
.log-card.sev-warning  { border-left-color: #f39c12; }
.log-card.sev-info     { border-left-color: #4a90e2; }

.log-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.sev-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  line-height: 1.4;
}
.sev-badge-critical {
  background: rgba(231, 76, 60, 0.18);
  color: #ff7066;
  border: 1px solid rgba(231, 76, 60, 0.4);
}
.sev-badge-warning {
  background: rgba(243, 156, 18, 0.18);
  color: #ffba4d;
  border: 1px solid rgba(243, 156, 18, 0.4);
}
.sev-badge-info {
  background: rgba(74, 144, 226, 0.18);
  color: #6db1ff;
  border: 1px solid rgba(74, 144, 226, 0.4);
}
.action-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: #e2e8f0;
}
.log-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #64748b;
}
.log-summary {
  font-size: 0.92rem;
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 10px;
  white-space: pre-line;
}
.log-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.meta-chip {
  font-size: 0.75rem;
  color: #94a3b8;
  background: #0f111a;
  border: 1px solid #24263a;
  padding: 3px 8px;
  border-radius: 6px;
  line-height: 1.4;
}
.meta-ip {
  color: #64748b;
}
.log-toggle {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.2;
  transition: background 0.15s, color 0.15s;
  appearance: none;
  -webkit-appearance: none;
}
.log-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--c-light);
}
.log-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.diff-col {
  background: #0f111a;
  border: 1px solid #24263a;
  border-radius: 8px;
  padding: 10px;
  overflow: hidden;
}
.diff-head {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 6px;
  letter-spacing: 0.3px;
}
.diff-pre {
  margin: 0;
  font-size: 0.78rem;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.45;
  max-height: 240px;
  overflow: auto;
}

/* === Empty / loading state === */
.state-card {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  font-size: 0.95rem;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 14px;
  border: 1px dashed #2e3147;
}
.state-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.55;
}

/* === 分頁 === */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
.pager-btn {
  height: 36px;
  padding: 0 16px;
  background: #161822;
  border: 1px solid #2e3147;
  color: #cbd5e1;
  font-size: 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pager-btn:hover:not(:disabled) {
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
  border-color: rgba(var(--c-light-rgb), 0.4);
}
.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pager-text {
  font-size: 0.85rem;
  color: #94a3b8;
  min-width: 64px;
  text-align: center;
}

@media (max-width: 768px) {
  .log-diff {
    grid-template-columns: 1fr;
  }
  .seg-btn {
    font-size: 0.78rem;
    padding: 0 6px;
  }
}
</style>
