/**
 * 備註統一選項 — 避免每個人自由打字導致備註亂、不統一。
 * 三種預設:已繳倉庫 / 在我身上 / 道具給 XXX 了 (XXX = 血盟會員名)。
 * 開單預設為「在我身上」。
 */

export const REMARK_WAREHOUSE = '已繳倉庫'
export const REMARK_ON_ME = '在我身上'
export const GIVE_PREFIX = '道具給 '
export const GIVE_SUFFIX = ' 了'

export type RemarkChoice = 'warehouse' | 'onme' | 'give'

export const buildGiveRemark = (memberName: string): string =>
  `${GIVE_PREFIX}${memberName}${GIVE_SUFFIX}`

/** 把現有備註字串反解析成選項,給彈窗預選用。無法對應的舊備註一律視為「在我身上」。 */
export const parseRemark = (remark?: string): { choice: RemarkChoice; memberName: string } => {
  const cur = (remark || '').trim()
  if (cur === REMARK_WAREHOUSE) return { choice: 'warehouse', memberName: '' }
  if (cur.startsWith(GIVE_PREFIX) && cur.endsWith(GIVE_SUFFIX) && cur.length > GIVE_PREFIX.length + GIVE_SUFFIX.length) {
    return {
      choice: 'give',
      memberName: cur.slice(GIVE_PREFIX.length, cur.length - GIVE_SUFFIX.length).trim(),
    }
  }
  return { choice: 'onme', memberName: '' }
}

/**
 * 是否已繳交 — 待繳交區判斷用。
 * 規則:幹部已勾「確認存倉」(checkFromRepository) 或 備註已是「已繳倉庫」都視為已繳交。
 */
export const isSubmitted = (remark?: string, checkFromRepository?: boolean): boolean =>
  checkFromRepository === true || (remark || '').trim() === REMARK_WAREHOUSE
