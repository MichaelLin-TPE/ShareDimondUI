import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const API = 'https://api.gameshare-system.com'

export function useAuction() {
  const amount = ref()
  const balanceTool = useBalanceStore()
  const authStore = useAuthStore()
  const selectedMemberId = ref('')
  const selectedCurrency = ref('')
  const submitting = ref(false)

  const handleDeposit = () => {
    deposit()
  }

  const deposit = async () => {
    if (submitting.value) return
    submitting.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/deposit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({
          memberId: selectedMemberId.value,
          amount: amount.value,
          currency: selectedCurrency.value,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
    } catch (e) {
      console.error(e)
    } finally {
      submitting.value = false
    }
  }

  // F5 後 pinia state 重置會導致 balanceList 為空 → 補抓一次
  const ensureBalance = async () => {
    if (balanceTool.balanceList.length > 0) return
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/getBalance`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      balanceTool.setBalanceList(data.memberBalanceResponseList ?? [])
      balanceTool.setClanBalanceList(data.clanBalanceResponseList ?? [])
    } catch (e) {
      console.error(e)
    }
  }

  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole: string
  }
  const memberList = ref<MemberResponse[]>([])

  const sharedLists = useSharedListsStore()
  const getAllMember = async () => {
    try {
      await sharedLists.loadMembers()
      memberList.value = sharedLists.members
        .filter((item) => item.memberRole === 'LEADER' || item.memberRole === 'OFFICER')
        .map((item) => ({
          ...item,
          memberRole: item.memberRole === 'LEADER' ? '會長' : '幹部',
        }))
    } catch (e) {
      console.error(e)
    }
  }

  onMounted(async () => {
    getAllMember()
    ensureBalance()
  })

  return {
    selectedCurrency,
    balanceTool,
    amount,
    selectedMemberId,
    memberList,
    getAllMember,
    handleDeposit,
    submitting,
  }
}
