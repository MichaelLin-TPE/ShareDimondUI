import {  onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts' // 延續你的 Alert 工具

export function useAuction() {
  const authStore = useAuthStore()

  const balance = useBalanceStore()
  const settings = ref({
    announcement: '',
    participationMinutes: 0,
    auctionMinutes: 0,
    fundPercentage: 0,
    autoDecideWinner: false,
    addRemark:'',
    minusRemark:'',
    addClanBalance:0,
    minusClanBalance:0
  })
  const selectedCurrency = ref('')

  const handleSave = async () => {
    try {
      const res = await fetch('https://api.gameshare-system.com/updateClanBasicInfo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
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
      console.log(e)
    }
  }

  const requestUpdateClanBalanceAdd = async ()=>{
        try {
          const res = await fetch('https://api.gameshare-system.com/updateClanBalanceAdd', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authStore.authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clanBalance: settings.value.addClanBalance,
              remark: settings.value.addRemark,
              currency:selectedCurrency.value
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            useAlert.error(data.message)
            return
          }
          useAlert.success(data.message)
          settings.value.addClanBalance = 0
          settings.value.addRemark = ''
          if (settings.value.minusClanBalance != 0){
            requestUpdateClanBalanceMinus()
          }
      }catch (e){
        console.log(e)
      }
  }

    const requestUpdateClanBalanceMinus = async ()=>{
        try {
          const res = await fetch('https://api.gameshare-system.com/updateClanBalanceMinus', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authStore.authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              currency:selectedCurrency.value,
              clanBalance: settings.value.minusClanBalance,
              remark: settings.value.minusRemark,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            useAlert.error(data.message)
            return
          }
          useAlert.success(data.message)
          settings.value.minusClanBalance = 0
          settings.value.minusRemark = ''

        }catch (e){
          console.log(e)
        }
      }


  const handleUpdateBalance = async () => {

    if (selectedCurrency.value.length == 0){
      useAlert.error("請選擇幣別")
      return
    }
    if (settings.value.addClanBalance != 0){
      requestUpdateClanBalanceAdd()
      return
    }
    if (settings.value.minusClanBalance != 0){
      requestUpdateClanBalanceMinus()
    }
  }

  const getBasicInfo = async () => {
    const res = await fetch('https://api.gameshare-system.com/getClanBasicInfo', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })
    if (!res.ok) return
    const data = await res.json()
    settings.value.announcement = data.announcement
    settings.value.autoDecideWinner = data.isFixedAmountTicketWinnerRandom
    settings.value.fundPercentage = data.shareAmountPercent
    settings.value.auctionMinutes = data.biddingMins
    settings.value.participationMinutes = data.joinMins
  }


  onMounted(getBasicInfo)


  return {
    handleUpdateBalance,
    selectedCurrency,
    balance,
    authStore,
    handleSave,
    settings,
  }
}
