import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'


export function useAuction() {
  /** * 介面定義
   * 確保符合 GameShare 專案中 Java 後端傳回的 BigDecimal 與 String 結構
   */
  interface Wallet {
    balance: number
    currency: string
  }

  interface Member {
    userName: string
    userId: number
    memberWalletLists: Wallet[]
  }

  /** * Props 定義
   * 使用 withDefaults 確保即使 API 尚未回傳資料，畫面也不會崩潰
   */

  const memberList = ref<Member[]>([])
  const isLive = ref(true) // 模擬 WebSocket 即時連線狀態

  /**
   * 核心邏輯 1：動態提取所有幣種
   * 解決 walletList 長度不固定且順序不一的問題
   */
  const allCurrencies = computed(() => {
    const currencies = new Set<string>()
    memberList.value.forEach((user) => {
      user.memberWalletLists.forEach((w) => currencies.add(w.currency))
    })
    // 轉為陣列供 v-for 使用
    return Array.from(currencies)
  })

  /**
   * 核心邏輯 2：全體資產總和計算
   * 會長介面最重要的「查帳」功能，會隨成員資料動態累加
   */
  const totalStats = computed(() => {
    const stats: Record<string, number> = {}
    memberList.value.forEach((user) => {
      user.memberWalletLists.forEach((w) => {
        stats[w.currency] = (stats[w.currency] || 0) + w.balance
      })
    })
    return stats
  })

  /**
   * 取得特定成員的錢包數值
   * 若該成員缺少某種幣別的錢包，則回傳 0
   */
  const getRawBalance = (user: Member, currencyName: string): number => {
    const wallet = user.memberWalletLists.find((w) => w.currency === currencyName)
    return wallet ? wallet.balance : 0
  }

  /** 格式化數字為千分位字串 */
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  // 事件處理 (可對接後端 API 或 WebSocket)
  const openLog = (id: number) => console.log(`[GameShare] 查詢成員 ${id} 交易紀錄`)
  const editWallet = (user: Member) => console.log(`[GameShare] 調整管理：${user.userName}`)
  const authStore = useAuthStore()

  const getBasicInfo = async () => {
    const res = await fetch('https://api.gameshare-system.com/getAllMemberWallet', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })
    if (!res.ok) return
    const data = await res.json()
    memberList.value = data
  }


  onMounted(getBasicInfo)

  return {
    memberList,
    isLive,
    editWallet,
    openLog,
    formatNumber,
    getRawBalance,
    totalStats,
    allCurrencies,
  }
}
