import { useErrorOverlayStore } from '@/stores/errorOverlay'

/**
 * 全域 fetch 攔截器:
 * - 加上 15 秒 timeout(透過 AbortController)→ 觸發「重新整理」彈窗
 * - 我們自己 API 回 502 → 觸發「服務維修中」彈窗
 * - TypeError / 4xx 一律不處理(避免第三方 SDK 或瀏覽器擋擴充誤觸發)
 */

const TIMEOUT_MS = 15000

// 我們自己的 API,只有這個來源的回應狀態才會觸發維修彈窗
const OUR_API = /^https:\/\/api\.gameshare-system\.com/

// 不攔截的 URL pattern(WebSocket、Firebase 等內部請求)
const SKIP_PATTERNS = [/sockjs-node/, /firestore\.googleapis/, /firebaseinstallations/]

export function installFetchInterceptor() {
  if (typeof window === 'undefined' || !window.fetch) return
  if ((window as unknown as { __fetchPatched?: boolean }).__fetchPatched) return
  ;(window as unknown as { __fetchPatched?: boolean }).__fetchPatched = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async function patched(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (SKIP_PATTERNS.some((re) => re.test(url))) {
      return originalFetch(input, init)
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, TIMEOUT_MS)

    // 如果使用者自帶 signal,順手連動
    if (init?.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const res = await originalFetch(input, { ...init, signal: controller.signal })
      clearTimeout(timer)
      // 只對自己 API 的 502 顯示維修彈窗,且 tab 必須在前景(避免背景錯誤誤觸發)
      if (
        res.status === 502 &&
        OUR_API.test(url) &&
        document.visibilityState === 'visible'
      ) {
        try {
          useErrorOverlayStore().triggerMaintenance()
        } catch {
          /* pinia 還沒準備好,忽略 */
        }
      }
      return res
    } catch (err: unknown) {
      clearTimeout(timer)
      const isAbort =
        err instanceof DOMException && err.name === 'AbortError'
      // 我們的 timeout
      if (isAbort && timedOut) {
        try {
          useErrorOverlayStore().triggerTimeout()
        } catch {
          /* ignore */
        }
      }
      // 網路 TypeError 不顯示維護中彈窗,讓各頁自行用 useAlert 處理
      throw err
    }
  } as typeof fetch
}
