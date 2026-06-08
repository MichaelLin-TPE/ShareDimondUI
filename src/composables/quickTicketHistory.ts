/**
 * 快速開單歷史 — 把每次成功開單的原始 payload 存到 localStorage,
 * 讓使用者一鍵重送「一模一樣的請求」加速開單。
 *
 * 設計:
 * - 依血盟 ID 分開存(不同盟的開單紀錄不混在一起)
 * - 只留最新 5 筆,相同內容去重(移到最前並更新時間)
 * - itemName / bossName 欄位沿用 open-ticket payload 語意(實際是 itemId / bossId)
 *   另存 itemLabel / bossLabel 供彈窗顯示用
 */

export interface QuickTicketEntry {
  /** open-ticket payload 的 itemName 欄(實為 itemId) */
  itemName: string
  /** open-ticket payload 的 bossName 欄(實為 bossId) */
  bossName: string
  lowestPrice: string
  remark: string
  currency: string
  /** 0 = 競標模式 / 1 = 固定金額 */
  type: number
  /** 顯示用:道具名稱 */
  itemLabel: string
  /** 顯示用:首領名稱 */
  bossLabel: string
  /** 存入時間(epoch ms) */
  savedAt: number
}

const KEY_PREFIX = 'quick_ticket_history'
const MAX = 5

const keyOf = (clanId: string) => `${KEY_PREFIX}:${clanId || 'unknown'}`

/** 用內容(不含時間 / 顯示 label)當去重簽章 */
const sigOf = (e: QuickTicketEntry) =>
  `${e.itemName}|${e.bossName}|${e.lowestPrice}|${e.currency}|${e.type}|${e.remark}`

export function loadQuickHistory(clanId: string): QuickTicketEntry[] {
  try {
    const raw = localStorage.getItem(keyOf(clanId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.slice(0, MAX)
  } catch {
    return []
  }
}

/** 推入一筆(相同內容去重移到最前),回傳更新後的清單 */
export function pushQuickHistory(
  clanId: string,
  entry: QuickTicketEntry,
  current: QuickTicketEntry[],
): QuickTicketEntry[] {
  const sig = sigOf(entry)
  const next = [{ ...entry, savedAt: Date.now() }, ...current.filter((e) => sigOf(e) !== sig)].slice(
    0,
    MAX,
  )
  try {
    localStorage.setItem(keyOf(clanId), JSON.stringify(next))
  } catch {
    /* localStorage 滿 / 隱私模式 — 靜默忽略,不影響開單 */
  }
  return next
}

/** 移除一筆,回傳更新後的清單 */
export function removeQuickHistory(
  clanId: string,
  target: QuickTicketEntry,
  current: QuickTicketEntry[],
): QuickTicketEntry[] {
  const sig = sigOf(target)
  const next = current.filter((e) => sigOf(e) !== sig)
  try {
    localStorage.setItem(keyOf(clanId), JSON.stringify(next))
  } catch {
    /* 同上 */
  }
  return next
}
