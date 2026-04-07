<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import ClanNotice from '@/components/ClanNotice.vue'
import { useAuthStore } from '@/stores/auth.ts'
import BiddingManagement from '@/components/BiddingManagement.vue'
import { onMounted, ref } from 'vue'
import type { Balance } from '@/types/balance.ts'
import Stomp from 'stompjs'
import SockJS from 'sockjs-client'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { messaging } from '@/utils/firebase'
import { getToken } from 'firebase/messaging'
import { generateSignature } from '@/utils/SignTools.ts'

const socket = new SockJS('https://api.gameshare-system.com/ws-gs')
const stompClient = Stomp.over(socket)

const memberBalance = ref<Balance[]>([])
const clanBalance = ref<Balance[]>([])
const authStore = useAuthStore()
const balance = useBalanceStore()
const showPushModal = ref<boolean>(false)

// 1. 取得裝置類型
const getDeviceType = () => {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'ANDROID'
  if (/iPad|iPhone|iPod/.test(ua)) return 'IOS'
  return 'WEB'
}

// 2. 向後端儲存 Token 的 API (核心邏輯)
const saveTokenToBackend = async (token: string) => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/saveFcmToken', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
      body: JSON.stringify({
        token: token,
        deviceType: getDeviceType(),
      }),
    })
    const data = await res.json()
    console.log('FCM Token 儲存結果:', data.message || 'Success')
  } catch (e) {
    console.error('儲存 Token 到後端失敗:', e)
  }
}

// 3. 靜默獲取 FCM Token 並檢查更新
const getFcmTokenSilently = async () => {
  if (Notification.permission !== 'granted') return

  try {
    const token = await getToken(messaging, {
      vapidKey:
        'BGjvwKaw0YM2q4yZ1PkoTDFseAPAjry66ImjiTzW0Db89osiyF_IeO58cJvENTFOeMcRgmxDh091mcbXZm21lpY',
    })

    if (token) {
      await saveTokenToBackend(token)
    } else {
      console.warn('無法取得 Token，請檢查 Firebase 配置')
    }
  } catch (e) {
    console.error('取得 FCM Token 失敗:', e)
  }
}

// 4. 初始檢查流程
const checkNotificationPermission = () => {
  if (!('Notification' in window)) return

  const permission = Notification.permission

  if (permission === 'default') {
    const hasDeclined = localStorage.getItem('declined_push')
    if (!hasDeclined) {
      showPushModal.value = true
    }
  } else if (permission === 'granted') {
    getFcmTokenSilently()
  }
}

// 5. 使用者點擊「暫時不要」
const handleDeclinePush = () => {
  showPushModal.value = false
  localStorage.setItem('declined_push', 'true')
}

// 6. 使用者點擊「開啟通知」
const requestNotificationPermission = async () => {
  showPushModal.value = false

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      console.log('使用者點擊允許')
      await getFcmTokenSilently()
    } else {
      console.log('使用者拒絕通知')
      localStorage.setItem('declined_push', 'true')
    }
  } catch (error) {
    console.error('請求通知權限時出錯:', error)
  }
}

// 7. WebSocket 與資料獲取
const getBalance = async () => {
  if (!authStore.authToken) return
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/getBalance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
    })
    if (!res.ok) return
    const data = await res.json()
    memberBalance.value = data.memberBalanceResponseList
    clanBalance.value = data.clanBalanceResponseList
    balance.setBalanceList(data.memberBalanceResponseList)
    balance.setClanBalanceList(data.clanBalanceResponseList)
  } catch (e) {
    console.log(e)
  }
}

stompClient.connect({}, () => {
  stompClient.subscribe('/topic/balance/' + authStore?.member?.clanId, () => {
    getBalance()
  })
})

// 8. 掛載生命週期
onMounted(() => {
  getBalance()
  checkNotificationPermission()
})
</script>

