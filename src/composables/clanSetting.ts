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

  // ───── 血盟改名 ─────
  const clanNameInput = ref<string>(authStore.member?.clanName ?? '')
  const savingClanName = ref(false)

  const handleSaveClanName = async (): Promise<boolean> => {
    const newName = clanNameInput.value.trim()
    if (!newName) {
      useAlert.error('請輸入血盟名稱')
      return false
    }
    if (newName.length < 2 || newName.length > 30) {
      useAlert.error('血盟名稱長度需在 2 - 30 字之間')
      return false
    }
    const currentName = authStore.member?.clanName ?? ''
    if (newName === currentName) {
      useAlert.error('新名稱跟原本相同')
      return false
    }
    const confirm = await useAlert.confirm(
      `確定把血盟改名為「${newName}」嗎?\n(原:${currentName})`,
    )
    if (!confirm?.isConfirmed) return false

    savingClanName.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/updateClanName`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ newName }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '改名失敗')
        return false
      }
      useAlert.success(data.message ?? '已改名')
      // 同步 authStore.member.clanName,讓側邊欄 / 標題等顯示處即時更新
      if (authStore.member) {
        authStore.setMember({ ...authStore.member, clanName: newName })
      }
      return true
    } catch (e) {
      console.error(e)
      useAlert.error('改名失敗,請稍後再試')
      return false
    } finally {
      savingClanName.value = false
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

  // ───── 拉霸機設定 ─────
  const slotConfig = ref({
    currency: '',
    enabled: true,
    betAmount: 10,
    rakeRate: 0.02,
    maxPayout: 1000000,
    rtp: 0,
    houseEdge: 0,
  })
  const slotSaving = ref(false)

  const fetchSlotConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/slot/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      slotConfig.value = {
        currency: d.currency ?? '',
        enabled: d.enabled,
        betAmount: Number(d.betAmount),
        rakeRate: Number(d.rakeRate),
        maxPayout: Number(d.maxPayout),
        rtp: Number(d.rtp),
        houseEdge: Number(d.houseEdge),
      }
    } catch (e) {
      console.error(e)
    }
  }

  const saveSlotConfig = async () => {
    if (slotSaving.value) return
    // 前端先擋：彩金池抽水 0~0.1 (0~10%)
    if (slotConfig.value.rakeRate < 0 || slotConfig.value.rakeRate > 0.1) {
      useAlert.error('彩金池抽水比例必須介於 0 ~ 10%')
      return
    }
    if (!slotConfig.value.betAmount || slotConfig.value.betAmount <= 0) {
      useAlert.error('每次下注額必須大於 0')
      return
    }
    slotSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/slot/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          enabled: slotConfig.value.enabled,
          betAmount: slotConfig.value.betAmount,
          rakeRate: slotConfig.value.rakeRate,
          maxPayout: slotConfig.value.maxPayout,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      slotConfig.value.rtp = Number(d.rtp)
      slotConfig.value.houseEdge = Number(d.houseEdge)
      useAlert.success('拉霸機設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      slotSaving.value = false
    }
  }

  // ───── 骰寶設定 (共用拉霸的 betAmount/rake/maxPayout,只多一個開關) ─────
  const diceEnabled = ref(false)
  const diceSaving = ref(false)

  const fetchDiceConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/dice/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      diceEnabled.value = !!d.enabled
    } catch (e) {
      console.error(e)
    }
  }

  const saveDiceConfig = async () => {
    if (diceSaving.value) return
    diceSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/dice/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ enabled: diceEnabled.value }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '骰寶設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      diceSaving.value = false
    }
  }

  // ───── 輪盤設定 (共用拉霸的 betAmount/rake/maxPayout,只多一個開關) ─────
  const rouletteEnabled = ref(false)
  const rouletteSaving = ref(false)

  const fetchRouletteConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/roulette/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      rouletteEnabled.value = !!d.enabled
    } catch (e) {
      console.error(e)
    }
  }

  const saveRouletteConfig = async () => {
    if (rouletteSaving.value) return
    rouletteSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/roulette/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ enabled: rouletteEnabled.value }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '輪盤設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      rouletteSaving.value = false
    }
  }

  // ───── 十三支設定 (共用底注/抽水/彩金池,只多一個開關) ─────
  const thirteenEnabled = ref(false)
  const thirteenSaving = ref(false)

  const fetchThirteenConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/thirteen/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      thirteenEnabled.value = !!d.enabled
    } catch (e) {
      console.error(e)
    }
  }

  const saveThirteenConfig = async () => {
    if (thirteenSaving.value) return
    thirteenSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/thirteen/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ enabled: thirteenEnabled.value }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '十三支設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      thirteenSaving.value = false
    }
  }

  // ───── 妞妞設定 (共用最小注/抽水/彩金池,只多一個開關) ─────
  const niuniuEnabled = ref(false)
  const niuniuSaving = ref(false)

  const fetchNiuNiuConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/niuniu/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      niuniuEnabled.value = !!d.enabled
    } catch (e) {
      console.error(e)
    }
  }

  const saveNiuNiuConfig = async () => {
    if (niuniuSaving.value) return
    niuniuSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/niuniu/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ enabled: niuniuEnabled.value }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '妞妞設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      niuniuSaving.value = false
    }
  }

  // ───── 刮刮樂設定 (共用抽水/彩金池,只多一個開關) ─────
  const scratchEnabled = ref(false)
  const scratchSaving = ref(false)

  const fetchScratchConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/scratch/config`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      scratchEnabled.value = !!d.enabled
    } catch (e) {
      console.error(e)
    }
  }

  const saveScratchConfig = async () => {
    if (scratchSaving.value) return
    scratchSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/scratch/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({ enabled: scratchEnabled.value }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '刮刮樂設定已儲存')
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      scratchSaving.value = false
    }
  }

  // ───── 德州撲克設定 (共用抽水/彩金池;開關 + 盲注/買入) ─────
  const holdemEnabled = ref(false)
  const holdemSaving = ref(false)
  const holdemSb = ref(10)
  const holdemBb = ref(20)
  const holdemMinBuyIn = ref(400)
  const holdemMaxBuyIn = ref(4000)

  const fetchHoldemConfig = async () => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/holdem/state`, { headers: headers(ts) })
      if (!res.ok) return
      const d = await res.json()
      holdemEnabled.value = !!d.enabled
      holdemSb.value = Number(d.smallBlind ?? 10)
      holdemBb.value = Number(d.bigBlind ?? 20)
      holdemMinBuyIn.value = Number(d.minBuyIn ?? 400)
      holdemMaxBuyIn.value = Number(d.maxBuyIn ?? 4000)
    } catch (e) {
      console.error(e)
    }
  }

  const saveHoldemConfig = async () => {
    if (holdemSaving.value) return
    // 前端先擋明顯不合理值(後端也會再驗一次)
    if (holdemSb.value <= 0 || holdemBb.value <= 0 || holdemBb.value < holdemSb.value) {
      useAlert.error('大盲需 ≥ 小盲,且都要大於 0')
      return
    }
    if (holdemMinBuyIn.value <= 0 || holdemMaxBuyIn.value < holdemMinBuyIn.value) {
      useAlert.error('最大買入不可小於最小買入')
      return
    }
    holdemSaving.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/holdem/config`, {
        method: 'POST',
        headers: headers(ts),
        body: JSON.stringify({
          enabled: holdemEnabled.value,
          smallBlind: Math.floor(holdemSb.value),
          bigBlind: Math.floor(holdemBb.value),
          minBuyIn: Math.floor(holdemMinBuyIn.value),
          maxBuyIn: Math.floor(holdemMaxBuyIn.value),
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        useAlert.error(d.message ?? '儲存失敗')
        return
      }
      useAlert.success(d.message ?? '德州撲克設定已儲存')
      fetchHoldemConfig()
    } catch (e) {
      console.error(e)
      useAlert.error('連線失敗,請稍後再試')
    } finally {
      holdemSaving.value = false
    }
  }

  onMounted(() => {
    getBasicInfo()
    fetchBalance()
    fetchClanCurrencies()
    fetchDiscordWebhook()
    fetchSlotConfig()
    fetchDiceConfig()
    fetchRouletteConfig()
    fetchThirteenConfig()
    fetchNiuNiuConfig()
    fetchScratchConfig()
    fetchHoldemConfig()
  })

  return {
    // 拉霸機
    slotConfig,
    slotSaving,
    saveSlotConfig,
    // 骰寶
    diceEnabled,
    diceSaving,
    saveDiceConfig,
    // 輪盤
    rouletteEnabled,
    rouletteSaving,
    saveRouletteConfig,
    // 十三支
    thirteenEnabled,
    thirteenSaving,
    saveThirteenConfig,
    // 妞妞
    niuniuEnabled,
    niuniuSaving,
    saveNiuNiuConfig,
    // 刮刮樂
    scratchEnabled,
    scratchSaving,
    saveScratchConfig,
    // 德州撲克
    holdemEnabled,
    holdemSaving,
    holdemSb,
    holdemBb,
    holdemMinBuyIn,
    holdemMaxBuyIn,
    saveHoldemConfig,
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
    // 血盟改名
    clanNameInput,
    savingClanName,
    handleSaveClanName,
    // 血盟清 0
    resetting,
    handleResetClan,
  }
}
