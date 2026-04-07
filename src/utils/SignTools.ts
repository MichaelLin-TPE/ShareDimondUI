import CryptoJS from 'crypto-js'

// 這些值要跟後端 SignService 完全一致
const ID = 'JOYCE_IS_BEAUTIFUL'
const KEY = 'MICHAEL_IS_HANDSOME'
const NUMBER = '0928906452'

/**
 * 根據傳入的時間戳產生簽章
 * @param {string} timestamp - 當下的 Unix 時間戳 (秒)
 * @returns {string} - 回傳小寫的 HMAC-SHA256 Hex 字串
 */
export const generateSignature = (timestamp:string) => {
  // 1. 取 Merchant ID 前 5 碼
  const firstFive = ID.substring(0, 5)

  // 2. 取帳號後 5 碼
  const lastFive = NUMBER.substring(NUMBER.length - 5)

  // 3. 組合明文 (前5 + 密鑰 + 時間戳 + 後5)
  // 注意：這裡的順序必須跟後端 Java 的 dataString 組合順序一模一樣
  const dataString = firstFive + KEY + timestamp + lastFive

  // 4. HMAC-SHA256 加密並轉小寫 Hex
  const hash = CryptoJS.HmacSHA256(dataString, KEY)
  return hash.toString(CryptoJS.enc.Hex).toLowerCase()
}
