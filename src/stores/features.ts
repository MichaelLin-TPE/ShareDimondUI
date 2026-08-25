import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'

/**
 * 「我可用的功能」快取(role-aware)。給前端隱藏按鈕/入口用。
 * enabled(key):預設 true — 資料未回來前不誤藏按鈕,只有明確 false 才隱藏。
 * 會長在功能權限頁改動後,受影響的成員下次載入(或 refresh)才生效。
 */
const API = 'https://api.gameshare-system.com'

export const useFeatureStore = defineStore('features', () => {
  const features = ref<Record<string, boolean>>({})
  let loaded = false
  let inFlight: Promise<void> | null = null

  const buildHeaders = () => {
    const authStore = useAuthStore()
    const ts = Math.floor(Date.now() / 1000).toString()
    return {
      Authorization: `Bearer ${authStore.authToken}`,
      Sign: generateSignature(ts),
      TimeStamp: ts,
    }
  }

  const fetchMine = async () => {
    try {
      const res = await fetch(`${API}/clan-feature/mine`, { method: 'GET', headers: buildHeaders() })
      if (!res.ok) return
      features.value = await res.json()
      loaded = true
    } catch (e) {
      console.error(e)
    }
  }

  const load = (): Promise<void> => {
    if (loaded) return Promise.resolve()
    if (inFlight) return inFlight
    inFlight = fetchMine().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const refresh = (): Promise<void> => {
    loaded = false
    inFlight = null
    return load()
  }

  // 預設 true:未載入前或查無此 key 都當可用,避免誤藏;只有明確 false 才隱藏
  const enabled = (key: string): boolean => features.value[key] !== false

  const reset = () => {
    features.value = {}
    loaded = false
    inFlight = null
  }

  return { features, load, refresh, enabled, reset }
})
