import { defineStore } from 'pinia'
import { ref } from 'vue'
import { generateSignature } from '@/utils/SignTools'
import { useAuthStore } from '@/stores/auth'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

interface TreasureCurrency {
  currency: string
  amount: string
}
interface TreasureAttendance {
  id: number
  treasureCode: string
  memberId: number
  joinTime: string
  canceled: boolean
  canceledTime: string
  userName: string
  remainSecond: number
}
interface BiddingMember {
  userName: string
}

/** 從 /get-ongoing-bidding-treasure 回傳的單一筆,欄位涵蓋兩個 caller 用到的所有欄位。 */
export interface RawTreasure {
  itemName: string
  itemId: string
  bossName: string
  bossId: string
  treasureAttendanceList: TreasureAttendance[]
  lowestPrice: number
  currency: string
  biddingName: string
  remark: string
  currentPrice: number
  biddingPrice: number
  ticketOwerMemberId: number
  ticketOwerName: string
  treasureCurrencyList: TreasureCurrency[]
  createDate: string
  buyerMemberId: number | null
  finalPrice: string | null
  status: string
  expireTime: string
  clanId: string
  ticketCreateTime: string
  treasureCode: string
  treasureType: string
  remainSeconds: number
  joinButtonDisable: boolean
  showDeleteTicket: boolean
  disableSubmitButton: boolean
  canVerifyBiddingTicket: boolean
  hasEnoughMoneyToBuy: boolean
  assignByLeader: boolean
  isBidding: boolean
  canBid: boolean
  checkFromRepository: boolean
  biddingMemberList: BiddingMember[]
  biddingMemberContent: string
}

const API_URL = 'https://api.gameshare-system.com/get-ongoing-bidding-treasure'
const WS_TOPIC_PREFIX = '/topic/bidding/'

/**
 * 集中管理 /get-ongoing-bidding-treasure API 與 /topic/bidding WS 訂閱。
 * 多個 composable(StatCard、BiddingManagement)共用同一份 raw 資料,
 * - refresh() 同時間多次呼叫只實際打一次(in-flight 去重)
 * - subscribe() 用 ref count 確保只開一條 WS;最後一個取消訂閱才關閉
 */
export const useBiddingTreasureStore = defineStore('biddingTreasure', () => {
  const rawTreasures = ref<RawTreasure[]>([])
  let inFlight: Promise<void> | null = null
  // 若 WS push 在 fetch 進行中到達,記下「結束後再 refresh 一次」,避免吃到舊資料
  let pendingRefetch = false
  let wsHandle: StompHandle | null = null
  let subscriberCount = 0

  async function refresh(): Promise<void> {
    if (inFlight) {
      // 已有 in-flight,標記「做完再來一次」確保最新一輪 WS push 不會被吞掉
      pendingRefetch = true
      return inFlight
    }
    const authStore = useAuthStore()
    if (!authStore.authToken) return

    inFlight = (async () => {
      try {
        const ts = Math.floor(Date.now() / 1000).toString()
        const res = await window.fetch(API_URL, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authStore.authToken}`,
            Accept: 'application/json',
            Sign: generateSignature(ts),
            TimeStamp: ts,
          },
        })
        if (!res.ok) return
        rawTreasures.value = await res.json()
      } catch (e) {
        console.error(e)
      } finally {
        inFlight = null
        if (pendingRefetch) {
          pendingRefetch = false
          // 不 await — 讓當前 refresh() 的 caller 能繼續,新 fetch 在背景進行
          refresh()
        }
      }
    })()
    return inFlight
  }

  function subscribe(clanId: string): () => void {
    subscriberCount++
    if (subscriberCount === 1 && !wsHandle) {
      wsHandle = createReconnectingStomp(`${WS_TOPIC_PREFIX}${clanId}`, (body) => {
        if (body === 'BIDDING_LIST_UPDATED') {
          refresh()
        }
      })
    }
    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1)
      if (subscriberCount === 0 && wsHandle) {
        wsHandle.disconnect()
        wsHandle = null
      }
    }
  }

  // 登出 / 退出血盟時呼叫,清空快取 + 強制斷 WS (避免帶舊 token 重連)
  function reset() {
    rawTreasures.value = []
    inFlight = null
    pendingRefetch = false
    if (wsHandle) {
      wsHandle.disconnect()
      wsHandle = null
    }
    subscriberCount = 0
  }

  return { rawTreasures, refresh, subscribe, reset }
})
