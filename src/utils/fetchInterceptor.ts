import { useErrorOverlayStore } from '@/stores/errorOverlay'
import { useAlert } from '@/utils/alerts'
import router from '@/router'
import { resetSession } from '@/utils/session'

/**
 * 全域 fetch 攔截器:
 * - 加上 15 秒 timeout(透過 AbortController)→ 觸發「重新整理」彈窗
 * - 我們自己 API 回 401 → 自動登出並跳轉 /login (token 過期/被撤銷)
 * - 我們自己 API 回 5xx → 觸發「服務維修中」彈窗
 * - TypeError / 其他 4xx 一律不處理(避免第三方 SDK 或瀏覽器擋擴充誤觸發)
 */

// 確保 401 處理只觸發一次,避免併發 401 重複跳轉/重複 toast
let handling401 = false

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

      // 我們自己 API 回 401 → token 過期/失效,清掉 session 跳回 /login
      if (res.status === 401 && OUR_API.test(url) && !handling401) {
        // 排除 login 端點本身 (打錯密碼也會 401,不該觸發跳轉)
        const isLoginEndpoint = /\/(login|loginByToken)\b/.test(url)
        if (!isLoginEndpoint) {
          handling401 = true
          try {
            useAlert.error('登入逾時,請重新登入')
            resetSession()
            router.replace('/login').finally(() => {
              // 跳轉完成後解鎖,給下次 session
              setTimeout(() => {
                handling401 = false
              }, 1000)
            })
          } catch {
            handling401 = false
          }
        }
      }

      // 我們自己 API 收到 5xx → 只在「真的服務崩潰」時顯示維修彈窗:
      // - body 有 message 欄位 → 後端有正常回應只是業務出錯 (例如 GlobalExceptionHandler 兜底的 500),
      //   讓 caller 的 useAlert.error(data.message) 處理就好,不顯示維修彈窗
      // - body 沒 message / 不能 parse → 真正的服務掛掉 (CDN 502/503/504),顯示維修彈窗
      if (
        res.status >= 500 &&
        res.status < 600 &&
        OUR_API.test(url) &&
        document.visibilityState === 'visible'
      ) {
        let hasFriendlyMessage = false
        try {
          // clone 避免吃掉 body,caller 還要用
          const cloned = res.clone()
          const body = await cloned.json().catch(() => null)
          hasFriendlyMessage = !!(body && typeof body.message === 'string' && body.message.length > 0)
        } catch {
          /* parse 失敗 → 視為無 message → 顯示維修 */
        }
        if (!hasFriendlyMessage) {
          try {
            useErrorOverlayStore().triggerMaintenance()
          } catch {
            /* pinia 還沒準備好,忽略 */
          }
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
        throw err
      }
      // CDN/LB 在後端死掉時通常回 502 但沒附 CORS header,
      // fetch 會直接拋 TypeError(而非 res.status === 502)。
      // 對自己 API 的網路錯誤 → 視為服務暫停,顯示維修彈窗
      if (
        !isAbort &&
        err instanceof TypeError &&
        OUR_API.test(url) &&
        document.visibilityState === 'visible'
      ) {
        try {
          useErrorOverlayStore().triggerMaintenance()
        } catch {
          /* ignore */
        }
      }
      throw err
    }
  } as typeof fetch
}
