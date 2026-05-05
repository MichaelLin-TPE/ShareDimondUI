import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'
import type {
  EditListingPayload,
  ListingType,
  OpenListingPayload,
  PersonalListing,
  PersonalListingDetail,
  PersonalListingItem,
} from '@/types/personalMarket.ts'

const API = 'https://api.gameshare-system.com'

export type Tab = 'market' | 'mine' | 'items'
export type TypeFilter = 'ALL' | ListingType

export function usePersonalMarket() {
  const authStore = useAuthStore()

  // ======== state ========
  const activeTab = ref<Tab>('market')
  const marketList = ref<PersonalListing[]>([])
  const myListings = ref<PersonalListing[]>([])    // 我作為賣家
  const myPurchases = ref<PersonalListing[]>([])   // 我作為買家 (WAIT_PAY / COMPLETED)
  const myBids = ref<PersonalListing[]>([])        // 我有出價且還沒結標的競標單 (OPEN BIDDING)
  const myItems = ref<PersonalListingItem[]>([])

  const loading = ref(false)
  const submitting = ref(false)

  const searchQuery = ref('')
  const typeFilter = ref<TypeFilter>('ALL')

  // 詳情
  const detail = ref<PersonalListingDetail | null>(null)
  const showDetailModal = ref(false)

  // 開新掛單
  const showOpenModal = ref(false)
  const openForm = ref<{
    itemId: string
    type: 0 | 1
    price: string
    currency: string
    durationMins: string
    remark: string
  }>({
    itemId: '',
    type: 0,
    price: '',
    currency: '',
    durationMins: '',
    remark: '',
  })

  // 編輯掛單
  const showEditModal = ref(false)
  const editForm = ref<{
    listingCode: string
    price: string
    currency: string
    durationMins: string
    remark: string
    onlyRemark: boolean
  }>({
    listingCode: '',
    price: '',
    currency: '',
    durationMins: '',
    remark: '',
    onlyRemark: false,
  })

  // 建立道具
  const showCreateItemModal = ref(false)
  const createItemForm = ref({ itemName: '' })

  // 出價
  const showBidModal = ref(false)
  const bidForm = ref({ price: '', currency: '' })

  // 立刻買 (固定價選幣別)
  const showBuyModal = ref(false)
  const buyForm = ref({ currency: '' })

  // 結標選人
  const showSelectBuyerModal = ref(false)
  const selectBuyerForm = ref({ userName: '' })

  // ======== computed ========
  const me = computed(() => authStore.member?.userName ?? '')
  const myMemberId = computed(() => null) // 後端用 userName 對比即可

  const filteredMarketList = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    return marketList.value.filter((l) => {
      if (typeFilter.value !== 'ALL' && l.listingType !== typeFilter.value) return false
      if (!q) return true
      return (
        l.itemName.toLowerCase().includes(q) ||
        l.sellerName.toLowerCase().includes(q)
      )
    })
  })

  // 我作為賣家
  const myActiveListings = computed(() =>
    myListings.value.filter((l) => l.status === 'OPEN' || l.status === 'WAIT_PAY'),
  )
  const myHistoryListings = computed(() =>
    myListings.value.filter(
      (l) => l.status === 'COMPLETED' || l.status === 'CANCELED' || l.status === 'EXPIRED',
    ),
  )

  // 我作為買家 — 等付款 (賣家還沒確認)
  const myWaitPayPurchases = computed(() =>
    myPurchases.value.filter((l) => l.status === 'WAIT_PAY'),
  )
  // 我作為買家 — 歷史 (已完成 / 取消 / 過期)
  const myHistoryPurchases = computed(() =>
    myPurchases.value.filter(
      (l) => l.status === 'COMPLETED' || l.status === 'CANCELED' || l.status === 'EXPIRED',
    ),
  )

  const stats = computed(() => ({
    market: marketList.value.length,
    mine: myActiveListings.value.length,
    // 「待我處理」= 賣家身份 WAIT_PAY (我要確認付款) + 買家身份 BIDDING 出價中 (要追)
    waitPay: myListings.value.filter((l) => l.status === 'WAIT_PAY').length,
    buying: myWaitPayPurchases.value.length + myBids.value.length,
  }))

  // ======== headers ========
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

  // ======== fetch ========
  const fetchMarket = async () => {
    try {
      const res = await fetch(`${API}/personal-listing/list`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入市場失敗')
        return
      }
      marketList.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const fetchMine = async () => {
    try {
      const res = await fetch(`${API}/personal-listing/my-listings`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入我的掛單失敗')
        return
      }
      myListings.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const fetchMyPurchases = async () => {
    try {
      const res = await fetch(`${API}/personal-listing/my-purchases`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入購買紀錄失敗')
        return
      }
      myPurchases.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const fetchMyBids = async () => {
    try {
      const res = await fetch(`${API}/personal-listing/my-bids`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入出價中失敗')
        return
      }
      myBids.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API}/personal-listing/my-items`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入道具庫失敗')
        return
      }
      myItems.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const refreshAll = async () => {
    loading.value = true
    await Promise.all([
      fetchMarket(),
      fetchMine(),
      fetchMyPurchases(),
      fetchMyBids(),
      fetchItems(),
    ])
    loading.value = false
  }

  const refreshActive = async () => {
    if (activeTab.value === 'market') await fetchMarket()
    else if (activeTab.value === 'mine') {
      await Promise.all([fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } else if (activeTab.value === 'items') await fetchItems()
  }

  // ======== detail ========
  const openDetail = async (code: string) => {
    detail.value = null
    showDetailModal.value = true
    try {
      const res = await fetch(`${API}/personal-listing/detail?code=${encodeURIComponent(code)}`, {
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '載入詳情失敗')
        showDetailModal.value = false
        return
      }
      detail.value = data
    } catch (e) {
      console.error(e)
      showDetailModal.value = false
    }
  }

  const closeDetail = () => {
    showDetailModal.value = false
    detail.value = null
  }

  // ======== 道具庫 ========
  const openCreateItem = () => {
    createItemForm.value.itemName = ''
    showCreateItemModal.value = true
  }
  const submitCreateItem = async () => {
    if (submitting.value) return
    const name = createItemForm.value.itemName.trim()
    if (!name) {
      useAlert.error('請輸入道具名稱')
      return
    }
    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/create-item`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ itemName: name }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '建立失敗')
        return
      }
      useAlert.success('道具已建立')
      showCreateItemModal.value = false
      await fetchItems()
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 開新掛單 ========
  const openOpenModal = () => {
    openForm.value = {
      itemId: '',
      type: 0,
      price: '',
      currency: '',
      durationMins: '',
      remark: '',
    }
    showOpenModal.value = true
  }

  const submitOpenListing = async () => {
    if (submitting.value) return
    const f = openForm.value
    if (!f.itemId) return useAlert.error('請選擇道具')
    if (!f.currency) return useAlert.error('請選擇幣別')
    const priceNum = Number(f.price)
    if (!f.price || isNaN(priceNum) || priceNum <= 0) {
      return useAlert.error('請輸入正確的金額')
    }
    if (f.type === 1) {
      const dur = Number(f.durationMins)
      if (!f.durationMins || isNaN(dur) || dur <= 0) {
        return useAlert.error('競標必須設定期限 (分鐘)')
      }
    }

    const payload: OpenListingPayload = {
      itemId: f.itemId,
      type: f.type,
      currency: f.currency,
      remark: f.remark || undefined,
    }
    if (f.type === 0) {
      payload.fixedPrice = priceNum
      if (f.durationMins) payload.durationMins = Number(f.durationMins)
    } else {
      payload.startPrice = priceNum
      payload.durationMins = Number(f.durationMins)
    }

    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/open`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '建立掛單失敗')
        return
      }
      useAlert.success('掛單已建立')
      showOpenModal.value = false
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 編輯 ========
  const openEditModal = (listing: PersonalListing, hasBids: boolean) => {
    editForm.value = {
      listingCode: listing.listingCode,
      price: String(
        (listing.listingType === 'FIXED_PRICE' ? listing.fixedPrice : listing.startPrice) ?? '',
      ),
      currency: listing.currency,
      durationMins: '',
      remark: listing.remark ?? '',
      onlyRemark: hasBids,
    }
    showEditModal.value = true
  }

  const submitEditListing = async () => {
    if (submitting.value) return
    const f = editForm.value
    const payload: EditListingPayload = { listingCode: f.listingCode }
    payload.remark = f.remark
    if (!f.onlyRemark) {
      const priceNum = Number(f.price)
      if (f.price && !isNaN(priceNum) && priceNum > 0) {
        // 後端會根據 listingType 用 fixedPrice / startPrice 其中一個欄位
        payload.fixedPrice = priceNum
        payload.startPrice = priceNum
      }
      if (f.currency) payload.currency = f.currency
      if (f.durationMins) {
        const d = Number(f.durationMins)
        if (!isNaN(d) && d > 0) payload.durationMins = d
      }
    }
    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/edit`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '編輯失敗')
        return
      }
      useAlert.success('已更新')
      showEditModal.value = false
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 撤單 ========
  const cancelListing = async (code: string) => {
    const ok = await useAlert.confirm('確定要撤銷這筆掛單?')
    if (!ok.isConfirmed) return
    try {
      const res = await fetch(`${API}/personal-listing/cancel`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ listingCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '撤銷失敗')
        return
      }
      useAlert.success('已撤銷')
      closeDetail()
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    }
  }

  // ======== 立刻買 ========
  const openBuyModal = (defaultCurrency: string) => {
    buyForm.value.currency = defaultCurrency
    showBuyModal.value = true
  }

  const submitBuy = async (listingCode: string) => {
    if (submitting.value) return
    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/buy`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          listingCode,
          currency: buyForm.value.currency || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '購買失敗')
        return
      }
      useAlert.success(data.message ?? '已下單,等待賣家確認')
      showBuyModal.value = false
      closeDetail()
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 出價 ========
  const openBidModal = (listing: PersonalListing) => {
    bidForm.value = {
      price: '',
      currency: listing.currency,
    }
    showBidModal.value = true
  }

  const submitBid = async (listingCode: string) => {
    if (submitting.value) return
    const priceNum = Number(bidForm.value.price)
    if (!bidForm.value.price || isNaN(priceNum) || priceNum <= 0) {
      return useAlert.error('請輸入大於 0 的出價金額')
    }
    if (!bidForm.value.currency) {
      return useAlert.error('請選擇出價幣別')
    }
    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/add-bidding`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          listingCode,
          biddingPrice: priceNum,
          currency: bidForm.value.currency,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '出價失敗')
        return
      }
      useAlert.success('已出價')
      showBidModal.value = false
      // 重新載詳情 + 市場 + 我的出價
      if (detail.value?.listing.listingCode === listingCode) {
        await openDetail(listingCode)
      }
      await Promise.all([fetchMarket(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 結標選人 ========
  const openSelectBuyerModal = (defaultUserName?: string) => {
    selectBuyerForm.value.userName = defaultUserName ?? ''
    showSelectBuyerModal.value = true
  }

  const submitSelectBuyer = async (listingCode: string) => {
    if (submitting.value) return
    if (!selectBuyerForm.value.userName) {
      return useAlert.error('請選擇得標者')
    }
    submitting.value = true
    try {
      const res = await fetch(`${API}/personal-listing/select-buyer`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          listingCode,
          userName: selectBuyerForm.value.userName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '結標失敗')
        return
      }
      useAlert.success('已結標,等待對方確認付款')
      showSelectBuyerModal.value = false
      if (detail.value?.listing.listingCode === listingCode) {
        await openDetail(listingCode)
      }
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // ======== 賣家確認付款 ========
  const confirmFromWallet = async (listingCode: string) => {
    const ok = await useAlert.confirm('確定買家已用錢包扣款?系統會直接從凍結餘額扣給你')
    if (!ok.isConfirmed) return
    try {
      const res = await fetch(`${API}/personal-listing/confirm-payment-from-wallet`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ listingCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '確認失敗')
        return
      }
      useAlert.success('已完成交易')
      closeDetail()
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    }
  }

  const confirmByGame = async (listingCode: string) => {
    const ok = await useAlert.confirm('確定買家已在遊戲內付款?系統會解凍買家餘額並結單')
    if (!ok.isConfirmed) return
    try {
      const res = await fetch(`${API}/personal-listing/confirm-payment-by-game`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ listingCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '確認失敗')
        return
      }
      useAlert.success('已完成交易')
      closeDetail()
      await Promise.all([fetchMarket(), fetchMine(), fetchMyPurchases(), fetchMyBids()])
    } catch (e) {
      console.error(e)
    }
  }

  // ======== 顯示輔助 ========
  const formatPrice = (v: number | null) => {
    if (v == null) return '—'
    return Number(v).toLocaleString('en-US')
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00'))
    const yyyy = d.getFullYear()
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}/${MM}/${dd} ${hh}:${mm}`
  }

  const formatRemain = (iso: string | null) => {
    if (!iso) return '不限期'
    const t = new Date(iso + (iso.endsWith('Z') ? '' : '+08:00')).getTime()
    const diffMin = Math.floor((t - Date.now()) / 60000)
    if (diffMin <= 0) return '已過期'
    if (diffMin < 60) return `剩 ${diffMin} 分`
    const hr = Math.floor(diffMin / 60)
    if (hr < 24) return `剩 ${hr} 小時 ${diffMin % 60} 分`
    const day = Math.floor(hr / 24)
    return `剩 ${day} 天 ${hr % 24} 小時`
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'OPEN':
        return '上架中'
      case 'WAIT_PAY':
        return '待結帳'
      case 'COMPLETED':
        return '已完成'
      case 'CANCELED':
        return '已撤銷'
      case 'EXPIRED':
        return '已過期'
      default:
        return s
    }
  }

  // ======== WebSocket ========
  let wsHandle: StompHandle | null = null

  onMounted(async () => {
    await refreshAll()
    const clanId = authStore.member?.clanId
    if (clanId) {
      wsHandle = createReconnectingStomp(`/topic/listing/${clanId}`, () => {
        refreshActive()
        if (showDetailModal.value && detail.value?.listing.listingCode) {
          openDetail(detail.value.listing.listingCode)
        }
      })
    }
  })

  onUnmounted(() => {
    wsHandle?.disconnect()
    wsHandle = null
  })

  return {
    // state
    activeTab,
    marketList,
    myListings,
    myPurchases,
    myBids,
    myItems,
    loading,
    submitting,
    searchQuery,
    typeFilter,
    detail,
    showDetailModal,
    showOpenModal,
    openForm,
    showEditModal,
    editForm,
    showCreateItemModal,
    createItemForm,
    showBidModal,
    bidForm,
    showBuyModal,
    buyForm,
    showSelectBuyerModal,
    selectBuyerForm,
    // computed
    me,
    myMemberId,
    filteredMarketList,
    myActiveListings,
    myHistoryListings,
    myWaitPayPurchases,
    myHistoryPurchases,
    stats,
    // actions
    refreshAll,
    refreshActive,
    fetchMarket,
    fetchMine,
    fetchMyPurchases,
    fetchMyBids,
    fetchItems,
    openDetail,
    closeDetail,
    openCreateItem,
    submitCreateItem,
    openOpenModal,
    submitOpenListing,
    openEditModal,
    submitEditListing,
    cancelListing,
    openBuyModal,
    submitBuy,
    openBidModal,
    submitBid,
    openSelectBuyerModal,
    submitSelectBuyer,
    confirmFromWallet,
    confirmByGame,
    // formatters
    formatPrice,
    formatTime,
    formatRemain,
    statusLabel,
  }
}
