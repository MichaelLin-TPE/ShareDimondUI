import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'

export function useAuction() {
  const authStore = useAuthStore()
  const balance = useBalanceStore()
  const totalFund = ref(50000)
  const clanBalanceResponseList = balance.clanBalanceList
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
    // 找到元寶的帳戶進行檢查
    const yuanBao = balance.clanBalanceList.find((b) => b.currency === '元寶')
    const currentTotal = yuanBao ? Number(yuanBao.balance) : 0

    if (allocatedAmount.value > currentTotal) {
      useAlert.error(`發放總額 (${allocatedAmount.value}) 不能超過現有元寶 (${currentTotal})！`)
      return
    }

    const result = await useAlert.confirm(`準備撥款共 ${allocatedAmount.value} 元寶，確定發放？`)
    if (result?.isConfirmed) {
      // 呼叫 API...
      useAlert.success('💰 基金撥款成功！')
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

  }

  // 傳送至後端的方法（留空）
  const updateRolesApi = async (payload: { memberId: number; role: string }[]) => {
    // 這裡留給您對接 API，例如 axios.post('/api/roles', payload)
    const res = await fetch('https://api.gameshare-system.com/change-member-role', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        memberRoleDataList: payload,
      }),
    })
    const data = await res.json()
    if (!res.ok){
      useAlert.error(data.message)
      return
    }
    useAlert.success(data.message)
    getAllMember()

  }


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
    updateRolesApi,
  }
}
