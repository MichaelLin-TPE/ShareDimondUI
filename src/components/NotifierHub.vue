<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

interface AlertItem {
  id: string
  icon: string
  count: number
  title: string
  bg: string
  onClick: () => void
}

const API = 'https://api.gameshare-system.com'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

let pollTimer: number | null = null

// ===== state =====
const isOpen = ref(false)
const marketCount = ref(0)             // 市場 OPEN 掛單總數 (公會層級)
const myWaitPaySellingCount = ref(0)   // 我的賣單 WAIT_PAY 數 (個人,要去確認付款)
const pendingApplyCount = ref(0)       // 申請加入血盟待審核 (僅會長/幹部看)
const isPulsing = ref(false)
let wsHandle: StompHandle | null = null

// 角色判斷 — 只有 LEADER/OFFICER 才能看到「待審核」提醒
const canApprove = computed(() => {
  const r = authStore.member?.role
  return r === 'LEADER' || r === 'OFFICER'
})

// ===== alerts (未來在這裡加新業務,push 進去就行) =====
const alerts = computed<AlertItem[]>(() => {
  const items: AlertItem[] = []

  // 1. 個人:等我確認付款 (有人買了我的東西) — 優先顯示在最上面 (越高優先級越要先看到)
  if (myWaitPaySellingCount.value > 0) {
    items.push({
      id: 'wait-pay-selling',
      icon: '💰',
      count: myWaitPaySellingCount.value,
      title: `${myWaitPaySellingCount.value} 筆賣單等你確認付款`,
      bg: 'linear-gradient(135deg, #10b981, #059669)',
      onClick: () => {
        router.replace('/clan/marketPlace')
        isOpen.value = false
      },
    })
  }

  // 2. 申請加入血盟待審核 (僅 LEADER / OFFICER)
  if (canApprove.value && pendingApplyCount.value > 0 && !route.path.startsWith('/clan/approvalPage')) {
    items.push({
      id: 'pending-apply',
      icon: '🙋',
      count: pendingApplyCount.value,
      title: `${pendingApplyCount.value} 人申請加入血盟,等你審核`,
      bg: 'linear-gradient(135deg, #a855f7, #7c3aed)',
      onClick: () => {
        router.replace('/clan/approvalPage')
        isOpen.value = false
      },
    })
  }

  // 3. 市場掛單 (在市場頁時不顯示,因為使用者已經看到了)
  if (marketCount.value > 0 && !route.path.startsWith('/clan/marketPlace')) {
    items.push({
      id: 'market',
      icon: '🏪',
      count: marketCount.value,
      title: `${marketCount.value} 件市場掛單,點擊查看`,
      bg: 'linear-gradient(135deg, var(--c-light), var(--c-deep))',
      onClick: () => {
        router.replace('/clan/marketPlace')
        isOpen.value = false
      },
    })
  }

  // 範例 — 未來要新增業務照這個格式 push:
  // if (someCount.value > 0) {
  //   items.push({
  //     id: 'someBusiness',
  //     icon: '🎯',
  //     count: someCount.value,
  //     title: '...',
  //     bg: 'linear-gradient(135deg, #a855f7, #7c3aed)',
  //     onClick: () => router.replace('/clan/...'),
  //   })
  // }

  return items
})

const totalCount = computed(() =>
  alerts.value.reduce((sum, a) => sum + a.count, 0),
)

// ===== fetch =====
const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

const triggerPulse = () => {
  isPulsing.value = true
  window.setTimeout(() => (isPulsing.value = false), 900)
}

const fetchMarketCount = async () => {
  if (!authStore.authToken) return
  try {
    const res = await fetch(`${API}/personal-listing/list`, { headers: headers() })
    if (!res.ok) return
    const data = await res.json()
    const newCount = Array.isArray(data) ? data.length : 0
    if (newCount > marketCount.value) triggerPulse()
    marketCount.value = newCount
  } catch {
    /* ignore */
  }
}

const fetchMyWaitPaySelling = async () => {
  if (!authStore.authToken) return
  try {
    const res = await fetch(`${API}/personal-listing/my-listings`, { headers: headers() })
    if (!res.ok) return
    const data = await res.json()
    const newCount = Array.isArray(data)
      ? data.filter((l: { status?: string }) => l.status === 'WAIT_PAY').length
      : 0
    if (newCount > myWaitPaySellingCount.value) triggerPulse()
    myWaitPaySellingCount.value = newCount
  } catch {
    /* ignore */
  }
}

const fetchPendingApply = async () => {
  if (!authStore.authToken) return
  if (!canApprove.value) {
    pendingApplyCount.value = 0
    return
  }
  try {
    const res = await fetch(`${API}/getVerifyList`, { headers: headers() })
    if (!res.ok) return
    const data = await res.json()
    const newCount = Array.isArray(data) ? data.length : 0
    if (newCount > pendingApplyCount.value) triggerPulse()
    pendingApplyCount.value = newCount
  } catch {
    /* ignore */
  }
}

const refreshAll = () => {
  fetchMarketCount()
  fetchMyWaitPaySelling()
  fetchPendingApply()
}

