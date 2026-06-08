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
  const showPeopleList = ref(false)
  const selectPeopleItem = ref<Treasure>()
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

  const submitDeleteTicketCode = ref('')

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

  const submitTreasureCod = ref('')
  const submitBiddingPrice = ref(0)
  const submitConfirmType = ref(0)
  const selectedTreasure = ref<Treasure | null>(null)
  const showAssignModal = ref(false)
  const selectedMemberId = ref<string | null>(null)
  function showBiddingList() {
    showAssignModal.value = true
    selectedMemberId.value = null
  }

  // === 系統骰點指定得標者 ===
  interface DiceRoll {
    userName: string
    value: number
  }
  interface DiceRound {
    roundNo: number
    tieBreak: boolean
    rolls: DiceRoll[]
  }
  interface DiceDisplayRoll {
    userName: string
    value: number
    rolling: boolean
    isTop: boolean
  }
  const showDiceModal = ref(false)
  const diceLoading = ref(false) // 呼叫 API 中
  const diceAnimating = ref(false) // 動畫播放中
  const diceTreasure = ref<Treasure | null>(null)
  const diceRoundLabel = ref('')
  const diceVisibleRolls = ref<DiceDisplayRoll[]>([])
  const diceWinnerName = ref('')
  const diceFinalPrice = ref('')
  const diceCurrency = ref('')
  const diceDone = ref(false)

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // 用後端骰好的真實結果重播動畫(點數由後端決定,前端只負責呈現)
  const playDiceAnimation = async (rounds: DiceRound[], winnerName: string) => {
    diceAnimating.value = true
    diceDone.value = false
    diceWinnerName.value = ''
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i]
      if (!round) continue
      diceRoundLabel.value = round.tieBreak
        ? `🔥 平手重骰!(第 ${round.roundNo} 輪)`
        : `第 ${round.roundNo} 輪`
      // 1) 全部進入「轉動中」
      diceVisibleRolls.value = round.rolls.map((r) => ({
        userName: r.userName,
        value: r.value,
        rolling: true,
        isTop: false,
      }))
      await sleep(1100)
      // 2) 落點顯示數字
      diceVisibleRolls.value = round.rolls.map((r) => ({
        userName: r.userName,
        value: r.value,
        rolling: false,
        isTop: false,
      }))
      await sleep(550)
      // 3) 高亮本輪最高點
      const max = Math.max(...round.rolls.map((r) => r.value))
      diceVisibleRolls.value = diceVisibleRolls.value.map((r) => ({ ...r, isTop: r.value === max }))
      await sleep(i < rounds.length - 1 ? 950 : 700)
    }
    // 揭曉得標者
    diceWinnerName.value = winnerName
    diceDone.value = true
    diceAnimating.value = false
    await sleep(300)
    fetchOngoingTreasures()
  }

  const openDiceAssign = async (item: Treasure) => {
    if (diceLoading.value || diceAnimating.value) return
    diceTreasure.value = item
    diceVisibleRolls.value = []
    diceRoundLabel.value = ''
    diceWinnerName.value = ''
    diceFinalPrice.value = ''
    diceCurrency.value = ''
    diceDone.value = false
    showDiceModal.value = true
    diceLoading.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/dice-assign-buyer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({ ticketCode: item.treasureCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data?.message ?? '骰點失敗,請再試一次')
        showDiceModal.value = false
        return
      }
      diceLoading.value = false
      diceFinalPrice.value = String(data.finalPrice ?? '')
      diceCurrency.value = data.currency ?? ''
      await playDiceAnimation(data.rounds ?? [], data.winnerName ?? '')
    } catch (e) {
      console.error(e)
      useAlert.error('骰點失敗,請再試一次')
      showDiceModal.value = false
    } finally {
      diceLoading.value = false
    }
  }

  const closeDiceModal = () => {
    // 動畫中不可關閉(避免關到一半);完成後才允許
    if (diceAnimating.value) return
    showDiceModal.value = false
    fetchOngoingTreasures()
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

  const handleSubmitFromWallet = async (item: Treasure) => {
    submitTreasureCod.value = item.treasureCode
    submitBiddingPrice.value = item.biddingPrice
    submitConfirmType.value = 1
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
    const result = await useAlert.confirm('你真的要標嗎???')
    // SweetAlert2 的回傳物件會包含 isConfirmed
    if (result.isConfirmed) {
      // 執行您的 SQL 邏輯或 API 呼叫
      submitBidding()
    }
  }

  const handleSubmit = async (item: Treasure) => {
    submitTreasureCod.value = item.treasureCode
    submitBiddingPrice.value = item.biddingPrice
    submitConfirmType.value = 2
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
    const result = await useAlert.confirm('你真的要標嗎???')
    // SweetAlert2 的回傳物件會包含 isConfirmed
    if (result.isConfirmed) {
      // 執行您的 SQL 邏輯或 API 呼叫
      submitBidding()
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
          confirmType: submitConfirmType.value,
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

  const submitBidding = async () => {
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

    /** 首領 ID */
    bossId: string

    treasureAttendanceList: TreasureAttendance[]

    /** 底價 */
    lowestPrice: number

    currency: string

    biddingName: string

    checkFromRepository: boolean

    remark: string

    currentPrice: number

    biddingPrice: number

    /** 開單者 memberId */
    ticketOwerMemberId: number

    ticketOwerName: string

    treasureCurrencyList: TreasureCurrency[]

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

    hasEnoughMoneyToBuy: boolean
    assignByLeader: boolean

    isBidding: boolean

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

  // 共用 store 的 raw 資料,在這裡 filter 出 WAIT_PAY 並做本地 post-processing
  const rebuildAuctions = () => {
    auctions.value = (biddingStore.rawTreasures as unknown as Treasure[])
      .filter((item) => item.status === 'WAIT_PAY')
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

  const handlePeopleClick = async (data: TreasureAttendance) => {
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
const res= await fetch('https://api.gameshare-system.com/delete-attendance-by-leader', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
  // 回傳 true=成功 / false=失敗 (handleStorageChange 用來決定是否 rollback)
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

  // --- 新增：不更動原有邏輯，僅增加分組用的計算屬性 ---
  const groupedAuctionsList = computed(() => {
    const unassigned: Treasure[] = []
    const groups: Record<string, Treasure[]> = {}

    // 兼容 ref 或 reactive 的取值方式
    const source = auctions.value || auctions

    if (!source) return []

    source.forEach((item: Treasure) => {
      const name = item.biddingName
      // 判斷是否尚未分配
      if (!name || name === '尚未有得標者' || name.length === 0) {
        unassigned.push(item)
      } else {
        // 依得標者名稱分組
        if (!groups[name]) {
          groups[name] = []
        }
        groups[name].push(item)
      }
    })

    const result = []

    // 將已分配的訂單推入結果陣列
    for (const name in groups) {
      result.push({ title: `${name} 得標的訂單`, items: groups[name] })
    }

    // 將尚未分配的訂單放在最後面
    if (unassigned.length > 0) {
      result.push({ title: '尚未分配得標的訂單', items: unassigned })
    }

    return result.sort((a, b) => a.title.localeCompare(b.title, 'zh-TW'))
  })

  return {
    authStore,
    groupedAuctionsList,
    handleSubmitFromWallet,
    handleUpdateRemark,
    submitRemark,
    selectedTreasure,
    submitAssign,
    handlePeopleClick,
    showAssignModal,
    selectedMemberId,
    // 系統骰點
    showDiceModal,
    diceLoading,
    diceAnimating,
    diceTreasure,
    diceRoundLabel,
    diceVisibleRolls,
    diceWinnerName,
    diceFinalPrice,
    diceCurrency,
    diceDone,
    openDiceAssign,
    closeDiceModal,
    formatTimestamp,
    handlePeopleCount,
    showPeopleList,
    selectPeopleItem,
    getJoinList,
    canSubmit,
    handleReduce,
    handlePlus,
    handleStatus,
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
    openAddTreasureDialog,
    showAddTreasureDialog,
    addItemName,
    loading,
    addTreasure,
    showAddBossDialog,
    addBossName,
    openAddBossDialog,
    handleStorageChange,
  }
}
