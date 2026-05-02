<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useAlert } from '@/utils/alerts.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

const API = 'https://api.gameshare-system.com'
const authStore = useAuthStore()

interface BossTimer {
  timerId: string
  bossName: string
  respawnIntervalMinutes: number
  status: 'ALIVE' | 'DEAD' | 'UNKNOWN'
  lastDeathTime: string | null
  nextRespawnTime: string | null
  minutesUntilRespawn: number | null
}

const bossList = ref<BossTimer[]>([])
const loading = ref(false)

const showAddModal = ref(false)
const showDeathModal = ref(false)
const showEditRespawnModal = ref(false)
const showEditModal = ref(false)

const addForm = ref({ bossName: '', respawnIntervalMinutes: 180 })
const deathForm = ref({ timerId: '', deathTime: '' })
const editRespawnForm = ref({ timerId: '', nextRespawnTime: '' })
const editForm = ref({ timerId: '', bossName: '', respawnIntervalMinutes: 0 })
const selectedBoss = ref<BossTimer | null>(null)

const sortedBossList = computed(() => {
  // 排序：
  // 1. ALIVE 存活中（優先顯示，依名稱排）
  // 2. DEAD 且有倒數的依 minutesUntilRespawn 由小到大（最快出的在前）
  // 3. UNKNOWN / 無倒數的放最後（依名稱排）
  const priority = (b: BossTimer) => {
    if (b.status === 'ALIVE') return 0
    if (b.status === 'DEAD' && b.minutesUntilRespawn !== null) return 1
    return 2
  }

  return [...bossList.value].sort((a, b) => {
    const pa = priority(a)
    const pb = priority(b)
    if (pa !== pb) return pa - pb
    if (pa === 1) return (a.minutesUntilRespawn ?? 0) - (b.minutesUntilRespawn ?? 0)
    return a.bossName.localeCompare(b.bossName)
  })
})

const statsTotal = computed(() => bossList.value.length)
const statsAlive = computed(() => bossList.value.filter((b) => b.status === 'ALIVE').length)
const statsDead = computed(() => bossList.value.filter((b) => b.status === 'DEAD').length)
const statsUpcoming = computed(
  () =>
    bossList.value.filter(
      (b) =>
        b.status === 'DEAD' && b.minutesUntilRespawn !== null && b.minutesUntilRespawn <= 5,
    ).length,
)

const makeHeaders = (ts: string) => ({
  Authorization: `Bearer ${authStore.authToken}`,
  'Content-Type': 'application/json',
  Sign: generateSignature(ts),
  TimeStamp: ts,
})

const fetchBossList = async () => {
  loading.value = true
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(`${API}/boss-timer/list`, {
      method: 'GET',
      headers: makeHeaders(ts),
    })
    if (!res.ok) throw new Error()
    bossList.value = await res.json()
  } catch {
    useAlert.error('載入首領列表失敗')
  } finally {
    loading.value = false
  }
}

