import { useAuthStore } from '@/stores/auth.ts'

export async function useAuthInit() {
  const authStore = useAuthStore()

  if (!authStore.authToken) return

  try {
    const res = await fetch('http://localhost:8080/getBasicInfo', {
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) throw new Error('Unauthorized')

    const member = await res.json()
    authStore.setMember(member)
  } catch (e) {
    console.log(e)
  }
}
