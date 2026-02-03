import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'

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
  }
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
  // 開啟彈窗的函數 (綁定到您的開單按鈕)
  const openTicket = () => {
    getTreasureItemList()
    getBossList()
  }

  const getBossList = async () => {
    try {
      const res = await fetch('https://gameshare-system.com/getBossList', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        return
      }
      const data: Boss[] = await res.json()
      bossOptions.value = data
    } catch (e) {
      console.log(e)
    }
  }

  const getTreasureItemList = async () => {
    try {
      const res = await fetch('https://gameshare-system.com/getTreasureList', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        return
      }
      const data: TreasureItem[] = await res.json()
      itemOptions.value = data
      showModal.value = true
    } catch (e) {
      console.log(e)
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
      const res = await fetch('https://gameshare-system.com/open-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
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
        return
      }
      itemName.value = ''
      bossName.value = ''
      remark.value = ''
      basePrice.value = ''
      error.value = ''
      alert('開單成功!!!')
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
  const handleJoinItem = (item:Treasure) =>{
    submitAttendanceTicketCode.value = item.treasureCode
    console.log('點了'+item.treasureCode)
    addAttendance()
  }
  const handleDeleteItem = (item:Treasure) =>{
    submitDeleteTicketCode.value = item.treasureCode
    deleteTreasure()
  }

  const deleteTreasure = async () =>{
    try{
      const res = await fetch('https://gameshare-system.com/delete-ticket', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketCode: submitDeleteTicketCode.value,
        }),
      })
      if (!res.ok){
        alert('刪除失敗,再試一次!')
        return
      }
      alert('刪除成功!')
      fetchOngoingTreasures()
    }catch (e){
      console.log(e)
    }
  }



  const addAttendance = async () =>{
    try{
      const res = await fetch('https://gameshare-system.com/add-attendance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketCode: submitAttendanceTicketCode.value,
        }),
      })
      if (!res.ok){
        alert('參與失敗,請再試一次!')
        return
      }
      alert('參與成功!')
      fetchOngoingTreasures()
    }catch (e){
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
      const res = await fetch('https://gameshare-system.com/add-boss', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bossName: addBossName.value,
        }),
      })
      if (!res.ok) {
        loading.value = false
        const data = await res.json()
        error.value = data.message
        return
      }
      error.value = ''
      alert('新增成功!')
      loading.value = false
      showAddBossDialog.value = false
    } catch (e) {
      console.log(e)
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
      const res = await fetch('https://gameshare-system.com/add-treasure', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: addItemName.value,
        }),
      })
      if (!res.ok) {
        loading.value = false
        const data = await res.json()
        error.value = data.message
        return
      }
      error.value = ''
      alert('新增成功!')
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

  interface TreasureAttendance{
    id:number
    treasureCode:string
    memberId:number
    joinTime:string
    canceled:false
    canceledTime:string
    userName:string
    remainSecond:number
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
    lowestPrice: string

    /** 開單者 memberId */
    ticketOwerMemberId: number

    ticketOwerName: string

    /** 最後得標者 memberId（尚未得標時為 null） */
    buyerMemberId: number | null

    biddingName:string

    currentPrice:number

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
      const res = await fetch('https://gameshare-system.com/get-ongoing-treasure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        const data = await res.json()
        console.log(data)
        return
      }
      const data = await res.json()
      auctions.value = data
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


 const handleJoinButtonDiable = () =>{

 }
 const selectPeopleItem = ref<Treasure>()

 const handlePeopleCount = (item:Treasure) =>{
    showPeopleList.value = true
    selectPeopleItem.value = item
 }

  onMounted(async () => {
    try {
      const res = await fetch('https://gameshare-system.com/get-ongoing-treasure', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        const data = await res.json()
        console.log(data)
        return
      }
      const data = await res.json()
      auctions.value = data
      startCountdown()
      handleJoinButtonDiable()


    } catch (e) {
      console.log(e)
    }
  })

  const startCountdown = () => {
    if (timer) clearInterval(timer)

    timer = setInterval(() => {
      const now = new Date().getTime()
      auctions.value.forEach((item) => {
        const expire = new Date(item.expireTime).getTime()

        const diff = Math.max(0, Math.floor((expire - now) / 1000))
        item.remainSeconds = diff
      })
    })
  }

  const formatTime = (seconds:number):string =>{
    if (!seconds || seconds <= 0) return '00:00'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  function formatTimestamp(timeStr:string) {
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


  return {
    formatTimestamp,
    getJoinList,
    selectPeopleItem,
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
    itemOptions,
    bossOptions,
    handleSubmit,
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
    openAddBossDialog,
    createTicket,
    handleJoinItem,
  }
}
