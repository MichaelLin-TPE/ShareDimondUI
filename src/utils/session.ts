import { useAuthStore } from '@/stores/auth.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { useBiddingTreasureStore } from '@/stores/biddingTreasure.ts'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import { resetNotifications } from '@/composables/notifications.ts'

/**
 * 登出 / 退出血盟時呼叫 — 清掉所有跟使用者 session 綁定的 store。
 *
 * 為何要集中:同裝置切換帳號 / 換血盟時,任何沒清的 store 都會讓新帳號看到上一個人的資料。
 * 之後新增 session-bound store 時,只需在這裡加一行 reset(),不用四處改登出邏輯。
 */
export function resetSession(): void {
  useAuthStore().clearToken()
  useBalanceStore().reset()
  useBiddingTreasureStore().reset()
  useSharedListsStore().reset()
  resetNotifications()
}
