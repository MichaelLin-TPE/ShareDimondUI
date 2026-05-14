import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const API = 'https://api.gameshare-system.com'

export interface ClanCurrency {
  currencyName: string
  currencyCode: string
  enabled: boolean
  baseCurrency: boolean
}

export function useAuction() {
  const authStore = useAuthStore()
  const balance = useBalanceStore()

  const settings = ref({
    announcement: '',
    participationMinutes: 0,
    auctionMinutes: 0,
    fundPercentage: 0,
    autoDecideWinner: false,
    addRemark: '',
    minusRemark: '',
    addClanBalance: 0,
    minusClanBalance: 0,
    baseCurrency: '',
    exchangeRate: 0,
  })
  const selectedCurrency = ref('')

  // 公積金調整：改成單一表單流程
  const balanceAction = ref<'add' | 'minus'>('add')
  const balanceAmount = ref<number>(0)
  const balanceRemark = ref<string>('')

  // 幣別列表
  const clanCurrencies = ref<ClanCurrency[]>([])

  const headers = (ts: string) => ({
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  })

  // ───── 基本資訊 ─────
  const handleSave = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/updateClanBasicInfo`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          announcement: settings.value.announcement,
          joinMins: settings.value.participationMinutes,
          biddingMins: settings.value.auctionMinutes,
          isFixedAmountTicketWinnerRandom: settings.value.autoDecideWinner,
          shareAmountPercent: settings.value.fundPercentage,
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
    }
  }

  // ───── 基準幣與匯率 ─────
  const handleSaveRate = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/updateClanBaseCurrencyAndRate`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          baseCurrency: settings.value.baseCurrency,
          exchangeRate: settings.value.exchangeRate,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      // 重新拉幣別清單，更新 baseCurrency 標記
      fetchClanCurrencies()
    } catch (e) {
      console.error(e)
    }
  }

  // ───── 幣別清單 ─────
  const fetchClanCurrencies = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/clan-currencies`, {
        method: 'GET',
        headers: headers(ts),
      })
      if (!res.ok) return
      const data = await res.json()
      // 後端 isBaseCurrency 在 JSON 中會變成 baseCurrency（Jackson 預設行為）
      clanCurrencies.value = data
    } catch (e) {
      console.error(e)
    }
  }

  const toggleCurrency = async (item: ClanCurrency) => {
    const willEnable = !item.enabled
    if (!willEnable) {
      const result = await useAlert.confirm(
        `確定要關閉「${item.currencyName}」幣別嗎？\n關閉後成員將無法在新的開單、轉帳等操作中使用此幣別（既有餘額不會被刪除）`,
      )
      if (!result?.isConfirmed) return
    }
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/toggle-currency`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          currencyName: item.currencyName,
          enabled: willEnable,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      item.enabled = willEnable
    } catch (e) {
      console.error(e)
    }
  }

  // ───── 公積金調整 ─────
  const handleUpdateBalance = async () => {
    if (!selectedCurrency.value) return useAlert.error('請選擇幣別')
    if (balanceAmount.value <= 0) return useAlert.error('請輸入大於 0 的金額')
    if (!balanceRemark.value.trim()) return useAlert.error('請輸入調整原因')

    const path = balanceAction.value === 'add' ? '/updateClanBalanceAdd' : '/updateClanBalanceMinus'
    const verb = balanceAction.value === 'add' ? '增加' : '扣除'
    const result = await useAlert.confirm(
      `確定要從「${selectedCurrency.value}」金庫${verb} ${balanceAmount.value.toLocaleString()} 嗎？`,
    )
    if (!result?.isConfirmed) return

    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          currency: selectedCurrency.value,
          clanBalance: balanceAmount.value,
          remark: balanceRemark.value,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      balanceAmount.value = 0
      balanceRemark.value = ''
    } catch (e) {
      console.error(e)
    }
  }

  // ───── 初始載入 ─────
  const getBasicInfo = async () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(`${API}/getClanBasicInfo`, {
      method: 'GET',
      headers: headers(ts),
    })
    if (!res.ok) return
    const data = await res.json()
    settings.value.announcement = data.announcement
    settings.value.autoDecideWinner = data.isFixedAmountTicketWinnerRandom
    settings.value.fundPercentage = data.shareAmountPercent
    settings.value.auctionMinutes = data.biddingMins
    settings.value.participationMinutes = data.joinMins
    settings.value.baseCurrency = data.baseCurrency
    settings.value.exchangeRate = data.exchangeRate
  }

  // 從 /getBalance 同步 store，避免直接重新整理本頁時 store 為空
  const fetchBalance = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/getBalance`, {
        method: 'GET',
        headers: headers(ts),
      })
      if (!res.ok) return
      const data = await res.json()
      balance.setBalanceList(data.memberBalanceResponseList)
      balance.setClanBalanceList(data.clanBalanceResponseList)
    } catch (e) {
      console.error(e)
    }
  }

  // ───── 血盟清 0 (危險區) ─────
  const resetting = ref(false)

  const handleResetClan = async (confirmClanName: string): Promise<boolean> => {
    resetting.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/clan/reset`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ confirmClanName }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '清 0 失敗')
        return false
      }
      useAlert.success(data.message ?? '血盟清 0 完成')
      return true
    } catch (e) {
      console.error(e)
      useAlert.error('清 0 失敗,請稍後再試')
      return false
    } finally {
      resetting.value = false
    }
  }

  // ───── Discord webhook ─────
  const discordWebhookUrl = ref<string>('')
  const discordSaving = ref(false)
  const discordTesting = ref(false)

  const fetchDiscordWebhook = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/discord-webhook`, { method: 'GET', headers: headers(ts) })
      if (!res.ok) return
      const data = (await res.json()) as { discordWebhookUrl: string | null }
      discordWebhookUrl.value = data.discordWebhookUrl ?? ''
    } catch (e) {
      console.error(e)
    }
  }

  const saveDiscordWebhook = async () => {
    discordSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/discord-webhook`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ discordWebhookUrl: discordWebhookUrl.value.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '儲存失敗')
        return
      }
      useAlert.success(data.message ?? '已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('儲存失敗,請稍後再試')
    } finally {
      discordSaving.value = false
    }
  }

  const testDiscordWebhook = async () => {
    discordTesting.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/discord-webhook/test`, { method: 'POST', headers: headers(ts) })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '測試失敗')
        return
      }
      useAlert.success(data.message ?? '已送出,去 Discord 看看')
    } catch (e) {
      console.error(e)
      useAlert.error('測試失敗,請稍後再試')
    } finally {
      discordTesting.value = false
    }
  }

  onMounted(() => {
    getBasicInfo()
    fetchBalance()
    fetchClanCurrencies()
    fetchDiscordWebhook()
  })

  return {
    settings,
    balance,
    selectedCurrency,
    handleSave,
    handleSaveRate,
    handleUpdateBalance,
    // 幣別管理
    clanCurrencies,
    fetchClanCurrencies,
    toggleCurrency,
    // 公積金調整
    balanceAction,
    balanceAmount,
    balanceRemark,
    // Discord
    discordWebhookUrl,
    discordSaving,
    discordTesting,
    saveDiscordWebhook,
    testDiscordWebhook,
    // 血盟清 0
    resetting,
    handleResetClan,
  }
}
