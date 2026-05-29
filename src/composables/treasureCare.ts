import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'
export function useAuction() {
  const showModal = ref(false)
  const itemName = ref('')
  const bossName = ref('')
  const basePrice = ref('')
  const addItemName = ref('')
  const remark = ref('')
  const itemOptions = ref<TreasureItem[]>([])
  const bossOptions = ref<Boss[]>([])
  const showAddTreasureDialog = ref(false)
  const showAddBossDialog = ref(false)
  const loading = ref(false)
  const error = ref('')
  const authStore = useAuthStore()
  const addBossName = ref('')
  const showPeopleList = ref(false)
  const openAddBossDialog = () => {
    showAddBossDialog.value = true
    // 確保管理彈窗打開時清單是最新的
    getBossList()
  }
  const balance = useBalanceStore()

  let wsHandle: StompHandle | null = null
  interface TreasureItem {
    itemName: string
    itemId: string
  }
  interface Boss {
    bossName: string
    bossId: string
  }

  const handleSubmit = () => {
    createTicket()
  }
  // 開啟開單彈窗 (綁定到您的開單按鈕)
  const openTicket = async () => {
    await Promise.all([getTreasureItemList(), getBossList()])
    showModal.value = true
  }

  const sharedLists = useSharedListsStore()
  // forceRefresh = true 用於 mutation 後 (新增/刪除 boss 或 treasure)
  const getBossList = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        await sharedLists.refreshBossList()
      } else {
        await sharedLists.loadBossList()
      }
      // clone 後存入 local options
      bossOptions.value = sharedLists.bossList.map((b) => ({ ...b })) as Boss[]
    } catch (e) {
      console.error(e)
    }
  }

  const getTreasureItemList = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        await sharedLists.refreshTreasureList()
      } else {
        await sharedLists.loadTreasureList()
      }
      itemOptions.value = sharedLists.treasureList.map((i) => ({ ...i })) as TreasureItem[]
    } catch (e) {
      console.error(e)
    }
  }

  const openAddTreasureDialog = () => {
    showAddTreasureDialog.value = true
    // 確保管理彈窗打開時清單是最新的
    getTreasureItemList()
  }
  const createTicket = async () => {
    if (!bossName.value) {
      error.value = '請選擇首領'
      return
    }
    if (!itemName.value) {
      error.value = '請選擇道具'
      return
    }
    if (!basePrice.value) {
      error.value = '請填入底價'
      return
    }
    loading.value = true
    try {
      let type: number
      if (selectedType.value == 'bid') {
        type = 0
      } else {
        type = 1
      }
      const currentTimestamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/open-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimestamp),
          TimeStamp: currentTimestamp,
        },
        body: JSON.stringify({
          itemName: itemName.value,
          bossName: bossName.value,
          lowestPrice: basePrice.value,
          remark: remark.value?.trim() || '在我身上',
          currency: selectedCurrency.value,
          type: type,
        }),
      })
      if (!res.ok) {
        loading.value = false
        useAlert.error('開單失敗!!!')
        return
      }
      // 先清空 & 關閉原 modal
      itemName.value = ''
      bossName.value = ''
      remark.value = ''
      basePrice.value = ''
      error.value = ''
      showModal.value = false
      loading.value = false
      // 關鍵：等 Vue 真的把 modal 從 DOM 移除後再彈 Swal
      // 不然兩層 backdrop-filter: blur 疊在一起會把瀏覽器合成卡住
      await nextTick()
      useAlert.success('開單成功!!!')
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const submitAttendanceTicketCode = ref('')
  const submitDeleteTicketCode = ref('')
  const handleJoinItem = async (item: Treasure) => {
    submitAttendanceTicketCode.value = item.treasureCode
    if (item.joinButtonDisable) {
      const result = await useAlert.confirm('你確定要取消參予分紅!?')
      if (result.isConfirmed) {
        deleteAttendance()
      }
      return
    }
    const result = await useAlert.confirm('確定有參予再按! 確定不?')
    if (result.isConfirmed) {
      addAttendance()
    }
  }
  const handleDeleteItem = async (item: Treasure) => {
    submitDeleteTicketCode.value = item.treasureCode
    const result = await useAlert.confirm('請確認是否要刪除此單?')
    if (result.isConfirmed) {
      deleteTreasure()
    }
  }

  const deleteTreasure = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/delete-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: submitDeleteTicketCode.value,
        }),
      })
      if (!res.ok) {
        useAlert.error('刪除失敗,再試一次!')
        return
      }
      useAlert.success('刪除成功!')
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    }
  }

  const deleteAttendance = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/delete-attendance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: submitAttendanceTicketCode.value,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    }
  }

  const addAttendance = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/add-attendance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: submitAttendanceTicketCode.value,
        }),
      })
      if (!res.ok) {
        useAlert.error('參與失敗,請再試一次!')
        return
      }
      useAlert.success('參與成功!')
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    }
  }

  const addBoss = async () => {
    if (!addBossName.value) {
      error.value = '請輸入首領名稱'
      return
    }
    loading.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/add-boss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          bossName: addBossName.value,
        }),
      })
      if (!res.ok) {
        loading.value = false
        const data = await res.json()
        error.value = data.message
        useAlert.error('新增失敗!')
        return
      }
      error.value = ''
      useAlert.success('新增成功!')
      loading.value = false
      // 新增後刷新清單
      await getBossList(true)
      addBossName.value = ''
    } catch (e) {
      console.error(e)
      loading.value = false
    } finally {
      loading.value = false
    }
  }

  const addTreasure = async () => {
    if (!addItemName.value) {
      error.value = '請輸入道具名稱'
      return
    }
    loading.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/add-treasure', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          itemName: addItemName.value,
        }),
      })
      if (!res.ok) {
        loading.value = false
        const data = await res.json()
        error.value = data.message
        useAlert.error(error.value)
        return
      }
      error.value = ''
      useAlert.success('新增成功!')
      loading.value = false
      // 新增後刷新清單
      await getTreasureItemList(true)
      addItemName.value = ''
    } catch (e) {
      console.error(e)
      loading.value = false
    } finally {
      loading.value = false
    }
  }

  // === 編輯 / 刪除 道具 ===
  const updateTreasureItem = async (itemId: string, newName: string) => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/update-treasure', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({ itemId, newName }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '更新失敗')
        return false
      }
      useAlert.success(data.message ?? '已更新')
      await getTreasureItemList(true)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const deleteTreasureItem = async (itemId: string, itemName: string) => {
    const ok = await useAlert.confirm(`確定刪除道具「${itemName}」?`)
    if (!ok.isConfirmed) return false
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`https://api.gameshare-system.com/delete-treasure/${itemId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '刪除失敗')
        return false
      }
      useAlert.success(data.message ?? '已刪除')
      await getTreasureItemList(true)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  // === 編輯 / 刪除 首領 ===
  const updateBoss = async (bossId: string, newName: string) => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/update-boss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({ bossId, newName }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '更新失敗')
        return false
      }
      useAlert.success(data.message ?? '已更新')
      await getBossList(true)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const deleteBoss = async (bossId: string, bossName: string) => {
    const ok = await useAlert.confirm(`確定刪除首領「${bossName}」?`)
    if (!ok.isConfirmed) return false
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`https://api.gameshare-system.com/delete-boss/${bossId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '刪除失敗')
        return false
      }
      useAlert.success(data.message ?? '已刪除')
      await getBossList(true)
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  const auctions = ref<Treasure[]>([])

  interface TreasureCurrency {
    currency: string
    amount: string
  }

  interface TreasureAttendance {
    id: number
    treasureCode: string
    memberId: number
    joinTime: string
    canceled: false
    canceledTime: string
    userName: string
    remainSecond: number
  }

  // 這裡可以放原本寫在 script 的各種 function，例如 openTicket() 等
  interface Treasure {
    /** 道具名稱 */
    itemName: string

    /** 道具唯一 ID（對應 TreasureItem.itemId） */
    itemId: string

    /** 首領名稱 */
    bossName: string
    treasureCurrencyList: TreasureCurrency[]
    /** 首領 ID */
    bossId: string

    treasureAttendanceList: TreasureAttendance[]

    /** 底價 */
    lowestPrice: string

    /** 開單者 memberId */
    ticketOwerMemberId: number

    ticketOwerName: string

    currency: string

    baseAmount: string

    treasureType: string

    /** 最後得標者 memberId（尚未得標時為 null） */
    buyerMemberId: number | null

    biddingName: string

    currentPrice: number

    /** 最終成交價（尚未結標時為 null） */
    finalPrice: string | null

    /** 單子狀態 */
    status: TreasureStatus

    /** +1 或競標截止時間（ISO string） */
    expireTime: string

    /** 血盟 ID */
    clanId: string

    /** 單子建立時間（ISO string） */
    ticketCreateTime: string

    /** 對外顯示用的隨機單號 */
    treasureCode: string

    /** 備註（可選） */
    remark?: string

    remainSeconds: number

    joinButtonDisable: boolean

    showDeleteTicket: boolean
  }
  type TreasureStatus =
    | 'ATTENDANCE_WAITING'
    | 'BIDDING'
    | 'BID_FINISHED'
    | 'WAIT_PAY'
    | 'PAID'
    | 'CANCELED'
    | 'FAILED'

  // 提取成獨立函數
  const fetchOngoingTreasures = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/get-ongoing-treasure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
      })
      if (!res.ok) {
        return
      }
      const data = await res.json()
      auctions.value = data
      auctions.value.forEach((item) => {
        item.treasureType = item.treasureType == 'RANDOM_BUYER' ? '固定金額' : '競標單'
      })
      startCountdown()
    } catch (e) {
      console.error(e)
    }
  }

  // onMounted 改成呼叫它
  onMounted(() => {
    fetchOngoingTreasures()
    const clanId = authStore?.member?.clanId
    if (clanId) {
      wsHandle = createReconnectingStomp('/topic/treasure/' + clanId, (body) => {
        if (body === 'STATUS_UPDATED') {
          fetchOngoingTreasures()
        }
      })
    }
  })
  onUnmounted(() => {
    wsHandle?.disconnect()
    wsHandle = null
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })

  let timer: number | null = null // 用來存放計時器

  const getJoinList = (): TreasureAttendance[] => {
    const data = selectPeopleItem.value! // 自動推導為 Treasure | undefined
    const now = new Date().getTime()
    data.treasureAttendanceList.forEach((item) => {
      if (!item.joinTime) {
        item.remainSecond = 0
        return
      }

      // 2. 關鍵修正：補上 "Z" 標記，強制讓 JS 以 UTC 解析
      // 如果後端傳來的是 "2026-01-25T00:39:28"，補 Z 後會變成 "2026-01-25T00:39:28Z"
      // 這樣 new Date() 就會自動幫你加上 8 小時（台北時區）
      const utcString = item.joinTime.endsWith('Z') ? item.joinTime : `${item.joinTime}Z`

      const expire = new Date(utcString).getTime()

      // 3. 計算剩餘秒數
      const diff = Math.max(0, Math.floor((expire - now) / 1000))
      item.remainSecond = diff
    })

    return data.treasureAttendanceList
  }

  const formatPrice = (value: number) => {
    if (!value) return '0'
    return Number(value).toLocaleString('en-US') // 強制使用英文千分位格式
  }

  const selectPeopleItem = ref<Treasure>()
  const selectedCurrency = ref('')
  const selectedType = ref('')

  const handlePeopleCount = (item: Treasure) => {
    showPeopleList.value = true
    selectPeopleItem.value = item
  }

  const handlePersonClick = async (data: TreasureAttendance) => {
    if (authStore.member?.role === 'MEMBER') {
      return
    }
    const reuslt = await useAlert.confirm(`是否要將${data.userName}從這張單移除分紅?`)
    if (reuslt.isConfirmed) {
      showPeopleList.value = false
      deleteAttendanceByLeader(data.memberId)
    }
  }
  const deleteAttendanceByLeader = async (userId: number) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/delete-attendance-by-leader', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: selectPeopleItem.value?.treasureCode,
          userId: userId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    }
  }

  const startCountdown = () => {
    if (timer) clearInterval(timer)

    timer = window.setInterval(() => {
      const now = new Date().getTime()
      auctions.value.forEach((item) => {
        // ✅ 唯一需要修改的地方：加上 '+08:00'
        // 告訴所有國家的瀏覽器：「這是台灣時間！」
        const expire = new Date(item.expireTime + '+08:00').getTime()

        const diff = Math.max(0, Math.floor((expire - now) / 1000))
        item.remainSeconds = diff
      })
    }, 1000) // 小提醒：你的 setInterval 好像漏寫了 1000 (毫秒)
  }

  const formatTime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function formatTimestamp(timeStr: string) {
    // 1. 將字串轉換為 Date 物件
    const date = new Date(timeStr)

    // 2. 提取各個部分並補零
    const yyyy = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')

    // 3. 組合回傳
    return `${yyyy}/${MM}/${dd} ${hh}:${mm}:${ss}`
  }
  const handleUpdateRemark = async (item: Treasure) => {
    submitDeleteTicketCode.value = item.treasureCode
    const result = await useAlert.inputDialog('請更新備註', '更新備註')
    if (result) {
      updateRemark(result)
    }
  }
  // 備註選項彈窗用 — 直接帶入選好的備註字串送出
  const submitRemark = async (item: Treasure, value: string) => {
    submitDeleteTicketCode.value = item.treasureCode
    await updateRemark(value)
  }
  const updateRemark = async (value: string) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/update_remark', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: submitDeleteTicketCode.value,
          remark: value,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    }
  }

  const handleItemChange = async () => {
    if (!itemName.value) return
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/getItemRecentPrice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          itemId: itemName.value,
        }),
      })
      const data = await res.json()
      if (!res.ok){
        return
      }
      basePrice.value = data.price
    } catch (error) {
      console.error('API 請求失敗', error)
    }
  }

  return {
    balance,
    handlePersonClick,
    formatTimestamp,
    getJoinList,
    selectPeopleItem,
    selectedCurrency,
    selectedType,
    showPeopleList,
    handlePeopleCount,
    auctions,
    formatTime,
    showModal,
    itemName,
    bossName,
    basePrice,
    remark,
    error,
    formatPrice,
    itemOptions,
    bossOptions,
    handleSubmit,
    handleUpdateRemark,
    submitRemark,
    handleDeleteItem,
    openTicket,
    openAddTreasureDialog,
    showAddTreasureDialog,
    addItemName,
    loading,
    addTreasure,
    showAddBossDialog,
    addBossName,
    addBoss,
    handleItemChange,
    openAddBossDialog,
    createTicket,
    handleJoinItem,
    updateTreasureItem,
    deleteTreasureItem,
    updateBoss,
    deleteBoss,
  }
}
