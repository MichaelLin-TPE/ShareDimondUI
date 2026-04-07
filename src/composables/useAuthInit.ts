import { useAuthStore } from '@/stores/auth.ts'
import { useRouter } from 'vue-router'
import { generateSignature } from '@/utils/SignTools.ts'
const router = useRouter()
export async function useAuthInit() {
  const authStore = useAuthStore()

  if (!authStore.authToken) return

  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/getBasicInfo', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
