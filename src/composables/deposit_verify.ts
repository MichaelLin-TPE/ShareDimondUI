import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const API = 'https://api.gameshare-system.com'

export function useAuction() {
  const totalAmount = ref(0)
  const loading = ref(false)
  const authStore = useAuthStore()

  const handleAction = (code: string, type: 'approve' | 'reject') => {
    if (type === 'approve') {
      confirmDeposit(code)
    } else {
      rejectDeposit(code)
    }
  }

  const rejectDeposit = async (code: string) => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/reject-deposit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({ ticketCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      getDepositHistory()
    } catch (e) {
      console.error(e)
      useAlert.error('操作失敗,請稍後再試')
    }
  }

  const confirmDeposit = async (code: string) => {
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/confirm-deposit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
        body: JSON.stringify({ ticketCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message)
        return
      }
      useAlert.success(data.message)
      getDepositHistory()
    } catch (e) {
      console.error(e)
      useAlert.error('操作失敗,請稍後再試')
    }
  }

  interface DepositHistory {
    requestAmount: string
    requestUserName: string
    ticketCode: string
    createTime: string
    remark: string
    currency: string
  }
  const depositHistoryList = ref<DepositHistory[]>([])

  const getDepositHistory = async () => {
    loading.value = true
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(`${API}/get-deposit-history-verify-list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
          Sign: generateSignature(ts),
          TimeStamp: ts,
        },
      })
      const data = await res.json()
      data.forEach((item: DepositHistory) => {
        item.remark = '申請儲值'
        item.createTime = formatDateTime(item.createTime)
      })
      depositHistoryList.value = data
      getTotalAmount()
    } catch (e) {
      console.error(e)
      useAlert.error('載入儲值列表失敗,請稍後再試')
    } finally {
      loading.value = false
    }
  }

  function formatDateTime(value: string): string {
    if (!value) return ''
    const date = new Date(value)
    const yyyy = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const HH = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`
  }

  function getTotalAmount() {
    let amount = 0
    depositHistoryList.value.forEach((item) => {
      amount += Number(item.requestAmount)
    })
    totalAmount.value = amount
  }

  onMounted(() => {
    getDepositHistory()
  })

  return {
    totalAmount,
    handleAction,
    depositHistoryList,
    loading,
  }
}
