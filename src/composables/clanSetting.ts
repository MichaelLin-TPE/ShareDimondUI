import {  onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts' // 延續你的 Alert 工具

export function useAuction() {
  const authStore = useAuthStore()


  const settings = ref({
    announcement: '',
    participationMinutes: 0,
    auctionMinutes: 0,
    fundPercentage: 0,
    autoDecideWinner: false,
  })

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
    authStore,
    handleSave,
    settings,
  }
}
