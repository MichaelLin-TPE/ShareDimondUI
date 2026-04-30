import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

export function useAuction() {
  const authStore = useAuthStore()
  const selectedMemberId = ref('')
  const inputAmount = ref(0)
  const submitting = ref(false)
  const handleTransfer = () => {
    transfer()
  }
  const selectedCurrency = ref('')
  const transfer = async () => {
    if (submitting.value) return
    submitting.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          memberId: selectedMemberId.value,
          amount: inputAmount.value,
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
      console.log(e)
    } finally {
      submitting.value = false
    }
  }
  const balance = useBalanceStore()
  onMounted(async () => {
    getAllMember()
    ensureBalance()
  })

  // F5 後 pinia state 重置會導致 balanceList 為空 → 補抓一次
  const ensureBalance = async () => {
    if (balance.balanceList.length > 0) return
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/getBalance', {
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
      balance.setBalanceList(data.memberBalanceResponseList ?? [])
      balance.setClanBalanceList(data.clanBalanceResponseList ?? [])
    } catch (e) {
      console.log(e)
    }
  }
  const memberList = ref<MemberResponse[]>([])
  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole: string
  }

  const getAllMember = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/members', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        return
      }
      memberList.value = data

      memberList.value.forEach((item) => {
        if (item.memberRole == 'MEMBER') {
          item.memberRole = '會員'
        } else if (item.memberRole == 'LEADER') {
          item.memberRole = '會長'
        } else if (item.memberRole == 'OFFICER') {
          item.memberRole = '幹部'
        }
      })
    } catch (e) {
      console.log(e)
    }
  }

  return {
    selectedCurrency,
    balance,
    inputAmount,
    selectedMemberId,
    memberList,
    getAllMember,
    handleTransfer,
    submitting,
  }
}
