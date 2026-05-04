import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const API = 'https://api.gameshare-system.com'

export type RoleFilter = 'ALL' | 'LEADER' | 'OFFICER' | 'MEMBER'

export interface MemberData {
  memberId: number
  memberName: string
  memberRole: string
}

export function useAuction() {
  const authStore = useAuthStore()

  const memberList = ref<MemberData[]>([])
  const searchQuery = ref('')
  const selectedRole = ref<RoleFilter>('ALL')
  const showModal = ref(false)
  const selectedMember = ref<MemberData>()
  const loading = ref(false)

  const roleLabels: Record<string, string> = {
    LEADER: '會長',
    OFFICER: '幹部',
    MEMBER: '成員',
  }

  const headers = (ts: string) => ({
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  })

  // 統計：四種角色人數
  const stats = computed(() => ({
    total: memberList.value.length,
    leader: memberList.value.filter((m) => m.memberRole === 'LEADER').length,
    officer: memberList.value.filter((m) => m.memberRole === 'OFFICER').length,
    member: memberList.value.filter((m) => m.memberRole === 'MEMBER').length,
  }))

  // 篩選與搜尋
  const filteredMembers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    return memberList.value.filter((m) => {
      if (selectedRole.value !== 'ALL' && m.memberRole !== selectedRole.value) return false
      if (q && !m.memberName.toLowerCase().includes(q)) return false
      return true
    })
  })

  const confirmKick = (member: MemberData) => {
    selectedMember.value = member
    showModal.value = true
  }

  const sharedLists = useSharedListsStore()
  const fetchMembers = async () => {
    loading.value = true
    try {
      await sharedLists.loadMembers()
      // clone (避免日後操作汙染共享 store)
      memberList.value = sharedLists.members.map((item) => ({
        memberId: item.memberId,
        memberName: item.memberName,
        memberRole: item.memberRole,
      }))
    } catch (e) {
      console.log(e)
    } finally {
      loading.value = false
    }
  }

  const handleKick = async () => {
    if (!selectedMember.value) return
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/removeMember`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          userId: selectedMember.value.memberId,
        }),
      })
      const data = await res.json()
      showModal.value = false
      if (res.ok) {
        useAlert.success(data.message)
        // 踢人成功後強制重抓 (其他頁面下次進入也拿到最新名單)
        await sharedLists.refreshMembers()
        await fetchMembers()
      } else {
        useAlert.error(data.message)
      }
    } catch (e) {
      console.error(e)
    }
  }

  onMounted(fetchMembers)

  return {
    roleLabels,
    searchQuery,
    selectedRole,
    showModal,
    confirmKick,
    selectedMember,
    filteredMembers,
    handleKick,
    memberList,
    stats,
    loading,
  }
}
