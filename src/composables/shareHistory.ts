import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'

// ===== 角色狀態定義（與後端 enum 對齊） =====
export type EventRole =
  | 'OPEN_TICKET'
  | 'DELETE_TICKET'
  | 'BIDDING'
  | 'WAIT_PAY'
  | 'COMPLETE_SHARE'
  | 'JOIN_SHARE'
  | 'CREATE_ITEM'
  |'UPDATE_REMARK'
  |'UPDATE_CLAN_BALANCE'

// ===== 顯示用中文名稱 =====
export const roleTextMap: Record<EventRole, string> = {
  OPEN_TICKET: '開啟戰利品單',
  DELETE_TICKET: '撤銷戰利品單',
  BIDDING: '競標進行中',
  WAIT_PAY: '等待結算',
  COMPLETE_SHARE: '分配完成',
  JOIN_SHARE: '加入分寶',
  CREATE_ITEM: '建立戰利品',
  UPDATE_REMARK: '更新備註',
  UPDATE_CLAN_BALANCE:'調整公積金',
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

    const res = await fetch('https://api.gameshare-system.com/getHistory', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })

    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      return
    }

    auctions.value = data as ShareResponse[]
  }

  onMounted(() => {
    getShareHistory()
  })

  // 👈 新增：當前選中的狀態 (null 代表全部)
  const selectedStatus = ref<string | null>(null)

  const sortedAuctions = computed(() => {
    return [...auctions.value].sort((a, b) => {
      return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    })
  })

  // 1. 搜尋文字與狀態的響應式變數
  const searchQuery = ref('')

  // 2. 核心過濾邏輯：同時處理狀態與全域文字搜尋
  const filteredAuctions = computed(() => {
    return [...auctions.value]
      .filter((item) => {
        // A. 狀態檢查：若沒選狀態則 pass，有選則必須符合
        const matchStatus = !selectedStatus.value || item.role === selectedStatus.value

        // B. 文字檢查：若沒輸入則 pass，有輸入則檢查 eventContent 是否包含該字串
        const matchText =
          !searchQuery.value ||
          item.eventContent.toLowerCase().includes(searchQuery.value.toLowerCase())

        return matchStatus && matchText
      })
      .sort((a, b) => {
        return new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      })
  })

  const toggleStatus = (status: string) => {
    selectedStatus.value = selectedStatus.value === status ? null : status
  }

  return {
    searchQuery,
    selectedStatus,
    toggleStatus,
    filteredAuctions,
    auctions,
    roleTextMap,
    formatEventTime,
    sortedAuctions,
  }
}
