// 神盾天堂預約 / 塔防的後端呼叫。登入狀態是自己一套(跟分寶會員無關):token 放在 localStorage。
import { reactive } from 'vue'
import { generateSignature } from '@/utils/SignTools'

/** 本機開發連測試後端(run-aegis-dev.sh,記憶體資料庫);正式環境連線上 */
const API = import.meta.env.VITE_AEGIS_API || (import.meta.env.DEV ? 'http://localhost:8099' : 'https://api.gameshare-system.com')
const TOKEN_KEY = 'aegis_prereg_token'

export interface CharacterView { name: string; cls: number; clsName: string; sex: number; stats: number[] }
export interface ClassRule { id: number; name: string; base: number[]; cap: number[]; bonus: number }
export interface Rules {
  classes: ClassRule[]; statNames: string[]; statTotal: number
  loginMin: number; loginMax: number; passwordMin: number; passwordMax: number
  nameMaxWide: number; nameMaxBytes: number; accountsPerIp: number
}

/** 目前登入的預約帳號(整個官網共用一份) */
export const session = reactive<{ token: string; login: string; character: CharacterView | null; ready: boolean }>({
  token: '', login: '', character: null, ready: false,
})

function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
function writeToken(t: string) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* 無痕模式存不了就算了 */ }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const ts = String(Math.floor(Date.now() / 1000))
  const headers: Record<string, string> = { Sign: generateSignature(ts), Timestamp: ts }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`
  let res: Response
  try {
    res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('連不上伺服器,請稍後再試', 0)
  }
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    if (data?.status === -999) {   // 登入過期:清掉,畫面會回到登入
      session.token = ''; session.login = ''; session.character = null
      writeToken('')
      throw new ApiError('登入已過期,請重新登入', -999)
    }
    throw new ApiError(data?.message || '發生錯誤,請稍後再試', res.status)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, auth = true) => call<T>('GET', path, undefined, auth),
  post: <T>(path: string, body?: unknown, auth = true) => call<T>('POST', path, body ?? {}, auth),
  del: <T>(path: string) => call<T>('DELETE', path),
}

function signedIn(r: { token: string; login: string; character: CharacterView | null }) {
  session.token = r.token
  session.login = r.login
  session.character = r.character
  writeToken(r.token)
}

/** 進到預約 / 塔防頁時呼叫一次:手上有 token 就向後端確認還有沒有效 */
export async function restoreSession() {
  if (session.ready) return
  session.token = readToken()
  if (session.token) {
    try {
      const me = await api.get<{ login: string; character: CharacterView | null }>('/aegis/prereg/me')
      session.login = me.login
      session.character = me.character
    } catch {
      session.token = ''
      writeToken('')
    }
  }
  session.ready = true
}

/** turnstile = 過完人機驗證拿到的一次性憑證 */
export async function register(login: string, password: string, turnstile: string) {
  signedIn(await api.post('/aegis/prereg/register', { login, password, turnstile }, false))
}
export async function login(login: string, password: string, turnstile: string) {
  signedIn(await api.post('/aegis/prereg/login', { login, password, turnstile }, false))
}
export async function logout() {
  try { await api.post('/aegis/prereg/logout') } catch { /* 後端沒回也照樣登出 */ }
  session.token = ''; session.login = ''; session.character = null
  writeToken('')
}
export async function changePassword(oldPassword: string, newPassword: string) {
  signedIn(await api.post('/aegis/prereg/password', { oldPassword, newPassword }))
}
export async function createCharacter(name: string, cls: number, sex: number, stats: number[]) {
  session.character = await api.post<CharacterView>('/aegis/prereg/character', { name, cls, sex, stats })
}
export async function deleteCharacter() {
  await api.del('/aegis/prereg/character')
  session.character = null
}
// 帳號、角色名用 POST 送,不放在網址上
export const checkLogin = (value: string) => api.post<{ ok: boolean; message: string }>('/aegis/prereg/check-login', { value }, false)
export const checkName = (value: string) => api.post<{ ok: boolean; message: string }>('/aegis/prereg/check-name', { value }, false)
export const fetchRules = () => api.get<Rules>('/aegis/prereg/rules', false)
export const fetchStats = () => api.get<{ accounts: number; characters: number; byClass: number[] }>('/aegis/prereg/stats', false)
