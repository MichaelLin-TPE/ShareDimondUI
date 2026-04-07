import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'


export function useAuction() {
  /** * 介面定義
   * 確保符合 GameShare 專案中 Java 後端傳回的 BigDecimal 與 String 結構
   */
  interface MemberData {
    memberId: number
    memberName: string
    memberRole:string
  }
  const searchQuery = ref('')
  const showModal = ref(false)
  const selectedMember = ref<MemberData>()

  // 獲取成員清單 (這裡可以複用你之前的 getAllMemberWallet 或專門的成員 API)
  const fetchMembers = async () => {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/getAllMembers', {
      headers: { Authorization: `Bearer ${authStore.authToken}`, Sign: generateSignature(currentTimeStamp),TimeStamp:currentTimeStamp },
    })
    if (res.ok) memberList.value = await res.json()
  }

  const filteredMembers = computed(() => {
    return memberList.value.filter((m:MemberData) =>
      m.memberName.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
  })

  const confirmKick = (member:MemberData) => {
    selectedMember.value = member
    showModal.value = true
  }
  const roleLabels: Record<string, string> = {
    LEADER: '會長',
    OFFICER: '幹部',
    MEMBER: '成員',
  }
  /** * Props 定義
   * 使用 withDefaults 確保即使 API 尚未回傳資料，畫面也不會崩潰
   */

  const memberList = ref<MemberData[]>([])

  const authStore = useAuthStore()

  const getBasicInfo = async () => {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/members', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
    })
    if (!res.ok) return
    const data = await res.json()
    memberList.value = data
  }

  const handleKick = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/removeMember', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.authToken}`,
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          userId: selectedMember.value?.memberId,
        }),
      })

      const data = await res.json()
      showModal.value = false
      if (res.ok) {
        useAlert.success(data.message)
        fetchMembers() // 重新整理清單
      } else {
        useAlert.error(data.message)
      }
    } catch (e) {
      console.error(e)
    }
  }


  onMounted(getBasicInfo)

  return {
    roleLabels,
    searchQuery,
    showModal,
    confirmKick,
    selectedMember,
    filteredMembers,
    handleKick,
    memberList,
  }
}
