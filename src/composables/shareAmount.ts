import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import type { Balance } from '@/types/balance.ts'

export function useAuction() {
  const authStore = useAuthStore()
  const balance = useBalanceStore()
  const totalFund = ref(50000)
  const clanBalanceResponseList = ref<Balance[]>([])
  const selectedCurrency = ref('')

  // 2. 計算邏輯
  const allocatedAmount = computed(() => {
    return memberList.value.reduce((sum, m) => sum + (Number(m.memberAmount) || 0), 0)
  })


  const getRemaining = (item: { balance: string; currency: string }) => {
    // 邏輯：只有當幣別匹配時才扣除已分配金額
    // 假設 UI 上的分配輸入框 memberAmount 預設對應的是 "元寶"
    if (selectedCurrency.value === item.currency) {
      return Number(item.balance) - allocatedAmount.value
    }
    // 其他幣別（如天幣）若目前不參與分配，則直接回傳餘額
    return item.balance
  }

  // 修改 handleConfirm 判斷
  const handleConfirm = async () => {
    // 1. 找到選中幣別的帳戶進行檢查
    const currentAccount = balance.clanBalanceList.find(
      (b) => b.currency === selectedCurrency.value,
    )
    const currentTotal = currentAccount ? Number(currentAccount.balance) : 0

    // 檢查總額是否超過
    if (allocatedAmount.value > currentTotal) {
      useAlert.error(
        `發放總額 (${allocatedAmount.value}) 不能超過現有${selectedCurrency.value} (${currentTotal})！`,
      )
      return
    }

    // 2. 核心邏輯：紀錄有被派發的用戶名稱與金額
    // 篩選出有填寫金額且大於 0 的成員
    const distributionData: ShareMemberData[] = memberList.value
      .filter((m) => (Number(m.memberAmount) || 0) > 0)
      .map(
        (m): ShareMemberData => ({
          userName: m.memberName,
          shareAmount: Number(m.memberAmount),
        }),
      )

    if (distributionData.length === 0) {
      useAlert.error('請至少輸入一位成員的發放金額！')
      return
    }

    // 3. 確認視窗
    const result = await useAlert.confirm(
      `準備撥款共 ${allocatedAmount.value} ${selectedCurrency.value}，確定發放？`,
    )

    if (result?.isConfirmed) {
      // 這裡就是你要傳送給後端的格式 [ {memberName: 'xxx', amount: 100}, ... ]
      console.log('準備傳送的派發清單:', distributionData)
      shareAll(distributionData)

    }
  }

  interface ShareMemberData {
    userName: string
    shareAmount: number
  }
  const shareAll = async (distributionData: ShareMemberData[]) => {
    try {
      const res = await fetch('https://api.gameshare-system.com/share-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency: selectedCurrency.value,
          shareAllData: distributionData,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      getAllMember()
      getAllBalance()
    } catch (e) {
      console.log(e)
    }
  }

  const memberList = ref<MemberResponse[]>([])

  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole: string
    memberAmount:number
  }

  const roleClassMap: Record<'MEMBER' | 'OFFICER' | 'LEADER', string> = {
    MEMBER: 'member',
    OFFICER: 'officer',
    LEADER: 'leader',
  }
  const getAllBalance = async () => {
    try {
      const res = await fetch('https://api.gameshare-system.com/getBalance', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        return
      }
      const data = await res.json()
      clanBalanceResponseList.value = data.clanBalanceResponseList
    } catch (e) {
      console.log(e)
    }
  }
  const getAllMember = async () => {
    const res = await fetch('https://api.gameshare-system.com/members', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })
    if (!res.ok) return
    memberList.value = await res.json()

    memberList.value.forEach((item) =>{
      if (item.memberRole == 'LEADER'){
        item.memberRole = '會長'
      }else if (item.memberRole == 'OFFICER'){
        item.memberRole = '幹部'
      }else {
        item.memberRole = '成員'
      }
    })
    clanBalanceResponseList.value = balance.clanBalanceList
  }


  onMounted(getAllBalance)
  onMounted(getAllMember)


  return {
    selectedCurrency,
    balance,
    getRemaining,
    clanBalanceResponseList,
    handleConfirm,
    allocatedAmount,
    totalFund,
    memberList,
    roleClassMap,
  }
}
