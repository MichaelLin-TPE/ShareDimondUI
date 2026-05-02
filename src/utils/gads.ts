/**
 * Google Ads 轉換追蹤
 *
 * 設定步驟:
 * 1. 進 Google Ads → 左上選單 → 工具與設定 (Tools & Settings) → 轉換 (Conversions)
 * 2. 點「+ 新轉換動作」→ 選「網站」
 * 3. 填寫:
 *    - 轉換名稱: 建立血盟試用
 *    - 類別: 註冊 (Sign-up)
 *    - 價值: 設定每次轉換的價值 — 建議填 2000 (代表潛在月繳收入)
 *    - 計算方式: 每次點擊一次轉換 (one)
 *    - 轉換窗口: 30 天
 * 4. 取得程式碼後,你會看到類似:
 *      send_to: 'AW-12345678/abcDEFghi_XYZ'
 *    其中 AW-12345678 是 CONVERSION_ID, abcDEFghi_XYZ 是 CONVERSION_LABEL
 * 5. 把下方 TODO 兩個常數替換掉,部屬即可
 */

// Google Ads 轉換 ID (格式: AW-XXXXXXXXX)
export const GOOGLE_ADS_CONVERSION_ID = 'AW-698499203'

// 轉換標籤 (Google Ads 給的 send_to 後半段)
export const GOOGLE_ADS_CONVERSION_LABEL = 'TQ_PCMz6oNUZEIOBic0C'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function isConfigured() {
  return (
    GOOGLE_ADS_CONVERSION_ID.startsWith('AW-') &&
    !GOOGLE_ADS_CONVERSION_ID.includes('XXX') &&
    !GOOGLE_ADS_CONVERSION_LABEL.includes('XXX')
  )
}

/**
 * 追蹤「建立血盟成功」轉換
 * @param value 此次轉換的價值 (預設 2000 = 月繳)
 * @param currency 幣別 (預設 TWD)
 * @param transactionId 訂單編號 (可選 — 用於去重)
 */
export function trackSignupConversion(
  value = 2000,
  currency = 'TWD',
  transactionId?: string,
) {
  if (typeof window === 'undefined' || !window.gtag) {
    console.warn('[gads] gtag 尚未載入,跳過轉換追蹤')
    return
  }
  if (!isConfigured()) {
    console.warn('[gads] Google Ads conversion ID 未設定,跳過追蹤')
    return
  }

  const params: Record<string, unknown> = {
    send_to: `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`,
    value,
    currency,
  }
  if (transactionId) params.transaction_id = transactionId

  window.gtag('event', 'conversion', params)

  // 同時送一個 GA4 自訂事件,方便在 GA4 看註冊轉換
  window.gtag('event', 'sign_up', {
    method: 'create_clan',
    value,
    currency,
  })
}

/**
 * 追蹤「點擊免費試用按鈕」 — micro-conversion
 * 用來觀察哪些頁面 / 廣告組合的試用點擊率高
 */
export function trackTrialClick(source = 'landing') {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'trial_click', {
    source,
  })
}