// ===== UI actions =====
const toggleOpen = () => {
  isOpen.value = !isOpen.value
}

const closeOnOutside = (e: MouseEvent) => {
  if (!isOpen.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.notifier-hub')) {
    isOpen.value = false
  }
}

// 切頁時自動收起
watch(
  () => route.path,
  () => {
    isOpen.value = false
  },
)

// ===== lifecycle =====
onMounted(() => {
  refreshAll()
  document.addEventListener('mousedown', closeOnOutside)
  const clanId = authStore.member?.clanId
  if (clanId) {
    wsHandle = createReconnectingStomp(`/topic/listing/${clanId}`, () => {
      refreshAll()
    })
  }
  // 申請審核沒有 WebSocket → 每 60 秒輪詢一次
  pollTimer = window.setInterval(() => {
    fetchPendingApply()
  }, 60_000)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', closeOnOutside)
  wsHandle?.disconnect()
  wsHandle = null
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="notifier-hub">
    <!-- 展開的 mini icon 堆疊 -->
    <div class="hub-stack" :class="{ 'is-open': isOpen && alerts.length > 0 }">
      <button
        v-for="(a, i) in alerts"
        :key="a.id"
        type="button"
        class="hub-item"
        :style="{
          background: a.bg,
          transitionDelay: isOpen ? `${i * 60}ms` : '0ms',
        }"
        :title="a.title"
        @click="a.onClick"
      >
        <span class="item-icon">{{ a.icon }}</span>
        <span class="item-badge">{{ a.count > 99 ? '99+' : a.count }}</span>
      </button>

      <!-- 沒提醒時開啟會看到 -->
      <div v-if="isOpen && alerts.length === 0" class="hub-empty">
        目前沒有任何提醒
      </div>
    </div>

    <!-- 主 FAB -->
    <button
      type="button"
      class="hub-main"
      :class="{ open: isOpen, pulse: isPulsing && !isOpen }"
      :title="totalCount > 0 ? `${totalCount} 個提醒` : '通知中心'"
      @click="toggleOpen"
    >
      <span class="main-icon">{{ isOpen ? '✕' : '🔔' }}</span>
      <span v-if="!isOpen && totalCount > 0" class="main-badge">
        {{ totalCount > 99 ? '99+' : totalCount }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.notifier-hub {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1020;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

/* ===== Main FAB ===== */
.hub-main {
  pointer-events: auto;
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow:
    0 6px 18px rgba(var(--c-light-rgb), 0.45),
    0 2px 6px rgba(0, 0, 0, 0.4);
  transition:
    transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28),
    box-shadow 0.22s,
    background 0.22s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  position: relative;
}
.hub-main:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow:
    0 10px 26px rgba(var(--c-light-rgb), 0.55),
    0 3px 8px rgba(0, 0, 0, 0.5);
}
.hub-main:active {
  transform: translateY(0) scale(0.96);
}
.hub-main.open {
  background: linear-gradient(135deg, #475569, #334155);
  transform: rotate(90deg);
}
.hub-main.open:hover {
  transform: rotate(90deg) scale(1.05);
}

.main-icon {
  font-size: 1.5rem;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.main-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  border: 2px solid #14171f;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.5);
  box-sizing: border-box;
}

/* 收到新提醒 pulse */
.hub-main.pulse {
  animation: hub-pulse 0.9s ease-out 1;
}
@keyframes hub-pulse {
  0% {
    box-shadow:
      0 6px 18px rgba(var(--c-light-rgb), 0.45),
      0 2px 6px rgba(0, 0, 0, 0.4),
      0 0 0 0 rgba(var(--c-light-rgb), 0.6);
  }
  60% {
    box-shadow:
      0 6px 18px rgba(var(--c-light-rgb), 0.45),
      0 2px 6px rgba(0, 0, 0, 0.4),
      0 0 0 16px rgba(var(--c-light-rgb), 0);
  }
  100% {
    box-shadow:
      0 6px 18px rgba(var(--c-light-rgb), 0.45),
      0 2px 6px rgba(0, 0, 0, 0.4);
  }
}

/* ===== Stack of items ===== */
.hub-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

.hub-item {
  pointer-events: auto;
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.4),
    0 1px 4px rgba(0, 0, 0, 0.3);
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  position: relative;

  /* 收起狀態 */
  opacity: 0;
  transform: translateY(20px) scale(0.6);
  transition:
    opacity 0.25s ease,
    transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
.hub-stack.is-open .hub-item {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.hub-item:hover {
  transform: translateY(-2px) scale(1.08);
}

.item-icon {
  font-size: 1.4rem;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.item-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: var(--c-on);
  border: 2px solid #14171f;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1;
  box-sizing: border-box;
}

/* 沒提醒時的小卡片 */
.hub-empty {
  pointer-events: auto;
  padding: 10px 16px;
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #2e3147;
  border-radius: 999px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  animation: empty-pop 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}
@keyframes empty-pop {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 480px) {
  .notifier-hub {
    bottom: 16px;
    right: 16px;
  }
  .hub-main {
    width: 50px;
    height: 50px;
  }
  .hub-item {
    width: 44px;
    height: 44px;
  }
}
</style>
