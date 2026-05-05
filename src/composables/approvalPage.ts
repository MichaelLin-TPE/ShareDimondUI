import {  onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'


export function useAuction() {

  const authStore = useAuthStore()
  const loading = ref(false)

  const getVerifyList = async () => {
    loading.value = true
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
      const res = await fetch('https://api.gameshare-system.com/getVerifyList', {
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          Sign: generateSignature(currentTimeStamp),
          TimeStamp: currentTimeStamp,
        },
      })
      if (!res.ok) return
      pendingRequests.value = await res.json()
    } catch (e) {
      console.error(e)
      useAlert.error('載入申請名單失敗,請稍後再試')
    } finally {
      loading.value = false
    }
  }

  interface MemberVerifyResponse {
    userName:string
    memberId:number
  }

  const pendingRequests = ref<MemberVerifyResponse[]>([])

  const handleApproval = async (id: number, action: 'APPROVE' | 'REJECT') => {
    try {
      if (action === 'APPROVE') {
        confirmIn(id)
      } else {
        confirmOut(id)
      }
    } catch (error) {
      useAlert.error('處理失敗：' + error)
    }
  }

  const confirmIn = async (memberId:number) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/confirm_in', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          memberId: memberId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      getVerifyList()
    } catch (e) {
      console.error(e)
    }
  }

  const confirmOut = async (memberId: number) => {
    try {
      const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/confirm_out', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
        },
        body: JSON.stringify({
          memberId: memberId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      getVerifyList()
    } catch (e) {
      console.error(e)
    }
  }

  onMounted(getVerifyList)


  return {
    authStore,
    pendingRequests,
    handleApproval,
    loading,
  }
}
