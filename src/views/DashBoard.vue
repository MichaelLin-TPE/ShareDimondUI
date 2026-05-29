<script setup lang="ts">
import StatCard from '@/components/StatCard.vue'
import TreasureCard from '@/components/TreasureCard.vue'
import ClanNotice from '@/components/ClanNotice.vue'
import { useAuthStore } from '@/stores/auth.ts'
import BiddingManagement from '@/components/BiddingManagement.vue'
import PendingSubmission from '@/components/PendingSubmission.vue'
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

// 競拍 / 結算 切換 tab
type AuctionTab = 'active' | 'settle' | 'unpaid'
const activeAuctionTab = ref<AuctionTab>('active')

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
    await res.json()
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
      await getFcmTokenSilently()
    } else {
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
    console.error(e)
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
    console.error(e)
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
    console.error(e)
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
    console.error(e)
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

      <!-- 餘額 pill (主題色,內嵌標題列省空間) -->
      <div class="title-balances">
        <div
          v-if="memberBalance.length > 0"
          class="balance-pill personal"
          title="我的帳戶"
        >
          <span class="pill-icon">👤</span>
          <div class="pill-currencies">
            <span v-for="b in memberBalance" :key="b.currency" class="pill-row">
              <span class="pill-cur">{{ b.currency }}</span>
              <span class="pill-amt">{{ b.balance.toLocaleString() }}</span>
            </span>
          </div>
        </div>

        <div
          v-if="clanBalance.length > 0"
          class="balance-pill clan"
          title="血盟金庫"
        >
          <span class="pill-icon">🏰</span>
          <div class="pill-currencies">
            <span v-for="b in clanBalance" :key="b.currency" class="pill-row">
              <span class="pill-cur">{{ b.currency }}</span>
              <span class="pill-amt">{{ b.balance.toLocaleString() }}</span>
            </span>
          </div>
        </div>
      </div>

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

    <div class="stats">
      <TreasureCard class="treasureCard" />

      <!-- 競拍 / 結算 切換 (使用 .seg-tabs pattern) -->
      <div class="auction-tabs">
        <button
          type="button"
          class="auction-tab-btn"
          :class="{ active: activeAuctionTab === 'active' }"
          @click="activeAuctionTab = 'active'"
        >
          🎯 競拍中
        </button>
        <button
          type="button"
          class="auction-tab-btn"
          :class="{ active: activeAuctionTab === 'settle' }"
          @click="activeAuctionTab = 'settle'"
        >
          🏆 待結算
        </button>
        <button
          type="button"
          class="auction-tab-btn"
          :class="{ active: activeAuctionTab === 'unpaid' }"
          @click="activeAuctionTab = 'unpaid'"
        >
          📦 待繳交
        </button>
      </div>

      <StatCard v-show="activeAuctionTab === 'active'" />
      <BiddingManagement
        v-show="activeAuctionTab === 'settle'"
        class="biddingManagement"
      />
      <PendingSubmission v-show="activeAuctionTab === 'unpaid'" />
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
  /* 防止內部某子元素超寬撐出橫向 scrollbar */
  max-width: 100%;
  overflow-x: hidden;
}

.stats {
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* 競拍/結算 tab — 套 PersonalMarket .seg-tabs pattern (父 48 / 子 38 / flex 1 1 0) */
.auction-tabs {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 4px;
  background-color: #14161f;
  border: 1px solid #24263a;
  border-radius: 10px;
  gap: 4px;
  box-sizing: border-box;
  overflow: hidden;
  margin-top: -16px; /* 收緊跟上方 TreasureCard 的距離 (.stats gap 32 太大) */
}
.auction-tab-btn {
  flex: 1 1 0;
  min-width: 0;
  height: 38px; /* 48 - 4*2 padding - 1*2 border = 38 */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: #94a3b8;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s ease;
  line-height: 1;
}
.auction-tab-btn:hover:not(.active) {
  color: #fff;
}
.auction-tab-btn.active {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}

:deep(ClanNotice) {
  margin-bottom: 24px;
}

/* === 標題列內嵌餘額 pill (取代之前的 balance-dashboard-compact) === */
.title-balances {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  /* 桌機把餘額推到標題右邊,試用 chip 在更右 */
  margin-left: auto;
  /* 手機 wrap 後跟標題對齊 */
  align-items: center;
}

.balance-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  background: rgba(var(--c-light-rgb), 0.06);
  border: 1px solid rgba(var(--c-light-rgb), 0.22);
  transition: all 0.18s ease;
  max-width: 100%;
  min-width: 0;
}
.balance-pill:hover {
  background: rgba(var(--c-light-rgb), 0.1);
  border-color: rgba(var(--c-light-rgb), 0.4);
}
/* clan pill 用 deep 色當主軸,跟 personal 區隔開 (兩種主題色都會跟著變) */
.balance-pill.clan {
  background: rgba(var(--c-deep-rgb), 0.08);
  border-color: rgba(var(--c-deep-rgb), 0.28);
}
.balance-pill.clan:hover {
  background: rgba(var(--c-deep-rgb), 0.13);
  border-color: rgba(var(--c-deep-rgb), 0.45);
}

.pill-icon {
  font-size: 1.05rem;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(var(--c-light-rgb), 0.4));
}
.balance-pill.clan .pill-icon {
  filter: drop-shadow(0 0 6px rgba(var(--c-deep-rgb), 0.4));
}

/* 多幣別橫排,寬度不夠就橫向 scroll (隱藏 scrollbar) */
.pill-currencies {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  min-width: 0;
}
.pill-currencies::-webkit-scrollbar {
  display: none;
}
.pill-row {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
/* 幣別之間用 · 分隔 */
.pill-row + .pill-row::before {
  content: '·';
  color: rgba(255, 255, 255, 0.3);
  margin: 0 6px 0 2px;
  font-weight: 700;
}
.pill-cur {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 500;
}
.pill-amt {
  /* 個人 + 金庫共用主題主色,確保 indigo / razer 兩個金額顏色一致
     兩個 pill 的視覺區隔已經由 background / border / icon 處理 */
  color: var(--c-light);
  font-weight: 700;
  font-size: 0.88rem;
  letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  /* 手機 wrap 到下一行,兩個 pill 各佔整行,並有清楚的 row 間距 */
  .page-title-row {
    /* 標題 -> 餘額 -> 試用 chip 三層,間距大一點才不擠 */
    gap: 10px;
    margin-bottom: 18px;
  }
  /* 取消 ClanLayout :deep(.page-title-row) padding-left: 48px (那是給 H1 讓出 hamburger 空間用的)
     讓 pill 真正占滿 dashboard 內容寬度 */
  .title-balances {
    margin-left: -48px;
    width: calc(100% + 48px);
    flex-direction: column;
    gap: 8px;
  }
  .balance-pill {
    width: 100%;
    flex: none;
    min-width: 0;
    padding: 8px 12px;
  }
  .pill-amt {
    font-size: 0.82rem;
  }
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
}
.update-modal {
  position: relative;
  overflow: hidden; /* 為了讓 modal-top-bar 裁切 */
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  padding: 44px 48px 32px;
  width: 92%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  text-align: left;
  box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.7);
  animation: popIn 0.3s ease-out;
}
/* 手機保持原本緊湊樣 */
@media (max-width: 640px) {
  .update-modal {
    padding: 32px 20px 24px;
    max-width: 480px;
  }
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
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
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
  text-align: left;
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

/* 血盟大廳標題 + 餘額 pill + 試用倒數 chip */
.page-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  /* 跟下方 ClanNotice 隔開,不然視覺上黏在一起 */
  margin-bottom: 20px;
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
