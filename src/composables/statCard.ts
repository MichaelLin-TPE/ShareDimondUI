import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useBiddingTreasureStore } from '@/stores/biddingTreasure'

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
  const openAddBossDialog = () => {
    showAddBossDialog.value = true
  }
  const currentBuyItem = ref<Treasure>()
  const selectedBuyCurrency = ref('')
  const inputPrice = ref(0)
  const showPeopleList = ref(false)
  const selectPeopleItem = ref<Treasure>()
  const showCurrencyModal = ref(false)
  const handlePeopleCount = (item: Treasure) => {
    showPeopleList.value = true
    selectPeopleItem.value = item
  }
  const biddingStore = useBiddingTreasureStore()
  let unsubscribeWS: (() => void) | null = null

  interface TreasureItem {
    itemName: string
    itemId: string
  }
  interface Boss {
    bossName: string
    bossId: string
  }
  function formatEventTime(iso: string): string {
    const date = new Date(iso)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${d} ${h}:${min}`
  }

  const handlePlus = (item: Treasure) => {
    // 如果還沒出過價，從底價開始；否則在當前基礎上 + 50
    if (!item.biddingPrice || item.biddingPrice === 0) {
      item.biddingPrice = item.lowestPrice
    } else {
      item.biddingPrice += 50
    }
  }
  const handleReduce = (item: Treasure) => {
    // 如果還沒出過價，從底價開始；否則在當前基礎上 + 50
    if (!item.biddingPrice || item.biddingPrice === 0) {
      item.biddingPrice = item.lowestPrice
    } else {
      item.biddingPrice -= 50
    }
  }

  const openAddTreasureDialog = () => {
    showAddTreasureDialog.value = true
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

      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/open-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          itemName: itemName.value,
          bossName: bossName.value,
          lowestPrice: basePrice.value,
          remark: remark.value,
        }),
      })
      if (!res.ok) {
        loading.value = false
        useAlert.error('開單失敗!!!')
        return
      }
      itemName.value = ''
      bossName.value = ''
      remark.value = ''
      basePrice.value = ''
      error.value = ''
      useAlert.success('開單成功!!!')
      showModal.value = false
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  const submitAttendanceTicketCode = ref('')
  const submitDeleteTicketCode = ref('')
  const handleJoinItem = (item: Treasure) => {
    submitAttendanceTicketCode.value = item.treasureCode
    addAttendance()
  }
  const handleDeleteItem = async (item: Treasure) => {
    submitDeleteTicketCode.value = item.treasureCode
    const result = await useAlert.confirm('請確認是否要刪除此單?')
    if (result.isConfirmed) {
      deleteTreasure()
    }
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
const res= await fetch('https://api.gameshare-system.com/update_remark', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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

  // 幹部以上修改競標中單的底價/掛單價(lowestPrice)
  const handleEditBasePrice = async (item: Treasure) => {
    const newAmount = await useAlert.amountInput(item.lowestPrice, item.currency, '修改底價/掛單價')
    if (newAmount == null) return
    if (Number(newAmount) === Number(item.lowestPrice)) {
      useAlert.error('新金額與原金額相同')
      return
    }
    await updateTicketBasePrice(item.treasureCode, newAmount)
  }

  const updateTicketBasePrice = async (ticketCode: string, amount: number) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/update-ticket-base-price', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: ticketCode,
          amount: amount,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        useAlert.error(data?.message ?? '修改底價失敗,請再試一次')
        return
      }
      useAlert.success(data?.message ?? '修改成功!')
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
      useAlert.error('修改底價失敗,請再試一次')
    }
  }

  const deleteTreasure = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/delete-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
const res= await fetch('https://api.gameshare-system.com/add-boss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          bossName: addBossName.value,
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
      showAddBossDialog.value = false
    } catch (e) {
      console.error(e)
      loading.value = false
    } finally {
      loading.value = false
    }
  }
  const submitTreasureCod = ref('')
  const submitBiddingPrice = ref(0)
  const selectedTreasure = ref<Treasure | null>(null)
  const showAssignModal = ref(false)
  const selectedMemberId = ref<string | null>(null)
  function showBiddingList() {
    showAssignModal.value = true
    selectedMemberId.value = null
  }

  const submitAssign = async () => {
    if (!selectedTreasure.value || !selectedMemberId.value) {
      useAlert.success('請選擇一位成員！')
      return
    }
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/setUpBuyer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          userName: selectedMemberId.value,
          ticketCode: selectedTreasure.value.treasureCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      showAssignModal.value = false
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (item: Treasure) => {
    submitTreasureCod.value = item.treasureCode
    submitBiddingPrice.value = item.biddingPrice
    selectedTreasure.value = item
    if (item.assignByLeader && item.status == 'WAIT_PAY') {
      showBiddingList()
      return
    }
    if (!item.isBidding && item.canVerifyBiddingTicket) {
      const resulf = await useAlert.confirm('請確認是否收到帳款?')
      if (resulf.isConfirmed) {
        confirmTicket()
      }
      return
    }
    if (item.treasureType === 'BID') {
      const result = await useAlert.confirm('你真的要出價嗎?')
      if (result.isConfirmed) {
        submitBidding(item.currency)
      }
    } else {
      showCurrencyModal.value = true
    }
  }

  // 如果你的 composable 還沒有 openCurrencyModal，可以在這補上，或者寫在 composable 裡
  const openCurrencyModal = (item: Treasure) => {
    currentBuyItem.value = item
    showCurrencyModal.value = true
  }

  // 點擊確認購買
  const handleConfirmBuy = () => {
    if (!selectedBuyCurrency.value || !currentBuyItem.value) return
    confirmBuy(currentBuyItem.value, selectedBuyCurrency.value)
    showCurrencyModal.value = false
  }

  const confirmBuy = (item: Treasure, currency: string) => {
    submitTreasureCod.value = item.treasureCode
    submitBiddingPrice.value = item.biddingPrice
    submitBidding(currency)
    // 👉 這裡可以把資料傳回給 useAuction 的 handleJoinItem 或是直接打後端 API
    // handleJoinItem(currentBuyItem.value, selectedBuyCurrency.value)

    showCurrencyModal.value = false // 關閉彈窗
  }

  // 回傳 true=成功 / false=失敗 (handleStorageChange 用來決定是否 rollback checkbox UI)
  const confirmGetItem = async (): Promise<boolean> => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/confirm-get-item', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          ticketCode: submitTreasureCod.value,
          checked: checkStatusFromRepository.value,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        useAlert.error(data?.message ?? '存倉狀態更新失敗')
        return false
      }
      return true
    } catch (e) {
      console.error(e)
      useAlert.error('存倉狀態更新失敗,請稍後再試')
      return false
    }
  }

  const confirmTicket = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/confirm-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          ticketCode: submitTreasureCod.value,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      if (res.ok) {
        fetchOngoingTreasures()
        return
      }
    } catch (e) {
      console.error(e)
    }
  }

  const submitBidding = async (currency: string) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/add-bidding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          treasureCode: submitTreasureCod.value,
          biddingPrice: submitBiddingPrice.value,
          currency: currency,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        useAlert.error(data.message)
        return
      }
      const data = await res.json()
      useAlert.success(data.message)
      fetchOngoingTreasures()
    } catch (e) {
      console.error(e)
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
const res= await fetch('https://api.gameshare-system.com/add-treasure', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
      showAddTreasureDialog.value = false
    } catch (e) {
      console.error(e)
      loading.value = false
    } finally {
      loading.value = false
    }
  }

  const auctions = ref<Treasure[]>([])

  interface TreasureCurrency {
    amount: string
    currency: string
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

    /** 首領 ID */
    bossId: string

    treasureAttendanceList: TreasureAttendance[]

    /** 底價 */
    lowestPrice: number

    currency: string

    biddingName: string

    remark: string

    currentPrice: number

    biddingPrice: number

    /** 開單者 memberId */
    ticketOwerMemberId: number

    ticketOwerName: string

    treasureCurrencyList: TreasureCurrency[]

    createDate: string

    /** 最後得標者 memberId（尚未得標時為 null） */
    buyerMemberId: number | null

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

    treasureType: string

    remainSeconds: number

    joinButtonDisable: boolean

    showDeleteTicket: boolean

    disableSubmitButton: boolean

    canVerifyBiddingTicket: boolean

    assignByLeader: boolean

    isBidding: boolean

    canBid: boolean

    checkFromRepository: boolean

    biddingMemberList: BiddingMember[]

    biddingMemberContent: string
  }

  interface BiddingMember {
    userName: string
  }

  type TreasureStatus =
    | 'ATTENDANCE_WAITING'
    | 'BIDDING'
    | 'BID_FINISHED'
    | 'WAIT_PAY'
    | 'PAID'
    | 'CANCELED'
    | 'FAILED'

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
      const code = selectPeopleItem.value?.treasureCode
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/delete-attendance-by-leader', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          ticketCode: code,
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

  // 共用 store 的 raw 資料,在這裡 filter 出 BIDDING 並做本地 post-processing
  const rebuildAuctions = () => {
    auctions.value = (biddingStore.rawTreasures as unknown as Treasure[])
      .filter((item) => item.status === 'BIDDING')
      .map((src) => {
        const item = { ...src } as Treasure
        item.biddingPrice = item.lowestPrice
        item.isBidding = item.status === 'BIDDING'
        if (item.biddingName == null || item.biddingName == '') {
          item.biddingName = '尚未有得標者'
        }
        if (item.biddingMemberList != null && item.biddingMemberList.length != 0) {
          item.biddingMemberContent = item.biddingMemberList
            .map((data) => data.userName)
            .join(',')
        }
        if (item.treasureType === 'BID') {
          item.treasureCurrencyList = item.treasureCurrencyList.filter(
            (currency) => currency.currency == item.currency,
          )
        }
        return item
      })
    startCountdown()
  }

  // 既有 caller 還是會呼叫 fetchOngoingTreasures(); 改成由 store 統一發 API
  const fetchOngoingTreasures = async () => {
    await biddingStore.refresh()
  }

  watch(() => biddingStore.rawTreasures, rebuildAuctions, { immediate: false })

  onMounted(() => {
    rebuildAuctions()
    biddingStore.refresh()
    const clanId = authStore?.member?.clanId
    if (clanId) {
      unsubscribeWS = biddingStore.subscribe(clanId)
    }
  })
  onUnmounted(() => {
    unsubscribeWS?.()
    unsubscribeWS = null
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })

  let timer: number | null = null // 用來存放計時器

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

  const handleStatus = (status: TreasureStatus): string => {
    if (status == 'BIDDING') {
      return '競標中'
    }
    if (status == 'WAIT_PAY') {
      return '等待幹部審核'
    }
    if (status == 'BID_FINISHED') {
      return '競標結束,等候幹部審核'
    }
    return '競標中'
  }



  const canSubmit = computed(() => {

    return (item: Treasure) => {
      // if (!item.checkFromRepository && authStore.member?.role == 'MEMBER'){
      //   return true
      // }
      // if (!item.checkFromRepository &&
      //   (authStore.member?.role == 'OFFICER' || authStore.member?.role == 'LEADER')) {
      //   return false
      // }
      if (!item.canBid) {
        return true
      }
      if (!item.isBidding && !item.canVerifyBiddingTicket) {
        return true
      }
      if (item.canVerifyBiddingTicket) {
        return false
      }

      return false
    }
  })

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

  const checkStatusFromRepository = ref(false)
  const handleStorageChange = async (item: Treasure) => {
    submitTreasureCod.value = item.treasureCode
    checkStatusFromRepository.value = item.checkFromRepository
    const ok = await confirmGetItem()
    if (!ok) {
      // API 失敗 → 翻回原本狀態,避免 UI 跟後端不一致
      item.checkFromRepository = !item.checkFromRepository
    }
  }


  return {
    handleUpdateRemark,
    submitRemark,
    selectedTreasure,
    submitAssign,
    showAssignModal,
    selectedMemberId,
    formatTimestamp,
    handlePeopleCount,
    showPeopleList,
    selectPeopleItem,
    getJoinList,
    inputPrice,
    canSubmit,
    handleReduce,
    handlePlus,
    handleStatus,
    auctions,
    formatTime,
    showModal,
    selectedBuyCurrency,
    handlePersonClick,
    itemName,
    bossName,
    basePrice,
    remark,
    error,
    itemOptions,
    bossOptions,
    handleSubmit,
    showCurrencyModal,
    handleDeleteItem,
    handleEditBasePrice,
    openAddTreasureDialog,
    showAddTreasureDialog,
    addItemName,
    handleStorageChange,
    loading,
    confirmBuy,
    openCurrencyModal,
    addTreasure,
    showAddBossDialog,
    currentBuyItem,
    addBossName,
    handleConfirmBuy,
    addBoss,
    formatEventTime,
    authStore,
    openAddBossDialog,
    createTicket,
    handleJoinItem,
  }
}
