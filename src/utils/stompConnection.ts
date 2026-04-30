import SockJS from 'sockjs-client'
import Stomp from 'stompjs'

const WS_URL = 'https://api.gameshare-system.com/ws-gs'
const INITIAL_RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000
const HEARTBEAT_MS = 20000

export interface StompHandle {
  disconnect: () => void
  isConnected: () => boolean
}

/**
 * 建立會自動重連 + 心跳保活的 STOMP 連線。
 * - 斷線(STOMP error / SockJS onclose)會自動重連,並重新訂閱
 * - 切回前景時(visibilitychange)若已斷線會立即重連
 * - 重連使用指數退避,上限 30 秒
 */
export function createReconnectingStomp(
  topic: string,
  onMessage: (body: string) => void,
): StompHandle {
  let client: Stomp.Client | null = null
  let manuallyClosed = false
  let reconnectTimer: number | null = null
  let reconnectDelay = INITIAL_RECONNECT_DELAY_MS

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = () => {
    if (manuallyClosed || reconnectTimer !== null) return
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
      connect()
    }, reconnectDelay)
  }

  const connect = () => {
    if (manuallyClosed) return
    try {
      const socket = new SockJS(WS_URL)
      client = Stomp.over(socket)
      client.debug = () => {}
      client.heartbeat.outgoing = HEARTBEAT_MS
      client.heartbeat.incoming = HEARTBEAT_MS

      // SockJS 層斷線 → 重連
      socket.onclose = () => {
        if (!manuallyClosed) scheduleReconnect()
      }

      client.connect(
        {},
        () => {
          // 連線成功,重置 backoff,並重新訂閱
          reconnectDelay = INITIAL_RECONNECT_DELAY_MS
          try {
            client?.subscribe(topic, (message) => {
              onMessage(message.body)
            })
          } catch (e) {
            console.warn('[ws] subscribe failed', e)
          }
        },
        // STOMP 層 error → 重連
        () => {
          if (!manuallyClosed) scheduleReconnect()
        },
      )
    } catch (e) {
      console.warn('[ws] connect failed', e)
      scheduleReconnect()
    }
  }

  const onVisibilityChange = () => {
    if (
      document.visibilityState === 'visible' &&
      !manuallyClosed &&
      !client?.connected
    ) {
      clearReconnectTimer()
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS
      connect()
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  connect()

  return {
    disconnect: () => {
      manuallyClosed = true
      clearReconnectTimer()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      try {
        if (client?.connected) client.disconnect(() => {})
      } catch {
        /* ignore */
      }
      client = null
    },
    isConnected: () => client?.connected ?? false,
  }
}
