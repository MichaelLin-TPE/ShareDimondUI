import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const API = 'https://api.gameshare-system.com'

export interface DropRecord {
  id: number
  itemId: string
  itemName: string
  bossId: string | null
  bossName: string | null
  droppedAt: string
  recordedByMemberId: number
  recordedByName: string
  recordedAt: string
  canDelete: boolean
}

export interface ItemStats {
  itemId: string
  itemName: string
  recordCount: number
  avgIntervalMinutes: number | null
  lastDroppedAt: string
  lastBossName: string | null
  estimatedNextAt: string | null
}

interface TreasureItemOption {
  itemId: string
  itemName: string
}
interface BossOption {
  bossId: string
  bossName: string
}

export type Tab = 'stats' | 'history'

export function useLootTracker() {
  const authStore = useAuthStore()

  const activeTab = ref<Tab>('stats')
  const stats = ref<ItemStats[]>([])
  const history = ref<DropRecord[]>([])
  const loading = ref(false)
  const submitting = ref(false)

  const itemOptions = ref<TreasureItemOption[]>([])
  const bossOptions = ref<BossOption[]>([])

  const showAddModal = ref(false)
  const form = ref({
    itemId: '',
    bossId: '',
    droppedAt: '',
  })

  const headers = () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    return {
      Authorization: `Bearer ${authStore.authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Sign: generateSignature(ts),
      TimeStamp: ts,
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/boss-drop/item-stats`, {
        method: 'GET',
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入失敗')
        return
      }
      stats.value = data
    } catch (e) {
      console.log(e)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/boss-drop/list`, {
        method: 'GET',
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入失敗')
        return
      }
      history.value = data
    } catch (e) {
      console.log(e)
    }
  }

  const sharedLists = useSharedListsStore()
  const fetchOptions = async () => {
    try {
      // 走共享 store,跟 treasureCare 共用快取
      await Promise.all([sharedLists.loadTreasureList(), sharedLists.loadBossList()])
      itemOptions.value = sharedLists.treasureList.map((i) => ({ ...i }))
      bossOptions.value = sharedLists.bossList.map((b) => ({ ...b }))
    } catch (e) {
      console.log(e)
    }
  }

  const refreshAll = async () => {
    loading.value = true
    await Promise.all([fetchStats(), fetchHistory()])
    loading.value = false
  }

  const openAdd = () => {
    form.value = { itemId: '', bossId: '', droppedAt: '' }
    showAddModal.value = true
  }
  const closeAdd = () => {
    showAddModal.value = false
  }

  const submitRecord = async () => {
    if (submitting.value) return
    if (!form.value.itemId) {
      useAlert.error('請選擇道具')
      return
    }
    submitting.value = true
    try {
      const body: Record<string, unknown> = { itemId: form.value.itemId }
      if (form.value.bossId) body.bossId = form.value.bossId
      if (form.value.droppedAt) body.droppedAt = form.value.droppedAt

      const res = await fetch(`${API}/boss-drop/record`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '記錄失敗')
        return
      }
      useAlert.success('已記錄掉寶')
      closeAdd()
      await refreshAll()
    } catch (e) {
      console.log(e)
    } finally {
      submitting.value = false
    }
  }

  const deleteRecord = async (id: number) => {
    const ok = await useAlert.confirm('確定要刪除這筆紀錄?')
    if (!ok.isConfirmed) return
    try {
      const res = await fetch(`${API}/boss-drop/${id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '刪除失敗')
        return
      }
      useAlert.success('已刪除')
      await refreshAll()
    } catch (e) {
      console.log(e)
    }
  }

  // === 顯示輔助 ===

  const formatInterval = (minutes: number | null) => {
    if (minutes == null) return '資料不足'
    const days = Math.floor(minutes / (60 * 24))
    const hours = Math.floor((minutes % (60 * 24)) / 60)
    const mins = minutes % 60
    if (days >= 1) return `約 ${days} 天 ${hours} 小時`
    if (hours >= 1) return `約 ${hours} 小時 ${mins} 分`
    return `約 ${mins} 分`
  }

  const formatRelative = (iso: string | null) => {
    if (!iso) return '-'
    const t = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00')).getTime()
    const diffMs = Date.now() - t
    const diffMin = Math.round(diffMs / 60000)
    if (Math.abs(diffMin) < 1) return '剛剛'
    const isPast = diffMin > 0
    const abs = Math.abs(diffMin)
    if (abs < 60) return isPast ? `${abs} 分鐘前` : `${abs} 分鐘後`
    const hr = Math.floor(abs / 60)
    if (hr < 24) return isPast ? `${hr} 小時前` : `${hr} 小時後`
    const day = Math.floor(hr / 24)
    return isPast ? `${day} 天前` : `${day} 天後`
  }

  const formatAbs = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00'))
    const yyyy = d.getFullYear()
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}/${MM}/${dd} ${hh}:${mm}`
  }

  const isOverdue = (iso: string | null) => {
    if (!iso) return false
    const t = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00')).getTime()
    return Date.now() > t
  }

  const isImminent = (iso: string | null) => {
    if (!iso) return false
    const t = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00')).getTime()
    const diff = t - Date.now()
    return diff > 0 && diff < 60 * 60 * 1000
  }

  const totalRecords = computed(() => history.value.length)
  const trackedItems = computed(() => stats.value.length)
  const imminentItems = computed(() =>
    stats.value.filter((s) => isImminent(s.estimatedNextAt) || isOverdue(s.estimatedNextAt)).length,
  )

  onMounted(() => {
    fetchOptions()
    refreshAll()
  })

  return {
    activeTab,
    stats,
    history,
    loading,
    submitting,
    itemOptions,
    bossOptions,
    showAddModal,
    form,
    totalRecords,
    trackedItems,
    imminentItems,
    openAdd,
    closeAdd,
    submitRecord,
    deleteRecord,
    formatInterval,
    formatRelative,
    formatAbs,
    isOverdue,
    isImminent,
    refreshAll,
  }
}
