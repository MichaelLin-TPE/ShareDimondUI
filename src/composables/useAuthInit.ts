import { useAuthStore } from '@/stores/auth.ts'
import { useRouter } from 'vue-router'
const router = useRouter()
export async function useAuthInit() {
  const authStore = useAuthStore()

  if (!authStore.authToken) return

  try {
    const res = await fetch('https://gameshare-system.com/getBasicInfo', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      // alert('請重新登入謝謝!')
      // router.replace('/login')
      return
    }

    const member = await res.json()
    authStore.setMember(member)
  } catch (e) {
    console.log(e)
  }
}
