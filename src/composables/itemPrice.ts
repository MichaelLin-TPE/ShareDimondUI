import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

export interface ItemPriceRow {
  itemId: string
  itemName: string
  currency: string
  currentPrice: number | null
  lastFinalPrice: number | null
  ongoingBiddingCount: number
}

export interface ItemPriceGroup {
  itemId: string
  itemName: string
  rows: ItemPriceRow[]
}

export function useItemPrice() {
  const authStore = useAuthStore()
  const itemList = ref<ItemPriceRow[]>([])
  const keyword = ref('')
  const loading = ref(false)
  const submitting = ref(false)

  const editTarget = ref<ItemPriceRow | null>(null)
  const editValue = ref<string>('')
  const showEditModal = ref(false)

  const filteredList = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return itemList.value
    return itemList.value.filter(
      (it) =>
        it.itemName.toLowerCase().includes(k) || it.currency.toLowerCase().includes(k),
    )
  })

  const groupedList = computed<ItemPriceGroup[]>(() => {
    const map = new Map<string, ItemPriceGroup>()
    for (const row of filteredList.value) {
      let group = map.get(row.itemId)
      if (!group) {
        group = { itemId: row.itemId, itemName: row.itemName, rows: [] }
        map.set(row.itemId, group)
      }
      group.rows.push(row)
    }
    return Array.from(map.values())
  })

  const fetchList = async () => {
    loading.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/getItemPriceList', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入失敗')
        return
      }
      itemList.value = data
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const openEdit = (row: ItemPriceRow) => {
    editTarget.value = row
    editValue.value = row.currentPrice != null ? String(row.currentPrice) : ''
    showEditModal.value = true
  }

  const closeEdit = () => {
    showEditModal.value = false
    editTarget.value = null
    editValue.value = ''
  }

  const submitEdit = async () => {
    if (submitting.value) return
    if (!editTarget.value) return
    const num = Number(editValue.value)
    if (!editValue.value || isNaN(num) || num <= 0) {
      useAlert.error('請輸入大於 0 的數字')
      return
    }
    submitting.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/updateItemPrice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({
          itemId: editTarget.value.itemId,
          currency: editTarget.value.currency,
          price: num,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '更新失敗')
        return
      }
      const tip =
        data.updatedOngoingCount > 0
          ? `已更新,並連動 ${data.updatedOngoingCount} 張進行中競標單`
          : '已更新'
      useAlert.success(tip)
      closeEdit()
      await fetchList()
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  const formatPrice = (v: number | null) => {
    if (v == null) return '尚未設定'
    return '$' + Number(v).toLocaleString('en-US')
  }

  onMounted(() => {
    fetchList()
  })

  return {
    itemList,
    filteredList,
    groupedList,
    keyword,
    loading,
    submitting,
    showEditModal,
    editTarget,
    editValue,
    openEdit,
    closeEdit,
    submitEdit,
    formatPrice,
    fetchList,
  }
}