<template>
  <div class="dashboard">
    <div v-if="showPushModal" class="custom-modal-overlay">
      <div class="custom-modal-content">
        <div class="modal-icon">🔔</div>
        <h3 class="modal-title">開啟即時通知</h3>
        <p class="modal-desc">
          不錯過任何重要的競標結果與最新裝備資訊！我們保證只發送最重要的通知。
        </p>
        <div class="modal-actions">
          <button class="modal-btn btn-cancel" @click="handleDeclinePush">暫時不要</button>
          <button class="modal-btn btn-confirm" @click="requestNotificationPermission">
            開啟通知
          </button>
        </div>
      </div>
    </div>

    <h1 v-if="authStore.member">{{ authStore.member.clanName }} 血盟大廳</h1>

    <ClanNotice />

    <div class="balance-dashboard-compact">
      <div class="balance-row personal">
        <div class="row-header">
          <div class="icon-wrapper">👤</div>
          <h3 class="row-title">我的帳戶</h3>
        </div>
        <div class="balance-items-wrapper">
          <div v-for="item in memberBalance" :key="item.currency" class="balance-item-compact">
            <span class="currency-label">{{ item.currency }}</span>
            <span class="amount-value gold">{{ item.balance.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <div class="balance-row clan">
        <div class="row-header">
          <div class="icon-wrapper gold">🏰</div>
          <h3 class="row-title">血盟金庫</h3>
        </div>
        <div class="balance-items-wrapper">
          <div v-for="item in clanBalance" :key="item.currency" class="balance-item-compact">
            <span class="currency-label">{{ item.currency }}</span>
            <span class="amount-value gold">{{ item.balance.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="stats">
      <TreasureCard class="treasureCard" />
      <StatCard />
      <BiddingManagement class="biddingManagement" />
    </div>
  </div>
</template>

<style scoped>
/* 你的 CSS 樣式完全保留，未做任何更動 */
@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.modal-title {
  color: #f1f5f9;
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.modal-desc {
  color: #94a3b8;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 25px;
}

.modal-actions {
  display: flex;
  gap: 15px;
}

.modal-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-cancel {
  background: #2d3047;
  color: #94a3b8;
  border: 1px solid #3f425b;
}

.btn-cancel:hover {
  background: #3f425b;
  color: #fff;
}

.btn-confirm {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.btn-confirm:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

header {
  line-height: 1.5;
  max-height: 100vh;
}
.logo {
  display: block;
  margin: 0 auto 2rem;
}
nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}
nav a.router-link-exact-active {
  color: var(--color-text);
}
nav a.router-link-exact-active:hover {
  background-color: transparent;
}
nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}
nav a:first-of-type {
  border: 0;
}

.custom-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.custom-modal-content {
  background: #1e1e2e;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 30px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
  animation: popIn 0.3s ease-out;
}

h1 {
  margin-top: 5px;
  margin-bottom: 15px;
  margin-left: 65px;
}

.dashboard {
  padding: 24px 24px 24px 24px;
  color: #fff;
  transition: padding-left 0.4s ease;
}

.stats {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

:deep(ClanNotice) {
  margin-bottom: 24px;
}

.balance-dashboard-compact {
  display: flex;
  gap: 16px;
  width: 100%;
}

.balance-row {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(17, 19, 28, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 12px 20px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.balance-row:hover {
  border-color: rgba(99, 102, 241, 0.2);
  background: rgba(17, 19, 28, 0.95);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
}

.balance-row.clan:hover {
  border-color: rgba(245, 196, 81, 0.2);
  box-shadow: 0 6px 20px rgba(245, 196, 81, 0.08);
}

.row-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 130px;
  flex-shrink: 0;
}

.icon-wrapper {
  font-size: 1.2rem;
  color: #6366f1;
}

.icon-wrapper.gold {
  color: #f5c451;
}

.row-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
  letter-spacing: 0.5px;
}

.balance-items-wrapper {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 24px;
}

.balance-item-compact {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.currency-label {
  font-size: 0.7rem;
  color: #94a3b8;
  font-weight: 500;
}

.amount-value {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.5px;
}

.amount-value.gold {
  color: #f5c451;
}

@media (max-width: 768px) {
  .dashboard {
    padding: 16px 12px;
  }
  h1 {
    font-size: 1.35rem;
    margin-left: 50px;
    margin-bottom: 16px;
  }
  .stats {
    gap: 20px;
    margin-bottom: 20px;
  }
  .balance-dashboard-compact {
    flex-direction: column;
    gap: 12px;
  }
  .balance-row {
    padding: 12px 16px;
  }
  .row-header {
    width: 100px;
  }
  .balance-items-wrapper {
    gap: 16px;
  }
  .amount-value {
    font-size: 1.05rem;
  }
}
</style>