const addBoss = async () => {
  if (!addForm.value.bossName.trim()) return useAlert.error('請輸入首領名稱')
  if (addForm.value.respawnIntervalMinutes <= 0) return useAlert.error('重生間隔必須大於 0 分鐘')
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(`${API}/boss-timer/add`, {
      method: 'POST',
      headers: makeHeaders(ts),
      body: JSON.stringify(addForm.value),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    useAlert.success(data.message)
    showAddModal.value = false
    addForm.value = { bossName: '', respawnIntervalMinutes: 180 }
    await fetchBossList()
  } catch (e: any) {
    useAlert.error(e.message || '新增失敗')
  }
}

const openDeathModal = (boss: BossTimer) => {
  selectedBoss.value = boss
  deathForm.value = { timerId: boss.timerId, deathTime: '' }
  showDeathModal.value = true
}

const reportDeath = async () => {
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const body: Record<string, string> = { timerId: deathForm.value.timerId }
    if (deathForm.value.deathTime) {
      body.deathTime = deathForm.value.deathTime.replace('T', ' ') + ':00'
    }
    const res = await fetch(`${API}/boss-timer/death`, {
      method: 'POST',
      headers: makeHeaders(ts),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    useAlert.success(data.message)
    showDeathModal.value = false
    await fetchBossList()
  } catch (e: any) {
    useAlert.error(e.message || '回報失敗')
  }
}

const openEditRespawnModal = (boss: BossTimer) => {
  selectedBoss.value = boss
  editRespawnForm.value = { timerId: boss.timerId, nextRespawnTime: '' }
  showEditRespawnModal.value = true
}

const editRespawnTime = async () => {
  if (!editRespawnForm.value.nextRespawnTime) return useAlert.error('請選擇重生時間')
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(`${API}/boss-timer/edit-respawn`, {
      method: 'POST',
      headers: makeHeaders(ts),
      body: JSON.stringify({
        timerId: editRespawnForm.value.timerId,
        nextRespawnTime: editRespawnForm.value.nextRespawnTime.replace('T', ' ') + ':00',
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    useAlert.success(data.message)
    showEditRespawnModal.value = false
    await fetchBossList()
  } catch (e: any) {
    useAlert.error(e.message || '更新失敗')
  }
}

const openEditModal = (boss: BossTimer) => {
  selectedBoss.value = boss
  editForm.value = {
    timerId: boss.timerId,
    bossName: boss.bossName,
    respawnIntervalMinutes: boss.respawnIntervalMinutes,
  }
  showEditModal.value = true
}

const editBoss = async () => {
  if (!editForm.value.bossName.trim()) return useAlert.error('首領名稱不可為空')
  if (editForm.value.respawnIntervalMinutes <= 0) return useAlert.error('重生間隔必須大於 0 分鐘')
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(`${API}/boss-timer/edit`, {
      method: 'POST',
      headers: makeHeaders(ts),
      body: JSON.stringify(editForm.value),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    useAlert.success(data.message)
    showEditModal.value = false
    await fetchBossList()
  } catch (e: any) {
    useAlert.error(e.message || '編輯失敗')
  }
}

const statusLabel = (status: string) => ({ ALIVE: '存活', DEAD: '已死亡', UNKNOWN: '未知' }[status] ?? status)
const intervalLabel = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} 分鐘`
  if (m === 0) return `${h} 小時`
  return `${h} 小時 ${m} 分鐘`
}
const countdownLabel = (mins: number | null) => {
  if (mins === null) return null
  if (mins <= 0) return '即將重生！'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} 分鐘後重生`
  if (m === 0) return `${h} 小時後重生`
  return `${h} 小時 ${m} 分後重生`
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
let wsHandle: StompHandle | null = null

onMounted(async () => {
  await fetchBossList()
  const clanId = authStore?.member?.clanId
  if (clanId) {
    wsHandle = createReconnectingStomp(`/topic/bossTimer/${clanId}`, () => {
      fetchBossList()
    })
  }
  refreshTimer = setInterval(fetchBossList, 30000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  wsHandle?.disconnect()
  wsHandle = null
})
</script>

<template>
  <div class="boss-page">
    <!-- ─── Header ─────────────────────────────────── -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon">⚔️</div>
        <div>
          <h1 class="page-title">首領重生追蹤</h1>
          <p class="page-sub">管理公會首領的死亡與重生計時</p>
        </div>
      </div>
      <button class="btn-add" @click="showAddModal = true">+ 新增首領</button>
    </div>

    <!-- ─── Stats ──────────────────────────────────── -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-num">{{ statsTotal }}</div>
        <div class="stat-label">全部首領</div>
      </div>
      <div class="stat-card alive">
        <div class="stat-icon">💚</div>
        <div class="stat-num">{{ statsAlive }}</div>
        <div class="stat-label">存活中</div>
      </div>
      <div class="stat-card dead">
        <div class="stat-icon">💀</div>
        <div class="stat-num">{{ statsDead }}</div>
        <div class="stat-label">已死亡</div>
      </div>
      <div class="stat-card upcoming" :class="{ pulse: statsUpcoming > 0 }">
        <div class="stat-icon">⚡</div>
        <div class="stat-num">{{ statsUpcoming }}</div>
        <div class="stat-label">5分鐘內重生</div>
      </div>
    </div>

    <!-- ─── Boss List ───────────────────────────────── -->
    <div v-if="loading && bossList.length === 0" class="empty-state">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>

    <div v-else-if="bossList.length === 0" class="empty-state">
      <div class="empty-icon">🏔️</div>
      <p>尚未設定任何首領</p>
      <button class="btn-add" @click="showAddModal = true">新增第一隻首領</button>
    </div>

    <div v-else class="boss-grid">
      <div
        v-for="boss in sortedBossList"
        :key="boss.timerId"
        class="boss-card"
        :class="boss.status.toLowerCase()"
      >
        <!-- 頂部色條 -->
        <div class="card-top-bar"></div>

        <!-- 名稱 + 狀態 -->
        <div class="card-head">
          <span class="boss-icon">
            {{ boss.status === 'ALIVE' ? '🟢' : boss.status === 'DEAD' ? '💀' : '❓' }}
          </span>
          <span class="boss-name">{{ boss.bossName }}</span>
          <span class="status-badge" :class="boss.status.toLowerCase()">
            {{ statusLabel(boss.status) }}
          </span>
        </div>

        <!-- 資訊區 -->
        <div class="card-info">
          <div class="info-row">
            <span class="info-label">⏰</span>
            <span class="info-val">{{ intervalLabel(boss.respawnIntervalMinutes) }}</span>
          </div>
          <div v-if="boss.nextRespawnTime" class="info-row">
            <span class="info-label">🔄</span>
            <span class="info-val respawn-time">{{ boss.nextRespawnTime }}</span>
          </div>
          <div
            v-if="boss.status === 'DEAD' && boss.minutesUntilRespawn !== null"
            class="countdown"
            :class="{ urgent: boss.minutesUntilRespawn <= 5 }"
          >
            ⏱ {{ countdownLabel(boss.minutesUntilRespawn) }}
          </div>
          <div v-if="boss.status === 'ALIVE' || boss.status === 'UNKNOWN'" class="no-timer">
            — 尚未回報死亡 —
          </div>
        </div>

        <!-- 操作按鈕 -->
        <div class="card-actions">
          <button class="btn-action btn-death" @click="openDeathModal(boss)" title="回報死亡">☠️</button>
          <button class="btn-action btn-respawn" @click="openEditRespawnModal(boss)" title="調整重生時間">🔄</button>
          <button class="btn-action btn-edit" @click="openEditModal(boss)" title="編輯首領">✏️</button>
        </div>
      </div>
    </div>

    <!-- ─── Modal: 新增首領 ─────────────────────────── -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-bar"></div>
        <div class="modal-icon-lg">⚔️</div>
        <h3 class="modal-title">新增首領</h3>

        <div class="form-group">
          <label>首領名稱</label>
          <input v-model="addForm.bossName" type="text" placeholder="例如：惡魔之王" class="form-input" />
        </div>
        <div class="form-group">
          <label>固定重生時間（分鐘）</label>
          <input v-model.number="addForm.respawnIntervalMinutes" type="number" min="1" class="form-input" />
          <span class="form-hint">
            {{ addForm.respawnIntervalMinutes > 0 ? intervalLabel(addForm.respawnIntervalMinutes) : '' }}
          </span>
        </div>

        <div class="modal-actions">
          <button class="btn-modal btn-cancel" @click="showAddModal = false">取消</button>
          <button class="btn-modal btn-confirm" @click="addBoss">新增</button>
        </div>
      </div>
    </div>

    <!-- ─── Modal: 回報死亡 ─────────────────────────── -->
    <div v-if="showDeathModal" class="modal-overlay" @click.self="showDeathModal = false">
      <div class="modal">
        <div class="modal-bar red"></div>
        <div class="modal-icon-lg">💀</div>
        <h3 class="modal-title">回報首領死亡</h3>
        <p class="modal-sub">{{ selectedBoss?.bossName }}</p>

        <div class="form-group">
          <label>死亡時間（可留空，預設為當下）</label>
          <input v-model="deathForm.deathTime" type="datetime-local" class="form-input" />
        </div>

        <div class="form-hint-block">
          系統將自動計算下次重生時間：<br />
          死亡時間 + {{ selectedBoss ? intervalLabel(selectedBoss.respawnIntervalMinutes) : '' }}
        </div>

        <div class="modal-actions">
          <button class="btn-modal btn-cancel" @click="showDeathModal = false">取消</button>
          <button class="btn-modal btn-death-confirm" @click="reportDeath">確認回報</button>
        </div>
      </div>
    </div>

    <!-- ─── Modal: 調整重生時間 ─────────────────────── -->
    <div v-if="showEditRespawnModal" class="modal-overlay" @click.self="showEditRespawnModal = false">
      <div class="modal">
        <div class="modal-bar cyan"></div>
        <div class="modal-icon-lg">🔄</div>
        <h3 class="modal-title">手動調整重生時間</h3>
        <p class="modal-sub">{{ selectedBoss?.bossName }}</p>

        <div class="form-group">
          <label>下次重生時間</label>
          <input v-model="editRespawnForm.nextRespawnTime" type="datetime-local" class="form-input" />
        </div>

        <div class="modal-actions">
          <button class="btn-modal btn-cancel" @click="showEditRespawnModal = false">取消</button>
          <button class="btn-modal btn-confirm" @click="editRespawnTime">儲存</button>
        </div>
      </div>
    </div>

    <!-- ─── Modal: 編輯首領 ─────────────────────────── -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal">
        <div class="modal-bar"></div>
        <div class="modal-icon-lg">✏️</div>
        <h3 class="modal-title">編輯首領資訊</h3>

        <div class="form-group">
          <label>首領名稱</label>
          <input v-model="editForm.bossName" type="text" class="form-input" />
        </div>
        <div class="form-group">
          <label>固定重生時間（分鐘）</label>
          <input v-model.number="editForm.respawnIntervalMinutes" type="number" min="1" class="form-input" />
          <span class="form-hint">
            {{ editForm.respawnIntervalMinutes > 0 ? intervalLabel(editForm.respawnIntervalMinutes) : '' }}
          </span>
        </div>

        <div class="modal-actions">
          <button class="btn-modal btn-cancel" @click="showEditModal = false">取消</button>
          <button class="btn-modal btn-confirm" @click="editBoss">儲存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes popIn {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes urgentPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

/* ─── Page ─────────────────────────────────────── */
.boss-page {
  padding: 24px;
  color: #e2e8f0;
  min-height: 100vh;
}

/* ─── Header ────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.header-icon {
  font-size: 2.2rem;
  filter: drop-shadow(0 0 8px rgba(245, 196, 81, 0.6));
}
.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: #ffd166;
  text-shadow:
    0 0 8px rgba(245, 196, 81, 0.45),
    0 2px 12px rgba(245, 158, 11, 0.2);
}
.page-sub {
  font-size: 0.78rem;
  color: #64748b;
  margin: 2px 0 0;
}
.btn-add {
  padding: 10px 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0f111a;
  font-weight: 800;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
}
.btn-add:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
}

/* ─── Stats ─────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
.stat-card {
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 18px 16px;
  text-align: center;
  backdrop-filter: blur(8px);
  transition: transform 0.2s;
}
.stat-card:hover { transform: translateY(-2px); }
.stat-icon { font-size: 1.4rem; margin-bottom: 8px; }
.stat-num {
  font-size: 2rem;
  font-weight: 800;
  color: #e2e8f0;
  line-height: 1;
  margin-bottom: 4px;
}
.stat-label { font-size: 0.78rem; color: #64748b; }

.stat-card.alive   { border-color: rgba(16, 185, 129, 0.25); }
.stat-card.alive .stat-num { color: #34d399; }
.stat-card.dead    { border-color: rgba(239, 68, 68, 0.25); }
.stat-card.dead .stat-num  { color: #f87171; }
.stat-card.upcoming { border-color: rgba(245, 158, 11, 0.25); }
.stat-card.upcoming .stat-num { color: #ffd166; }
.stat-card.upcoming.pulse { animation: pulse 2s infinite; }

/* ─── Empty ─────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 60px 24px;
  color: #475569;
}
.empty-icon { font-size: 4rem; margin-bottom: 16px; }
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(245, 196, 81, 0.2);
  border-top-color: #ffd166;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 0.8s linear infinite;
}

/* ─── Boss Grid ──────────────────────────────────── */
.boss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.boss-card {
  position: relative;
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(8px);
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s;
}
.boss-card:hover {
  border-color: rgba(245, 196, 81, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.boss-card.alive  { border-color: rgba(16,185,129,0.2); }
.boss-card.dead   { border-color: rgba(239,68,68,0.25); }
.boss-card.unknown { border-color: rgba(100,116,139,0.2); }

/* 頂部色條 */
.card-top-bar {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 3px;
}
.boss-card.alive   .card-top-bar { background: linear-gradient(90deg, #10b981, #34d399); }
.boss-card.dead    .card-top-bar { background: linear-gradient(90deg, #ef4444, #f87171); }
.boss-card.unknown .card-top-bar { background: linear-gradient(90deg, #475569, #64748b); }

/* 名稱列 */
.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
}
.boss-icon { font-size: 0.95rem; flex-shrink: 0; }
.boss-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-badge {
  padding: 2px 7px;
  border-radius: 20px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}
.status-badge.alive   { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
.status-badge.dead    { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.status-badge.unknown { background: rgba(100,116,139,0.15); color: #94a3b8; border: 1px solid rgba(100,116,139,0.3); }

/* 資訊區 */
.card-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
}
.info-label {
  font-size: 0.8rem;
  flex-shrink: 0;
}
.info-val {
  color: #cbd5e1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info-val.respawn-time {
  color: #ffd166;
  font-weight: 700;
  font-size: 0.8rem;
}
.no-timer {
  font-size: 0.72rem;
  color: #475569;
  text-align: center;
  font-style: italic;
  padding: 4px 0;
}

/* 倒數 */
.countdown {
  margin-top: 2px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  font-size: 0.75rem;
  font-weight: 700;
  color: #f87171;
  text-align: center;
}
.countdown.urgent {
  background: rgba(239,68,68,0.22);
  border-color: rgba(239,68,68,0.5);
  color: #fca5a5;
  animation: urgentPulse 1s ease-in-out infinite;
}

/* 操作按鈕 */
.card-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 2px;
}
.btn-action {
  padding: 6px 0;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn-death {
  background: rgba(239,68,68,0.12);
  border: 1px solid rgba(239,68,68,0.3);
}
.btn-death:hover { background: rgba(239,68,68,0.3); transform: translateY(-1px); }
.btn-respawn {
  background: rgba(245, 196, 81, 0.12);
  border: 1px solid rgba(245, 196, 81, 0.3);
}
.btn-respawn:hover { background: rgba(245, 196, 81, 0.25); transform: translateY(-1px); }
.btn-edit {
  background: rgba(100,116,139,0.12);
  border: 1px solid rgba(100,116,139,0.3);
}
.btn-edit:hover { background: rgba(100,116,139,0.3); transform: translateY(-1px); }

/* ─── Modal ─────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 16px;
}
.modal {
  background: #1e1e2e;
  border: 1px solid #334155;
  border-radius: 18px;
  padding: 36px 28px 28px;
  width: 100%;
  max-width: 420px;
  position: relative;
  overflow: hidden;
  animation: popIn 0.28s ease-out;
}
.modal-bar {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 5px;
  background: linear-gradient(90deg, #ffd166, #f59e0b);
}
.modal-bar.red  { background: linear-gradient(90deg, #ef4444, #f97316); }
.modal-bar.cyan { background: linear-gradient(90deg, #ffd166, #f59e0b); }
.modal-icon-lg {
  font-size: 2.8rem;
  text-align: center;
  margin-bottom: 12px;
}
.modal-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #e2e8f0;
  text-align: center;
  margin: 0 0 4px;
}
.modal-sub {
  font-size: 0.85rem;
  color: #ffd166;
  text-align: center;
  margin: 0 0 20px;
  font-weight: 600;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #e2e8f0;
  margin-bottom: 6px;
  font-weight: 600;
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  background: #0f111a;
  border: 1px solid #2e3147;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  transition: all 0.15s;
}
.form-input:focus {
  border-color: #ffd166;
  box-shadow: 0 0 0 3px rgba(245, 196, 81, 0.15);
}
.form-input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
}
.form-hint {
  display: block;
  font-size: 0.78rem;
  color: #ffd166;
  margin-top: 4px;
  font-weight: 600;
}
.form-hint-block {
  font-size: 0.85rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 20px;
  line-height: 1.6;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.btn-modal {
  flex: 1;
  padding: 12px 0;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-cancel {
  background: #1e2233;
  color: #e2e8f0;
  border: 1px solid #3a3f5c;
}
.btn-cancel:hover { background: #2a2f44; color: #fff; border-color: #555a78; }
.btn-confirm {
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0f111a;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.3);
}
.btn-confirm:hover { filter: brightness(1.08); transform: translateY(-1px); }
.btn-death-confirm {
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: #fff;
  box-shadow: 0 4px 14px rgba(239,68,68,0.3);
}
.btn-death-confirm:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* ─── RWD ────────────────────────────────────────── */
@media (max-width: 768px) {
  .boss-page { padding: 16px 12px; }
  .page-header { margin-left: 48px; gap: 12px; }
  .page-title { font-size: 1.25rem; }
  .stats-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-num { font-size: 1.6rem; }
  .boss-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .boss-card { padding: 12px 12px 10px; }
}
@media (max-width: 480px) {
  .boss-grid { grid-template-columns: repeat(2, 1fr); }
  .boss-name { font-size: 0.85rem; }
  .status-badge { display: none; }
}
</style>
