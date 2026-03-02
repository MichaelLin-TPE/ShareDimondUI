import {  onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'


export function useAuction() {
  const authStore = useAuthStore()
  const announcement = ref('')
  const noticeItemList =  ref<String[]>([])

  const getBasicInfo = async () => {
    const res = await fetch('https://api.gameshare-system.com/getBasicInfo', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })
    if (!res.ok) return
    const data = await res.json()
    announcement.value = data.announcement
  }

  const getAllItemsBuyer = async () =>{
    const res = await fetch('https://api.gameshare-system.com/get-item-buyers', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
      },
    })

    if (!res.ok){
      return
    }
    const data: string[] = await res.json()
    noticeItemList.value = data
  }
  onMounted(getAllItemsBuyer)
  onMounted(getBasicInfo)


  return {
    authStore,
    announcement,
    noticeItemList,
  }
}
