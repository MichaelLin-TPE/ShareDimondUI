import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import type { Balance } from '@/types/balance.ts'
import { generateSignature } from '@/utils/SignTools.ts'

interface MemberResponse {
  memberId: number
  memberName: string
  memberRole: string
  memberAmount: number
}

interface ShareMemberData {
  userName: string
  shareAmount: number
}

export function useAuction() {
  const authStore = useAuthStore()
  const balance = useBalanceStore()
  const clanBalanceResponseList = ref<Balance[]>([])
  const selectedCurrency = ref('')
  const searchQuery = ref('')
  const memberList = ref<MemberResponse[]>([])

  const allocatedAmount = computed(() =>
    memberList.value.reduce((sum, m) => sum + (Number(m.memberAmount) || 0), 0),
  )

  const selectedCurrencyBalance = computed(() => {
    const b = balance.clanBalanceList.find((x) => x.currency === selectedCurrency.value)
    return b ? Number(b.balance) : 0
  })

  const remaining = computed(() => selectedCurrencyBalance.value - allocatedAmount.value)

  const progressPercent = computed(() => {
    if (selectedCurrencyBalance.value <= 0) return 0
    return Math.min(100, (allocatedAmount.value / selectedCurrencyBalance.value) * 100)
  })

  const isOverallocated = computed(() => remaining.value < 0)

  const filteredMembers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return memberList.value
    return memberList.value.filter((m) => m.memberName.toLowerCase().includes(q))
  })

  const groupedMembers = computed(() => {
    const order = ['會長', '幹部', '成員']
    const groups: Record<string, MemberResponse[]> = { 會長: [], 幹部: [], 成員: [] }
    for (const m of filteredMembers.value) {
      const key = groups[m.memberRole] ? m.memberRole : '成員'
      const bucket = groups[key]
      if (bucket) bucket.push(m)
    }
    return order
      .filter((r) => (groups[r]?.length ?? 0) > 0)
      .map((r) => ({ role: r, members: groups[r] ?? [] }))
  })

  const getRemaining = (item: { balance: string; currency: string }) => {
    if (selectedCurrency.value === item.currency) {
      return Number(item.balance) - allocatedAmount.value
    }
    return item.balance
  }

  // ───── 發放確認 ─────
  const handleConfirm = async () => {
    if (!selectedCurrency.value) {
      useAlert.error('請先選擇幣種')
      return
    }
    const currentAccount = balance.clanBalanceList.find(
      (b) => b.currency === selectedCurrency.value,
    )
    const currentTotal = currentAccount ? Number(currentAccount.balance) : 0

    if (allocatedAmount.value > currentTotal) {
      useAlert.error(
        `發放總額 (${allocatedAmount.value}) 不能超過現有${selectedCurrency.value} (${currentTotal})！`,
      )
      return
    }

    const distributionData: ShareMemberData[] = memberList.value
      .filter((m) => (Number(m.memberAmount) || 0) > 0)
      .map((m) => ({
        userName: m.memberName,
        shareAmount: Number(m.memberAmount),
      }))

    if (distributionData.length === 0) {
      useAlert.error('請至少輸入一位成員的發放金額！')
      return
    }

    const preview = distributionData
      .slice(0, 5)
      .map((d) => `• ${d.userName}：${d.shareAmount.toLocaleString()}`)
      .join('\n')
    const more = distributionData.length > 5 ? `\n...及其他 ${distributionData.length - 5} 人` : ''

    const result = await useAlert.confirm(
      `共 ${distributionData.length} 人撥款，總計 ${allocatedAmount.value.toLocaleString()} ${selectedCurrency.value}\n\n${preview}${more}\n\n確定發放？`,
    )

    if (result?.isConfirmed) {
      shareAll(distributionData)
    }
  }

  const shareAll = async (distributionData: ShareMemberData[]) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/share-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
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
      memberList.value.forEach((m) => (m.memberAmount = 0))
      getAllMember()
      getAllBalance()
    } catch (e) {
      console.log(e)
    }
  }

  const roleClassMap: Record<'MEMBER' | 'OFFICER' | 'LEADER', string> = {
    MEMBER: 'member',
    OFFICER: 'officer',
    LEADER: 'leader',
  }

  const getAllBalance = async () => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/getBalance', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Accept: 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
      })
      if (!res.ok) return
      const data = await res.json()
      clanBalanceResponseList.value = data.clanBalanceResponseList
      // 同步寫入 Pinia store，避免直接重新整理本頁時 store 為空導致幣種按鈕消失
      balance.setBalanceList(data.memberBalanceResponseList)
      balance.setClanBalanceList(data.clanBalanceResponseList)
    } catch (e) {
      console.log(e)
    }
  }

  const sharedLists = useSharedListsStore()
  const getAllMember = async () => {
    await sharedLists.loadMembers()
    // clone + 變形 (不汙染共享 store 的 raw data)
    memberList.value = sharedLists.members.map((item) => ({
      memberId: item.memberId,
      memberName: item.memberName,
      memberRole:
        item.memberRole === 'LEADER'
          ? '會長'
          : item.memberRole === 'OFFICER'
            ? '幹部'
            : '成員',
      memberAmount: item.memberAmount ?? 0,
    }))
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
    memberList,
    roleClassMap,
    // 新增
    searchQuery,
    selectedCurrencyBalance,
    remaining,
    progressPercent,
    isOverallocated,
    groupedMembers,
  }
}
