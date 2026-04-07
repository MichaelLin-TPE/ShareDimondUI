import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'
import { generateSignature } from '@/utils/SignTools.ts'

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
  const socket = new SockJS('https://api.gameshare-system.com/ws-gs')
  const stompClient = Stomp.over(socket)
  const handlePeopleCount = (item: Treasure) => {
    showPeopleList.value = true
    selectPeopleItem.value = item
  }
  stompClient.connect({}, (frame) => {
    console.log('Connected : ' + frame)
    stompClient.subscribe('/topic/bidding/' + authStore?.member?.clanId, () => {
      console.log('收到更新訊息 : /topic/bidding/' + authStore?.member?.clanId)
      fetchOngoingTreasures()
    })
  })

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
      console.log(e)
    } finally {
      loading.value = false
    }
  }

  const submitAttendanceTicketCode = ref('')
  const submitDeleteTicketCode = ref('')
  const handleJoinItem = (item: Treasure) => {
    submitAttendanceTicketCode.value = item.treasureCode
    console.log('點了' + item.treasureCode)
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
      console.log(e)
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
      console.log(e)
    }
  }

  const addAttendance = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/add-attendance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
      console.log(e)
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
      console.log(e)
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
      console.log(e)
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

  const confirmBuy = (item: Treasure, currency:string) => {
    console.log('準備購買道具:', item.itemName)
    console.log('使用的幣別:', currency)
    submitTreasureCod.value = item.treasureCode
    submitBiddingPrice.value = item.biddingPrice
    submitBidding(currency)
    // 👉 這裡可以把資料傳回給 useAuction 的 handleJoinItem 或是直接打後端 API
    // handleJoinItem(currentBuyItem.value, selectedBuyCurrency.value)

    showCurrencyModal.value = false // 關閉彈窗
  }

  const confirmGetItem = async () =>{
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res= await fetch('https://api.gameshare-system.com/confirm-get-item', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          ticketCode: submitTreasureCod.value,
          checked: checkStatusFromRepository.value,
        }),
      })
    }catch (e){
      console.log(e)
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
      console.log(e)
    }
  }

  const submitBidding = async (currency: string) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/add-bidding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
      console.log(e)
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
      console.log(e)
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
      console.log(e)
    }
  }

  // 提取成獨立函數
  const fetchOngoingTreasures = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/get-ongoing-bidding-treasure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
      })
      if (!res.ok) {
        const data = await res.json()
        console.log(data)
        return
      }
      const data = await res.json()
      auctions.value = data
      auctions.value = data.filter((item: Treasure) => item.status === 'BIDDING')
      auctions.value.forEach((item) => {
        item.biddingPrice = item.lowestPrice
        item.isBidding = item.status === 'BIDDING'
        console.log(`道具名 : ${item.itemName} , isBidding : ${item.isBidding}`)
        if (item.biddingName == null || item.biddingName == '') {
          item.biddingName = '尚未有得標者'
        }
        if (item.biddingMemberList != null && item.biddingMemberList.length != 0) {
          item.biddingMemberContent = item.biddingMemberList.map((data) => data.userName).join(',')
        }
        if (item.treasureType === 'BID') {
          // filter 會回傳一個新陣列，裡面只包含「條件為 true」的元素
          item.treasureCurrencyList = item.treasureCurrencyList.filter(
            (currency) => currency.currency == item.currency,
          )
        }
      })
      startCountdown()
    } catch (e) {
      console.log(e)
    }
  }

  // onMounted 改成呼叫它
  onMounted(() => {
    fetchOngoingTreasures()
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
      console.log('check : ' + item.checkFromRepository +' , role : '+ authStore.member?.role)
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
  const handleStorageChange = (item:Treasure)=>{
    submitTreasureCod.value = item.treasureCode
    checkStatusFromRepository.value = item.checkFromRepository
    confirmGetItem()
  }


  return {
    handleUpdateRemark,
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
