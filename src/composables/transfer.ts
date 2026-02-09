import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'

export function useAuction() {
  const authStore = useAuthStore()
  const selectedMemberId = ref('')
  const inputAmount = ref(0)
  const handleTransfer = () => {
    transfer();
  }

  const transfer = async () =>{
    try {
      const res = await fetch('https://gameshare-system.com/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: selectedMemberId.value,
          amount : inputAmount.value
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

      memberList.value.forEach((item) => {
        if (item.memberRole == 'MEMBER'){
          item.memberRole = '會員'
        }else if (item.memberRole == 'LEADER'){
          item.memberRole = '會長'
        }else if (item.memberRole == 'OFFICER'){
          item.memberRole = '幹部'
        }
      })

    } catch (e) {
      console.log(e)
    }
  }




  return {
    inputAmount,
    selectedMemberId,
    memberList,
    getAllMember,
    handleTransfer,
  }
}
