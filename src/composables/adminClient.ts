import { ref, computed } from 'vue'

/**
 * Admin Page 共用狀態與工具 — 單例 (module-level refs,所有 import 共享同一份)。
 *
 * 抽出來讓每個 Tab Component 不用重複 token / fetch / toast 邏輯,
 * 也方便未來再加新 tab 時不會炸 AdminPage.vue。
 */

const API_BASE = 'https://api.gameshare-system.com'
const TOKEN_KEY = 'admin_token_v1'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24h

// ===== Token =====
function loadToken(): string {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { token?: string; expires?: number }
    if (parsed?.token && parsed.expires && Date.now() < parsed.expires) {
      return parsed.token
    }
    localStorage.removeItem(TOKEN_KEY)
    return ''
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return ''
  }
}

const adminToken = ref<string>(loadToken())
const tokenInput = ref<string>('')
const authed = computed(() => !!adminToken.value)

function saveToken() {
  if (!tokenInput.value.trim()) return
  adminToken.value = tokenInput.value.trim()
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ token: adminToken.value, expires: Date.now() + TOKEN_TTL_MS }),
  )
  tokenInput.value = ''
}

function clearToken() {
  adminToken.value = ''
  localStorage.removeItem(TOKEN_KEY)
}

// ===== Toasts =====
export type Toast = { id: number; type: 'success' | 'error' | 'info'; msg: string }
const toasts = ref<Toast[]>([])
let toastSeq = 0
function showToast(type: Toast['type'], msg: string) {
  const id = ++toastSeq
  toasts.value.push({ id, type, msg })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 4000)
}

// ===== Fetch helper =====
async function callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken.value,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Admin token 無效或已失效,請重新輸入')
  }
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return text ? JSON.parse(text) : ({} as T)
}

// ===== Misc =====
function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => showToast('info', '已複製: ' + text))
}

// ===== Format helpers (跨 tab 共用) =====
export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-'
  return 'NT$ ' + Math.round(n).toLocaleString()
}
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '-'
  return s.replace('T', ' ').slice(0, 19)
}
export function fmtDateMs(ms: number | null | undefined): string {
  if (!ms) return '-'
  return new Date(ms).toLocaleString('zh-TW', { hour12: false })
}

export function useAdminClient() {
  return {
    // token
    adminToken,
    tokenInput,
    authed,
    saveToken,
    clearToken,
    // toasts
    toasts,
    showToast,
    // api
    callApi,
    // misc
    copy,
  }
}
