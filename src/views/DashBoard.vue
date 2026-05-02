<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import ClanNotice from '@/components/ClanNotice.vue'
import { useAuthStore } from '@/stores/auth.ts'
import BiddingManagement from '@/components/BiddingManagement.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Balance } from '@/types/balance.ts'
import { useBalanceStore } from '@/stores/balanceTool.ts'
import { messaging } from '@/utils/firebase'
import { getToken } from 'firebase/messaging'
import { generateSignature } from '@/utils/SignTools.ts'
import { createReconnectingStomp, type StompHandle } from '@/utils/stompConnection'

let wsHandle: StompHandle | null = null

const memberBalance = ref<Balance[]>([])
const clanBalance = ref<Balance[]>([])
const authStore = useAuthStore()
const balance = useBalanceStore()
const showPushModal = ref<boolean>(false)

// 血盟試用倒數 — 後端在 /getBasicInfo 回傳 clanExpiresAt (epoch millis)
const trialDaysRemaining = computed<number | null>(() => {
  const expiresAt = authStore.member?.clanExpiresAt
  if (!expiresAt) return null
  const ms = expiresAt - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
})
const trialChipText = computed(() => {
  const d = trialDaysRemaining.value
  if (d === null) return ''
  if (d <= 0) return '⛔ 試用已到期'
  if (d === 1) return '⚠️ 試用剩 1 天'
  return `🕐 試用剩 ${d} 天`
})
const trialChipClass = computed(() => {
  const d = trialDaysRemaining.value
  if (d === null) return ''
  if (d <= 0) return 'trial-expired'
  if (d <= 3) return 'trial-warning'
  return 'trial-normal'
})

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
    const res = await fetch('https://api.gameshare-system.com/saveFcmToken', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
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
    const res = await fetch('https://api.gameshare-system.com/getBalance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
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
const version = ref('')
const getVersion = async () => {
  if (!authStore.authToken) return
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/getBiggestVersion', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    if (!res.ok) return
    const data = await res.json()
    version.value = data.version
  } catch (e) {
    console.log(e)
  }
}

const checkUpdate = async () => {
  if (!authStore.authToken) return
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/checkUpdateInformation', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.needToUpdate) {
      checkUpdateInformation()
      getVersion()
    }
  } catch (e) {
    console.log(e)
  }
}
interface SystemContentResponse {
  content: string
}

const contentList = ref<SystemContentResponse[]>([])

const checkUpdateInformation = async () => {
  if (!authStore.authToken) return
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/getUpdateInformation', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    if (!res.ok) return
    contentList.value = await res.json()
    isUpdateModalOpen.value = true
  } catch (e) {
    console.log(e)
  }
}

const isUpdateModalOpen = ref(false)
// 8. 掛載生命週期
onMounted(() => {
  checkUpdate()
  getBalance()
  checkNotificationPermission()
  wsHandle = createReconnectingStomp('/topic/balance/' + authStore?.member?.clanId, () => {
    getBalance()
  })
})
onUnmounted(() => {
  wsHandle?.disconnect()
  wsHandle = null
})
const closeUpdateModal = () => {
  isUpdateModalOpen.value = false
}
</script>

<template>
  <div class="dashboard">
    <div v-if="isUpdateModalOpen" class="custom-modal-overlay" @click.self="closeUpdateModal">
      <div class="custom-modal-content update-modal">
        <div class="modal-top-bar"></div>

        <div class="modal-icon update-icon">🚀</div>

        <div class="modal-title">Diamond Core 系統重大升級 (v{{ version }})</div>

        <div class="modal-desc update-desc">
          <p class="summary">
            親愛的用戶，我們剛完成了核心架構的翻修，本次升級將為您帶來更穩定、更專業的體驗：
          </p>

          <ul class="feature-list">
            <li v-for="(item, index) in contentList" :key="index">
              <span class="icon">{{ ['🚀', '✨', '🛡️', '⚡', '💰', '🔥'][index % 6] }}</span>

              <div class="text">
                <p>{{ item.content }}</p>
              </div>
            </li>
          </ul>

          <p class="footer-msg">Diamond Core 團隊 持續進化中。</p>
        </div>

        <div class="modal-actions">
          <button class="modal-btn btn-confirm btn-long" @click="closeUpdateModal">
            我知道了，立即體驗
          </button>
        </div>
      </div>
    </div>
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

    <div v-if="authStore.member" class="page-title-row">
      <h1>{{ authStore.member.clanName }} 血盟大廳</h1>
      <span
        v-if="trialDaysRemaining !== null"
        class="trial-chip"
        :class="trialChipClass"
        title="若需延長使用期限,請聯絡客服"
      >
        {{ trialChipText }}
      </span>
    </div>

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
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  box-shadow: 0 4px 15px rgba(var(--c-deep-rgb), 0.3);
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
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  padding: 30px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: popIn 0.3s ease-out;
}

