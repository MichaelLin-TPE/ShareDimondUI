import { useErrorOverlayStore } from '@/stores/errorOverlay'
import { useAlert } from '@/utils/alerts'
import router from '@/router'
import { resetSession } from '@/utils/session'

/**
 * 全域 fetch 攔截器:
 * - 15 秒 timeout(AbortController)
 * - 自己 API 的「冪等請求(GET/HEAD)」遇到 timeout / 網路錯 / 5xx(無 message) → 默默重試一次,
 *   重試成功使用者就不會看到「沒反應」。POST/PUT/DELETE 不重試(避免重複下注/重複轉帳)。
 * - 重試後仍失敗才跳維修/逾時彈窗
 * - 401 → 自動登出跳 /login
 */

let handling401 = false

const TIMEOUT_MS = 15000
const RETRY_DELAY_MS = 500

const OUR_API = /^https:\/\/api\.gameshare-system\.com/
const SKIP_PATTERNS = [/sockjs-node/, /firestore\.googleapis/, /firebaseinstallations/]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase()
    const isOurApi = OUR_API.test(url)
    // 只有「自己 API + 冪等方法」才默默重試(POST 重試會重複扣款/下注)
    const canRetry = isOurApi && (method === 'GET' || method === 'HEAD')

    // 單次 fetch + timeout。回傳 Response 或丟錯(錯誤上掛 __timedOut)
    const single = async (): Promise<Response> => {
      const controller = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, TIMEOUT_MS)
      if (init?.signal) {
        if (init.signal.aborted) controller.abort()
        else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
      try {
        const res = await originalFetch(input, { ...init, signal: controller.signal })
        clearTimeout(timer)
        return res
      } catch (e) {
        clearTimeout(timer)
        ;(e as { __timedOut?: boolean }).__timedOut = timedOut
        throw e
      }
    }

    // 5xx 且後端沒附 friendly message → 視為「真崩潰」(可重試/該跳維修)
    const isHardServerError = async (res: Response): Promise<boolean> => {
      if (!(res.status >= 500 && res.status < 600 && isOurApi)) return false
      try {
        const b = await res.clone().json().catch(() => null)
        return !(b && typeof b.message === 'string' && b.message.length > 0)
      } catch {
        return true
      }
    }

    // ===== 第一次嘗試 =====
    let res: Response | null = null
    let err: unknown = null
    try {
      res = await single()
    } catch (e) {
      err = e
    }

    // ===== 判斷是否「暫時性失敗」,冪等請求就默默重試一次 =====
    const isTransient = async (): Promise<boolean> => {
      if (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError'
        if (isAbort && (err as { __timedOut?: boolean }).__timedOut) return true // 逾時
        if (!isAbort && err instanceof TypeError && isOurApi) return true // 網路錯(後端死)
        return false
      }
      if (res) return await isHardServerError(res)
      return false
    }

    if (canRetry && (await isTransient())) {
      await sleep(RETRY_DELAY_MS)
      try {
        res = await single()
        err = null
      } catch (e) {
        err = e
        res = null
      }
    }

    // ===== 最終結果處理(可能已重試過) =====
    if (res) {
      if (res.status === 401 && isOurApi && !handling401) {
        const isLoginEndpoint = /\/(login|loginByToken)\b/.test(url)
        if (!isLoginEndpoint) {
          handling401 = true
          try {
            useAlert.error('登入逾時,請重新登入')
            resetSession()
            router.replace('/login').finally(() => {
              setTimeout(() => {
                handling401 = false
              }, 1000)
            })
          } catch {
            handling401 = false
          }
        }
      }

      if (
        res.status >= 500 &&
        res.status < 600 &&
        isOurApi &&
        document.visibilityState === 'visible'
      ) {
        if (await isHardServerError(res)) {
          try {
            useErrorOverlayStore().triggerMaintenance()
          } catch {
            /* pinia 還沒準備好 */
          }
        }
      }
      return res
    }

    // err 路徑(重試後仍失敗)
    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    if (isAbort && (err as { __timedOut?: boolean }).__timedOut) {
      try {
        useErrorOverlayStore().triggerTimeout()
      } catch {
        /* ignore */
      }
      throw err
    }
    if (
      !isAbort &&
      err instanceof TypeError &&
      isOurApi &&
      document.visibilityState === 'visible'
    ) {
      try {
        useErrorOverlayStore().triggerMaintenance()
      } catch {
        /* ignore */
      }
    }
    throw err
  } as typeof fetch
}
