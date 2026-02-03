import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// ===== 角色狀態定義（與後端 enum 對齊） =====
export type EventRole =
  | 'OPEN_TICKET'
  | 'DELETE_TICKET'
  | 'BIDDING'
  | 'WAIT_PAY'
  | 'COMPLETE_SHARE'
  | 'JOIN_SHARE'
  | 'CREATE_ITEM'

// ===== 顯示用中文名稱 =====
export const roleTextMap: Record<EventRole, string> = {
  OPEN_TICKET: '開啟戰利品單',
  DELETE_TICKET: '撤銷戰利品單',
  BIDDING: '競標進行中',
  WAIT_PAY: '等待結算',
  COMPLETE_SHARE: '分配完成',
  JOIN_SHARE: '加入分寶',
  CREATE_ITEM: '建立戰利品',
}

// ===== API 回傳結構 =====
export interface ShareResponse {
  eventContent: string
  createTime: string
  role: EventRole
}

// ===== 時間格式化 =====
export function formatEventTime(iso: string): string {
  const date = new Date(iso)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}`
}

export function useAuction() {
  const auctions = ref<ShareResponse[]>([])
  const authStore = useAuthStore()

  const getShareHistory = async () => {
    if (!authStore.authToken) return

    const res = await fetch('https://gameshare-system.com/getHistory', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })



    const data = await res.json()
    if (!res.ok) {
      alert(data.message)
      return
    }

    auctions.value = data as ShareResponse[]
  }

  onMounted(() => {
    getShareHistory()
  })

  return {
    auctions,
    roleTextMap,
    formatEventTime,
  }
}
