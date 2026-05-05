import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'

/**
 * 共享 list 快取 — 避免 /members、/getTreasureList、/getBossList 在多個 composable 重複 fetch。
 *
 * 規則:
 *  - 各 composable 用 loadXxx() 取資料 (已快取就跳過 fetch,in-flight 會去重)
 *  - mutation 後 (新增/刪除/改) 用 refreshXxx() 強制重抓
 *  - store 只存 raw 資料,各 composable 自己 clone + 變形 (避免汙染快取)
 */

const API = 'https://api.gameshare-system.com'

interface MemberRaw {
  memberId: number
  memberName: string
  memberRole: string
  memberAmount?: number
}
interface TreasureItemRaw {
  itemName: string
  itemId: string
}
interface BossRaw {
  bossName: string
  bossId: string
}

export const useSharedListsStore = defineStore('sharedLists', () => {
  const members = ref<MemberRaw[]>([])
  const treasureList = ref<TreasureItemRaw[]>([])
  const bossList = ref<BossRaw[]>([])

  let membersLoaded = false
  let treasureLoaded = false
  let bossLoaded = false

  let membersInFlight: Promise<void> | null = null
  let treasureInFlight: Promise<void> | null = null
  let bossInFlight: Promise<void> | null = null

  const buildHeaders = (contentType = false) => {
    const authStore = useAuthStore()
    const ts = Math.floor(Date.now() / 1000).toString()
    const h: Record<string, string> = {
      Authorization: `Bearer ${authStore.authToken}`,
      Sign: generateSignature(ts),
      TimeStamp: ts,
    }
    if (contentType) h['Content-Type'] = 'application/json'
    return h
  }

  // -------- members --------
  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API}/members`, { method: 'GET', headers: buildHeaders(true) })
      if (!res.ok) return
      members.value = await res.json()
      membersLoaded = true
    } catch (e) {
      console.error(e)
    }
  }
  const loadMembers = (): Promise<void> => {
    if (membersLoaded) return Promise.resolve()
    if (membersInFlight) return membersInFlight
    membersInFlight = fetchMembers().finally(() => {
      membersInFlight = null
    })
    return membersInFlight
  }
  const refreshMembers = (): Promise<void> => {
    membersLoaded = false
    membersInFlight = null
    return loadMembers()
  }

  // -------- treasure list --------
  const fetchTreasureList = async () => {
    try {
      const res = await fetch(`${API}/getTreasureList`, {
        method: 'GET',
        headers: buildHeaders(),
      })
      if (!res.ok) return
      treasureList.value = await res.json()
      treasureLoaded = true
    } catch (e) {
      console.error(e)
    }
  }
  const loadTreasureList = (): Promise<void> => {
    if (treasureLoaded) return Promise.resolve()
    if (treasureInFlight) return treasureInFlight
    treasureInFlight = fetchTreasureList().finally(() => {
      treasureInFlight = null
    })
    return treasureInFlight
  }
  const refreshTreasureList = (): Promise<void> => {
    treasureLoaded = false
    treasureInFlight = null
    return loadTreasureList()
  }

  // -------- boss list --------
  const fetchBossList = async () => {
    try {
      const res = await fetch(`${API}/getBossList`, { method: 'GET', headers: buildHeaders() })
      if (!res.ok) return
      bossList.value = await res.json()
      bossLoaded = true
    } catch (e) {
      console.error(e)
    }
  }
  const loadBossList = (): Promise<void> => {
    if (bossLoaded) return Promise.resolve()
    if (bossInFlight) return bossInFlight
    bossInFlight = fetchBossList().finally(() => {
      bossInFlight = null
    })
    return bossInFlight
  }
  const refreshBossList = (): Promise<void> => {
    bossLoaded = false
    bossInFlight = null
    return loadBossList()
  }

  // -------- 整體 reset (登出 / 退出血盟時呼叫,避免換血盟後吃到舊快取) --------
  const reset = () => {
    members.value = []
    treasureList.value = []
    bossList.value = []
    membersLoaded = false
    treasureLoaded = false
    bossLoaded = false
    membersInFlight = null
    treasureInFlight = null
    bossInFlight = null
  }

  return {
    members,
    treasureList,
    bossList,
    loadMembers,
    refreshMembers,
    loadTreasureList,
    refreshTreasureList,
    loadBossList,
    refreshBossList,
    reset,
  }
})
