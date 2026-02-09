import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'

export function useAuction() {

  const balance = ref(1258450)
  const amount = ref()

  const authStore = useAuthStore()
  const selectedMemberId = ref('')
  const handleWithdraw = () => {
    withdraw();
  }

  const withdraw = async () => {
    try {
      const res = await fetch('https://gameshare-system.com/withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: selectedMemberId.value,
          amount: amount.value
        }),
      })
      const data = await res.json()
      alert(data.message)
    } catch (e) {
      console.log(e)
    }
  }

  onMounted(async () => {
    getAllMember()
  })
  const memberList = ref<MemberResponse[]>([])
  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole:string
  }

  const getAllMember = async () => {

    try {
      const res = await fetch('https://gameshare-system.com/members', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) {
        return
      }
      memberList.value = data

      memberList.value = memberList.value
        .filter((item) => item.memberRole === 'LEADER' || item.memberRole === 'OFFICER')
        .map((item) => ({
          ...item,
          memberRole: item.memberRole === 'LEADER' ? '會長' : '幹部',
        }))

    } catch (e) {
      console.log(e)
    }
  }




  return {
    balance,
    amount,
    selectedMemberId,
    memberList,
    getAllMember,
    handleWithdraw,
  }
}
