import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

/**
 * 站內通知 — 對齊後端 NotificationController 的 NotificationListResponse
 *
 * 用法 (singleton style — 全 app 共用一份,WS push 進來大家同步):
 *   const { items, unreadCount, markRead, markAllRead } = useNotifications()
 *
 * - 進 mount 自動 fetch + 訂閱 WS /topic/notification/{clanId}
 * - WS 推 'NOTIF_UPDATED' 自動 refetch
 * - markRead / markAllRead 操作後 refetch
 */

const API = 'https://api.gameshare-system.com'

export interface NotificationItem {
  id: number
  type: string
  icon: string | null
  title: string | null
  content: string | null
  targetUrl: string | null
  isRead: boolean
  createTime: string | null
}

interface NotificationListResponse {
  unreadCount: number
  items: NotificationItem[]
}

// === 模組級 state (singleton across components) ===
const items = ref<NotificationItem[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const drawerOpen = ref(false)  // 通知抽屜開關 — 任何 component 都可以開 (NotifierHub / Dashboard 鈴鐺)
let wsHandle: StompHandle | null = null
let subscriberCount = 0

const headers = () => {
  const authStore = useAuthStore()
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    Timestamp: ts,
  }
}

const fetchAll = async () => {
  const authStore = useAuthStore()
  if (!authStore.authToken) return
  loading.value = true
  try {
    const res = await fetch(`${API}/notifications`, { method: 'GET', headers: headers() })
    if (!res.ok) return
    const data = (await res.json()) as NotificationListResponse
    items.value = data.items ?? []
    unreadCount.value = data.unreadCount ?? 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const markRead = async (id: number) => {
  // 樂觀更新
  const target = items.value.find((n) => n.id === id)
  if (target && !target.isRead) {
    target.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  try {
    await fetch(`${API}/notifications/${id}/read`, { method: 'POST', headers: headers() })
  } catch (e) {
    console.error(e)
  }
}

const markAllRead = async () => {
  // 樂觀更新
  for (const n of items.value) n.isRead = true
  unreadCount.value = 0
  try {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: headers() })
  } catch (e) {
    console.error(e)
  }
}

/** 登出 / 換血盟時呼叫 (utils/session.ts 會用) */
export function resetNotifications() {
  items.value = []
  unreadCount.value = 0
  if (wsHandle) {
    wsHandle.disconnect()
    wsHandle = null
  }
  subscriberCount = 0
}

export function useNotifications() {
  onMounted(() => {
    subscriberCount++
    if (subscriberCount === 1) {
      // 第一個訂閱者觸發 fetch + WS subscribe
      fetchAll()
      const authStore = useAuthStore()
      const clanId = authStore.member?.clanId
      if (clanId && !wsHandle) {
        wsHandle = createReconnectingStomp(`/topic/notification/${clanId}`, () => {
          fetchAll()
        })
      }
    }
  })

  onUnmounted(() => {
    subscriberCount = Math.max(0, subscriberCount - 1)
    if (subscriberCount === 0 && wsHandle) {
      wsHandle.disconnect()
      wsHandle = null
    }
  })

  // 最近 5 條 — 給 Dashboard 動態 card 用
  const recentItems = computed(() => items.value.slice(0, 5))

  return {
    items,
    recentItems,
    unreadCount,
    loading,
    drawerOpen,
    markRead,
    markAllRead,
    refresh: fetchAll,
    openDrawer: () => { drawerOpen.value = true },
    closeDrawer: () => { drawerOpen.value = false },
  }
}

/** 把 ISO 時間轉成相對時間 (剛剛 / 5 分鐘前 / 2 小時前 / 3 天前 / MM/DD) */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '剛剛'
  if (diffMin < 60) return `${diffMin} 分鐘前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小時前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  return `${M}/${D}`
}
