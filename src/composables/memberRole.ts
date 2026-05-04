import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

export function useAuction() {
  const authStore = useAuthStore()

  const memberList = ref<MemberResponse[]>([])
  // 紀錄被修改過的成員 ID
  const changedMemberIds = ref(new Set<number>())

  interface MemberResponse {
    memberId: number
    memberName: string
    memberRole: 'MEMBER' | 'OFFICER' | 'LEADER'
  }

  const roleClassMap: Record<'MEMBER' | 'OFFICER' | 'LEADER', string> = {
    MEMBER: 'member',
    OFFICER: 'officer',
    LEADER: 'leader',
  }

  // 變更權限時，同步紀錄 ID
  const setRole = (member: MemberResponse, role: 'MEMBER' | 'OFFICER' | 'LEADER') => {
    if (member.memberRole !== role) {
      member.memberRole = role
      changedMemberIds.value.add(member.memberId)
    }
  }

  const sharedLists = useSharedListsStore()
  const getAllMember = async () => {
    // mutation 後 (updateRolesApi) 需強制重抓,平時 mount 用 cache
    await sharedLists.loadMembers()
    // clone (避免 setRole 在這裡 in-place 改動時汙染共享 store)
    memberList.value = sharedLists.members.map((item) => ({
      memberId: item.memberId,
      memberName: item.memberName,
      memberRole: item.memberRole as 'MEMBER' | 'OFFICER' | 'LEADER',
    }))
    // 重新取得資料後清空追蹤清單
    changedMemberIds.value.clear()
  }

  // 傳送至後端的方法（留空）
  const updateRolesApi = async (payload: { memberId: number; role: string }[]) => {
    // 這裡留給您對接 API，例如 axios.post('/api/roles', payload)
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/change-member-role', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
      body: JSON.stringify({
        memberRoleDataList: payload,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      return
    }
    useAlert.success(data.message)
    // role 改完後強制重抓 (其他頁面下次進入也拿到新 role)
    await sharedLists.refreshMembers()
    await getAllMember()
  }

  onMounted(getAllMember)

  return {
    memberList,
    setRole,
    roleClassMap,
    changedMemberIds,
    updateRolesApi,
  }
}
