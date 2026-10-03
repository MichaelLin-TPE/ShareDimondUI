// Cloudflare Turnstile(人機驗證):辦帳號、登入前先讓 Cloudflare 判斷是不是真人,拿到一張一次性的憑證給後端。
// Site Key 是公開的;機密鑰匙只在後端。開發模式用 Cloudflare 公開的測試 Site Key(永遠通過,會顯示一個小工具)。
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? '1x00000000000000000000AA' : '0x4AAAAAAFMdvSI1yylIhRst')
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT
      s.async = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile 沒載入')))
      s.onerror = () => reject(new Error('turnstile 載入失敗'))
      document.head.appendChild(s)
    })
    loading.catch(() => { loading = null })   // 失敗了下次再試
  }
  return loading
}

/**
 * 在 el 裡放一個人機驗證小工具。onToken 拿到憑證(過期或重設會收到空字串)。
 * 回傳的函式:reset() 憑證用過一次就要重設;destroy() 離開頁面時收掉。
 */
export async function mount(el: HTMLElement, onToken: (token: string) => void) {
  const api = await load()
  const id = api.render(el, {
    sitekey: SITE_KEY,
    theme: 'dark',
    language: 'zh-tw',
    callback: (t: string) => onToken(t),
    'expired-callback': () => onToken(''),
    'error-callback': () => onToken(''),
  })
  return {
    reset: () => { try { api.reset(id) } catch { /* 小工具已經不在了 */ } onToken('') },
    destroy: () => { try { api.remove(id) } catch { /* 小工具已經不在了 */ } },
  }
}
