import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'

export function useAuction() {


  const mockRequests = [
    { id: 1, name: '宮城良田', amount: 50000, memo: '購買攻城藥水', time: '10 分鐘前' },
    { id: 2, name: '櫻木花道', amount: 1200, memo: '修理裝備費用', time: '25 分鐘前' },
    { id: 3, name: '流川楓', amount: 800000, memo: '分紅提取', time: '1 小時前' },
  ]
  const totalAmount = ref(0)
  const handleAction = (code: string, type: 'approve' | 'reject') => {
    const actionText = type === 'approve' ? '核准' : '駁回'
    console.log(actionText)
    if (actionText == '核准'){
        confirmWithdraw(code)
    }else {
        rejectWithdraw(code)
    }
  }
  const rejectWithdraw = async (code: string) => {
    try {
      const res = await fetch('https://gameshare-system.com/reject-withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketCode: code,
        }),
      })
      const data = await res.json()
      alert(data.message)
      getWithdrawHistory()
    } catch (e) {
      console.error(e)
    }
  }
  const confirmWithdraw = async (code: string) => {
    try {
      const res = await fetch('https://gameshare-system.com/confirm-withdraw', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketCode: code
        }),
      })
      const data = await res.json()
      alert(data.message)
      getWithdrawHistory()
    } catch (e) {
      console.error(e)
    }
  }


  const balance = ref(1258450)
  const amount = ref()

  const authStore = useAuthStore()
  const selectedMemberId = ref('')
  const handleWithdraw = () => {
    getWithdrawHistory();
  }

  const getWithdrawHistory = async () => {
    try {
      const res = await fetch('https://gameshare-system.com/get-withdraw-history-verify-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authStore.authToken}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      data.forEach((item:WithdrawHistory) => {
          item.remark = '申請提款'
          item.createTime = formatDateTime(item.createTime)
        })
      withdrawHistoryList.value = data
      getTotalAmount()
    } catch (e) {
      console.log(e)
    }
  }

  onMounted(async () => {
    getWithdrawHistory()
  })
  const withdrawHistoryList = ref<WithdrawHistory[]>([])
  interface WithdrawHistory {
    requestAmount: string
    requestUserName: string
    ticketCode: string
    createTime:string
    remark:string
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
    let amount: number = 0

    withdrawHistoryList.value.forEach((item) => {
      amount += Number(item.requestAmount)
    })
    totalAmount.value = amount
  }





  return {
    totalAmount,
    mockRequests,
    handleAction,
    balance,
    amount,
    selectedMemberId,
    withdrawHistoryList,
    handleWithdraw,
  }
}
