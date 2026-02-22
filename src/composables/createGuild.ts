import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

export function useAuction() {
  const authStore = useAuthStore()

  const form = ref({
    guildName: '',
    currencies: [] as string[],
    notice: '',
    creatorGameName: '', // 👈 這裡才是你真正要的
    account: '',
    password: '',
    email: '',
  })
  const router = useRouter()
  const newCurrency = ref('')

  const addCurrency = () => {
    if (!newCurrency.value) return

    const value = newCurrency.value.toUpperCase()
    if (form.value.currencies.includes(value)) return

    form.value.currencies.push(value)
    newCurrency.value = ''
  }

  const removeCurrency = (index: number) => {
    form.value.currencies.splice(index, 1)
  }

  const submit = () => {
      createClan()
  }

  const createClan = async () => {
    try {
      const res = await fetch('https://api.gameshare-system.com/create-clans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          announcement: form.value.account,
          clanName: form.value.guildName,
          clanLeaderName: form.value.creatorGameName,
          account: form.value.account,
          password: form.value.password,
          email: form.value.email,
          currencyList: [...form.value.currencies],
        }),
      })
      const data = await res.json()
      if (!res.ok){
        alert(data.message)
        return
      }
      authStore.setToken(data.authToken)
      authStore.setMember(data)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      alert(`登入成功\n血盟：${form.value.guildName}`)
      router.replace('/clan')

    } catch (e) {
      console.log(e)
    }
  }


  return {
    form,
    submit,
    newCurrency,
    removeCurrency,
    addCurrency
  }
}
