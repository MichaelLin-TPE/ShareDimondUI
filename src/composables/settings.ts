import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { resetSession } from '@/utils/session.ts'
import { useRouter } from 'vue-router'

const API = 'https://api.gameshare-system.com'

export function useSettings() {
  const authStore = useAuthStore()
  const router = useRouter()

  const showEditNameModal = ref(false)
  const editNameValue = ref('')
  const submittingName = ref(false)

  const showLeaveConfirm = ref(false)
  const submittingLeave = ref(false)

  const headers = () => {
    const ts = Math.floor(Date.now() / 1000).toString()
    return {
      Authorization: `Bearer ${authStore.authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Sign: generateSignature(ts),
      TimeStamp: ts,
    }
  }

  const openEditName = () => {
    editNameValue.value = authStore.member?.userName ?? ''
    showEditNameModal.value = true
  }
  const closeEditName = () => {
    showEditNameModal.value = false
    editNameValue.value = ''
  }

  const submitEditName = async () => {
    if (submittingName.value) return
    const v = editNameValue.value.trim()
    if (!v) {
      useAlert.error('名稱不可空白')
      return
    }
    if (v.length < 2 || v.length > 20) {
      useAlert.error('名稱長度需在 2-20 字之間')
      return
    }
    submittingName.value = true
    try {
      const res = await fetch(`${API}/me/update-name`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ userName: v }),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '更新失敗')
        return
      }
      // 同步更新 authStore(讓側邊欄等立刻反映)
      if (authStore.member) {
        authStore.setMember({ ...authStore.member, userName: v })
      }
      closeEditName()
      await useAlert.success(data.message ?? '已更新名稱')
      // 重整頁面確保所有頁面的快取資料(待分配單、歷史紀錄等)都用新名字
      window.location.reload()
    } catch (e) {
      console.log(e)
    } finally {
      submittingName.value = false
    }
  }

  const openLeaveConfirm = async () => {
    const ok = await useAlert.confirm(
      '退出後會把錢包餘額退還血盟金庫,確定退出?',
      '退出血盟',
    )
    if (!ok.isConfirmed) return
    await submitLeave()
  }

  const submitLeave = async () => {
    if (submittingLeave.value) return
    submittingLeave.value = true
    try {
      const res = await fetch(`${API}/me/leave-clan`, {
        method: 'POST',
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        useAlert.error(data.message ?? '退出失敗')
        return
      }
      useAlert.success(data.message ?? '已退出血盟')
      // 退出血盟 → 清掉所有 session-bound store,送回登入頁
      resetSession()
      router.replace('/login')
    } catch (e) {
      console.log(e)
    } finally {
      submittingLeave.value = false
    }
  }

  return {
    showEditNameModal,
    editNameValue,
    submittingName,
    submittingLeave,
    openEditName,
    closeEditName,
    submitEditName,
    openLeaveConfirm,
    showLeaveConfirm,
  }
}
