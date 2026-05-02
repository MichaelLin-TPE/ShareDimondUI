import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { trackSignupConversion } from '@/utils/gads'

export function useAuction() {
  const authStore = useAuthStore()
  const router = useRouter()

  const form = ref({
    guildName: '',
    currencies: [] as string[],
    baseCurrency: '',
    exchangeRate: 0,
    creatorGameName: '',
    account: '',
    password: '',
    passwordConfirm: '',
    email: '',
    referralCode: '',
  })
  const newCurrency = ref('')
  const submitting = ref(false)

  const needExchangeRate = computed(() => form.value.currencies.length >= 2)

  const addCurrency = () => {
    const value = newCurrency.value.trim().toUpperCase()
    if (!value) return
    if (form.value.currencies.includes(value)) {
      useAlert.error(`「${value}」已在清單中`)
      return
    }
    form.value.currencies.push(value)
    newCurrency.value = ''
    // 第一個加入的幣別自動設為基準幣
    if (form.value.currencies.length === 1) {
      form.value.baseCurrency = value
    }
  }

  const removeCurrency = (index: number) => {
    const removed = form.value.currencies[index]
    form.value.currencies.splice(index, 1)
    // 若被移除的剛好是基準幣，重新指定第一個（或清空）
    if (removed === form.value.baseCurrency) {
      form.value.baseCurrency = form.value.currencies[0] ?? ''
    }
  }

  // 當幣別只剩 1 種時自動將其設為基準幣
  watch(
    () => form.value.currencies.length,
    (len) => {
      if (len === 1 && form.value.currencies[0]) {
        form.value.baseCurrency = form.value.currencies[0]
      }
    },
  )

  const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const validate = (): string | null => {
    if (!form.value.guildName.trim()) return '請輸入公會名稱'
    if (!form.value.creatorGameName.trim()) return '請輸入會長遊戲名稱'
    if (form.value.currencies.length === 0) return '請至少新增一種分紅幣別'
    if (!form.value.baseCurrency) return '請選擇基準幣種'
    if (needExchangeRate.value && (!form.value.exchangeRate || form.value.exchangeRate <= 0)) {
      return '請輸入有效的匯率（須大於 0）'
    }
    if (!form.value.account.trim()) return '請輸入帳號'
    if (!form.value.password) return '請輸入密碼'
    if (form.value.password.length < 6) return '密碼至少需 6 碼'
    if (form.value.password !== form.value.passwordConfirm) return '兩次密碼輸入不一致'
    if (!form.value.email.trim()) return '請輸入電子郵件'
    if (!isEmail(form.value.email)) return '電子郵件格式錯誤'
    return null
  }

  const submit = async () => {
    const errMsg = validate()
    if (errMsg) {
      useAlert.error(errMsg)
      return
    }
    await createClan()
  }

  const createClan = async () => {
    submitting.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/create-clans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
        body: JSON.stringify({
          // 後端目前要求公告非空：帶預設值，會長進入後可在血盟設置中修改
          announcement: '歡迎加入！可在血盟設置中修改公會公告。',
          clanName: form.value.guildName.trim(),
          clanLeaderName: form.value.creatorGameName.trim(),
          account: form.value.account.trim(),
          password: form.value.password,
          email: form.value.email.trim(),
          currencyList: [...form.value.currencies],
          baseCurrency: form.value.baseCurrency,
          exchangeRate: needExchangeRate.value ? form.value.exchangeRate : 1,
          referralCode: form.value.referralCode.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      authStore.setToken(data.authToken)
      authStore.setMember(data)

      // 🎯 Google Ads 轉換追蹤 — 建立血盟成功 = 註冊試用
      // 用 clanId 當 transaction_id 防止重複計算
      trackSignupConversion(2000, 'TWD', data.clanId)

      await new Promise((resolve) => setTimeout(resolve, 1000))
      useAlert.success(`血盟「${form.value.guildName}」建立成功！`)
      router.replace('/clan')
    } catch (e) {
      console.log(e)
      useAlert.error('建立失敗，請稍後再試')
    } finally {
      submitting.value = false
    }
  }

  return {
    form,
    submit,
    submitting,
    newCurrency,
    removeCurrency,
    addCurrency,
    needExchangeRate,
  }
}
