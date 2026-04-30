import { useErrorOverlayStore } from '@/stores/errorOverlay'

/**
 * 全域 fetch 攔截器:
 * - 加上 15 秒 timeout(透過 AbortController)→ 觸發「重新整理」彈窗
 * - 502/503/504 / 網路斷線(TypeError) → 觸發「服務維修中」彈窗
 * - 4xx 不處理(交由各個 page 既有的 useAlert 處理業務錯誤)
 */

const TIMEOUT_MS = 15000

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

      // 5xx 但不是 500(500 通常是 backend 邏輯錯誤,讓既有處理) — 502/503/504 是常見維護/閘道錯誤
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        try {
          useErrorOverlayStore().triggerMaintenance()
        } catch {
          /* pinia not ready, ignore */
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
      } else if (
        err instanceof TypeError &&
        !isAbort &&
        // 不是因為被使用者 abort
        !(init?.signal?.aborted ?? false)
      ) {
        // 通常代表網路斷線、CORS、或 server 完全沒回(net::ERR_*)
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