h1 {
  margin-top: 5px;
  margin-bottom: 15px;
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
  border-color: rgba(var(--c-light-rgb), 0.2);
  background: rgba(17, 19, 28, 0.95);
  box-shadow: 0 6px 20px rgba(var(--c-light-rgb), 0.1);
  transform: translateY(-1px);
}

.balance-row.clan:hover {
  border-color: rgba(var(--c-light-rgb), 0.2);
  box-shadow: 0 6px 20px rgba(var(--c-light-rgb), 0.08);
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
  color: var(--c-mid);
}

.icon-wrapper.gold {
  color: var(--c-light);
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
  color: var(--c-light);
}

@media (max-width: 768px) {
  .dashboard {
    padding: 16px 12px;
  }
  h1 {
    font-size: 1.35rem;
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
.update-modal {
  position: relative;
  overflow: hidden; /* 為了讓 modal-top-bar 裁切 */
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  padding: 40px 30px 30px;
  width: 90%;
  max-width: 480px;
  text-align: left;
  box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.7);
  animation: popIn 0.3s ease-out;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 頂部金色漸層裝飾條 */
.modal-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, var(--c-light), var(--c-deep));
}

.modal-icon.update-icon {
  font-size: 3.5rem;
  margin-bottom: 20px;
  text-align: center; /* 圖示依然置中 */
  animation: rocketUp 1s ease-out; /* 加上小火箭飛上來的動畫 */
}

@keyframes rocketUp {
  0% {
    transform: translateY(30px) scale(0.8);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.update-modal .modal-title {
  color: var(--c-light);
  font-size: 1.4rem;
  font-weight: 900;
  margin-bottom: 20px;
  line-height: 1.3;
  letter-spacing: 0.5px;
  text-align: center;
  text-shadow:
    0 0 8px rgba(var(--c-light-rgb), 0.45),
    0 2px 12px rgba(var(--c-deep-rgb), 0.2);
}

.modal-desc.update-desc {
  color: #cbd5e1;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 28px;
}

.update-desc .summary {
  margin-bottom: 22px;
  color: #e2e8f0;
}

/* 功能清單列表樣式 */
.feature-list {
  list-style: none;
  padding: 16px;
  margin: 0 0 22px 0;
  border-radius: 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.feature-list li:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.feature-list li .icon {
  flex: 0 0 auto;
  font-size: 1.4rem;
  width: 28px;
  text-align: center;
}

.feature-list li .text {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.feature-list li strong {
  color: #e2e8f0;
  font-size: 1rem;
}

.feature-list li p {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.92rem;
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.footer-msg {
  text-align: center;
  font-size: 0.85rem;
  color: var(--c-light);
  font-style: italic;
  margin-top: 18px;
  opacity: 0.85;
}

.modal-actions {
  display: flex;
  justify-content: center; /* 按鈕置中 */
}

.modal-btn {
  padding: 14px 0;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

/* 按鈕改成長按鈕，符合專業設計 */
.btn-long {
  width: 100%;
}

.update-modal .btn-confirm {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  letter-spacing: 0.5px;
  box-shadow: 0 8px 25px rgba(var(--c-deep-rgb), 0.4);
}

.update-modal .btn-confirm:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(var(--c-deep-rgb), 0.5);
}
/* 👇 自訂彈窗的樣式 👇 */
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
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  padding: 30px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: popIn 0.3s ease-out;
}

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
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  box-shadow: 0 4px 15px rgba(var(--c-deep-rgb), 0.3);
}

.btn-confirm:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

/* 血盟大廳標題 + 試用倒數 chip */
.page-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.page-title-row h1 {
  margin: 0;
}
.trial-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.3px;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  cursor: help;
}
.trial-chip.trial-warning {
  background: rgba(239, 68, 68, 0.14);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.4);
}
.trial-chip.trial-expired {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.5);
}
</style>
