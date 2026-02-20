import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useAuction() {
  const authStore = useAuthStore()

  const memberList = ref<MemberResponse[]>([])

  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole: 'MEMBER' | 'OFFICER' | 'LEADER'
  }


  const roleLabels: Record<'MEMBER' | 'OFFICER' | 'LEADER', string> = {
    MEMBER: '會員',
    OFFICER: '幹部',
    LEADER: '會長',
  }

  const roleClassMap: Record<'MEMBER' | 'OFFICER' | 'LEADER', string> = {
    MEMBER: 'member',
    OFFICER: 'officer',
    LEADER: 'leader',
  }


  const setRole = (member: MemberResponse, role: 'MEMBER' | 'OFFICER' | 'LEADER') => {
    member.memberRole = role
  }


  const getAllMember = async () => {
    const res = await fetch('https://gameshare-system.com/members', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })
    if (!res.ok) return
    memberList.value = await res.json()
  }

  onMounted(getAllMember)

  return {
    memberList,
    setRole,
    roleClassMap,
  }
}
