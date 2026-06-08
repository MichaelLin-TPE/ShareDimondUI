/**
 * 快速開單 — 最近開單紀錄的型別與對應。
 * 資料來自後端 GET /recent-open-tickets(直接從 Treasure 表撈會員自己最近開的單、去重),
 * 不再用 localStorage,因此跨裝置 / 換瀏覽器都看得到真實歷史。
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
}

/** 後端 /recent-open-tickets 的單筆回傳 */
interface RecentOpenTicketApi {
  itemId: string
  itemName: string
  bossId: string
  bossName: string
  lowestPrice: number | string
  currency: string
  type: number
  remark: string | null
}

/** 把後端回傳對應成前端重播 / 顯示用的 entry */
export function mapRecentTickets(list: RecentOpenTicketApi[] | null | undefined): QuickTicketEntry[] {
  if (!Array.isArray(list)) return []
  return list.map((r) => ({
    itemName: r.itemId,
    bossName: r.bossId,
    itemLabel: r.itemName,
    bossLabel: r.bossName,
    lowestPrice: r.lowestPrice == null ? '' : String(r.lowestPrice),
    currency: r.currency,
    type: r.type,
    remark: r.remark ?? '',
  }))
}
