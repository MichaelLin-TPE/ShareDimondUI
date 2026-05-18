<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import ClanSelect from '@/components/ClanSelect.vue'
const showApplyClanModal = ref(false)
// 自動登入狀態
const isAutoLoggingIn = ref(false)
const autoLoginStage = ref<'verifying' | 'success' | 'failed'>('verifying')

interface Clan {
  id: string
  name: string
  clanId: string
}
const authStore = useAuthStore()
// 比對clanId取出血盟名稱
const selectedClanName = computed(() => {
  if (selectedClan.value === '') return ''
  const clan = clans.value.find((c) => c.clanId === selectedClan.value)
  return clan?.name ?? ''
})
const selectedClanNameForApply = computed(() => {
  if (selectedClanForAppyly.value === '') return ''
  const clan = clans.value.find((c) => c.clanId === selectedClanForAppyly.value)
  return clan?.name ?? ''
})

//打API取得所有支援的血盟---------------------------------------
const clans = ref<Clan[]>([])
const fetchClans = async () => {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/clans', {
      method: 'GET',
      headers: {
        Sign: generateSignature(currentTimestamp),
        TimeStamp: currentTimestamp,
      },
    })

    if (!res.ok) {
      throw new Error('取得血盟失敗')
    }
    clans.value = await res.json()
  } catch (e) {
    console.error(e)
    error.value = '無法取得血盟資料'
  }
}

onMounted(() => {
  fetchClans()
  if (authStore.authToken != null && authStore.authToken.length > 0) {
    autoLoginByToken()
  }
})

const autoLoginByToken = async () => {
  isAutoLoggingIn.value = true
  autoLoginStage.value = 'verifying'
  const startedAt = Date.now()
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/loginByToken', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        'Content-Type': 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      autoLoginStage.value = 'failed'
      // 失敗時讓使用者看到「驗證失敗」訊息再退回登入畫面
      await new Promise((resolve) => setTimeout(resolve, 900))
      isAutoLoggingIn.value = false
      return
    }
    authStore.setToken(data.authToken)
    authStore.setMember(data)
    showApplyClanModal.value = false
    autoLoginStage.value = 'success'
    // 最少顯示 800ms 避免閃一下，且保留原本的 1500ms 體驗
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, 2000 - elapsed)
    await new Promise((resolve) => setTimeout(resolve, remaining))
    isAutoLoggingIn.value = false
    router.replace('/clan')
  } catch (e) {
    console.error(e)
    autoLoginStage.value = 'failed'
    await new Promise((resolve) => setTimeout(resolve, 900))
    isAutoLoggingIn.value = false
  }
}

//打API取得所有支援的血盟---------------------------------------

const addMember = async () => {
  errorForApply.value = ''
  if (
    !accountForApply.value ||
    !passwordForApply.value ||
    !passwordForApplyAgain.value ||
    !userNameForApply.value
  ) {
    errorForApply.value = '請填滿所有的欄位!'
    return
  }
  if (passwordForApply.value != passwordForApplyAgain.value) {
    errorForApply.value = '請填寫正確的密碼'
    return
  }

  if (!selectedClanForAppyly.value) {
    errorForApply.value = '請選擇要加入的血盟'
    return
  }

  loadingForApply.value = true

  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/addMember', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        method: 'POST',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
      body: JSON.stringify({
        account: accountForApply.value,
        password: passwordForApply.value,
        clanId: selectedClanForAppyly.value,
        userName: userNameForApply.value,
        email: emailForAPply.value,
      }),
    })
    if (!res.ok) {
      const errorBody = await res.json()
      errorForApply.value = errorBody.message
      return
    }
    // 後端回傳 BaseResponse:申請已送出,需等會長審核通過後才能登入 (不直接登入)
    showApplyClanModal.value = false
    useAlert.success(
      `申請已送出！\n血盟：${selectedClanNameForApply.value}\n請等待會長審核通過後再登入`,
    )
  } catch (e) {
    console.error(e)
    errorForApply.value = '申請失敗'
  } finally {
    loadingForApply.value = false
  }
}

const selectedClan = ref('')
const selectedClanForAppyly = ref('')
const accountForApply = ref('')
const passwordForApply = ref('')
const passwordForApplyAgain = ref('')
const userNameForApply = ref('')
const emailForAPply = ref('')

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const errorForApply = ref('')
const loadingForApply = ref(false)

const login = async () => {
  error.value = ''
  if (!account.value || !password.value || !selectedClan.value) {
    error.value = '請填寫帳號,密碼,血盟'
    return
  }

  loading.value = true

  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        method: 'POST',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
      body: JSON.stringify({
        account: account.value,
        password: password.value,
        clanId: selectedClan.value,
      }),
    })
    if (!res.ok) {
      const errorBody = await res.json()
      error.value = errorBody.message
      return
    }
    const data = await res.json()
    authStore.setToken(data.authToken)
    authStore.setMember(data)
    showApplyClanModal.value = false
    await new Promise((resolve) => setTimeout(resolve, 1500))
    useAlert.success(`登入成功\n血盟：${selectedClanName.value}`)
    router.replace('/clan')
  } catch (e) {
    console.error(e)
    error.value = '登入失敗'
  } finally {
    loading.value = false
  }
}

const createClan = () => {
  router.push({ name: 'CreateGuild' })
}

const onApplyClan = () => {
  showApplyClanModal.value = true
  errorForApply.value = ''
  loadingForApply.value = false
}
const router = useRouter()
const onForgotPassword = () => {
  router.push({ name: 'ForgotPassword' })
}
</script>

<template>
  <div class="page">
    <div class="login-card">
      <div class="logo-area">
        <!-- 之後可以換成你的鑽石 LOGO -->
        <div class="logo-glow">◆</div>
        <h2>Diamond Core</h2>
        <p class="subtitle">System Access</p>
      </div>

      <form class="form" @submit.prevent="login">
        <ClanSelect v-model="selectedClan" :clans="clans" placeholder="選擇血盟" />

        <input v-model="account" placeholder="Account" autocomplete="username" />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />

        <button type="submit" :disabled="loading">
          <span v-if="!loading">登入系統</span>
          <span v-else class="loading">驗證中…</span>
        </button>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="action-links">
          <span class="link left" @click="onApplyClan"> 申請加入血盟 </span>
          <span class="link left" @click="createClan"> 建立血盟 </span>
          <span class="link right" @click="onForgotPassword"> 忘記密碼 </span>
        </div>
      </form>
    </div>

    <!-- 自動登入覆蓋層 -->
    <Transition name="auto-fade">
      <div v-if="isAutoLoggingIn" class="auto-login-overlay">
        <div class="auto-login-card">
          <div class="al-logo-wrap">
            <div class="al-logo" :class="autoLoginStage">
              {{ autoLoginStage === 'success' ? '✓' : autoLoginStage === 'failed' ? '✕' : '◆' }}
            </div>
            <div v-if="autoLoginStage === 'verifying'" class="al-ring"></div>
          </div>

          <h2 class="al-title">Diamond Core</h2>

          <div class="al-stage">
            <template v-if="autoLoginStage === 'verifying'">
              <p class="al-msg">正在為您自動登入...</p>
              <p class="al-sub">驗證登入憑證中，請稍候</p>
            </template>
            <template v-else-if="autoLoginStage === 'success'">
              <p class="al-msg success">驗證成功</p>
              <p class="al-sub">正在進入血盟大廳...</p>
            </template>
            <template v-else>
              <p class="al-msg failed">憑證已過期</p>
              <p class="al-sub">請重新登入</p>
            </template>
          </div>

          <div v-if="autoLoginStage === 'verifying'" class="al-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 申請血盟 Modal -->
    <div v-if="showApplyClanModal" class="modal-mask">
      <div class="modal-card">
        <h3>申請加入血盟</h3>

        <ClanSelect v-model="selectedClanForAppyly" :clans="clans" placeholder="選擇血盟" />

        <input v-model="accountForApply" placeholder="請輸入帳號" />

        <input v-model="passwordForApply" type="password" placeholder="請輸入密碼" />
        <input v-model="passwordForApplyAgain" type="password" placeholder="再次輸入密碼" />
        <input v-model="userNameForApply" type="text" placeholder="請輸入遊戲名稱" />
        <input v-model="emailForAPply" type="email" placeholder="請輸入電子郵件" />
        <p v-if="errorForApply" class="errorForApply">{{ errorForApply }}</p>

        <button @click="addMember" :disabled="loadingForApply">
          <span v-if="!loadingForApply">提交申請</span>
          <span v-else class="loadingForApply">驗證中…</span>
        </button>

        <button class="close-btn" @click="showApplyClanModal = false">關閉</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* === 統一設計變數 ===
   主色 (LOGO/連結/光暈): var(--c-light) (indigo-300) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   按鈕主色: var(--c-light) (金) / linear-gradient(135deg, var(--c-light), var(--c-deep))
   字級: 1.5 / 1 / 0.95 / 0.85 / 0.78 rem
   文字: #fff / #e2e8f0 / #94a3b8 / #64748b
*/

/* ===== 背景 ===== */
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: 'Inter', 'PingFang TC', system-ui, sans-serif;
  padding: 40px 20px;
}

/* ===== 登入卡片 ===== */
.login-card {
  width: 360px;
  max-width: 100%;
  padding: 32px 28px 36px;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}

/* ===== LOGO 區 ===== */
.logo-area {
  text-align: center;
  margin-bottom: 24px;
}
.logo-glow {
  font-size: 42px;
  color: var(--c-light);
  margin-bottom: 8px;
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}
.logo-area h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  /* 所有主題: Diamond Core 一律白字,暈光跟主題色 */
  color: #ffffff;
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}

/* 紫藍主題: 還原一個月前的菱形配色 + Diamond Core 改白字 */
:root[data-theme='indigo'] .logo-glow {
  color: #6cf2ff;
  text-shadow:
    0 0 12px rgba(108, 242, 255, 0.9),
    0 0 32px rgba(180, 110, 255, 0.8);
}
:root[data-theme='indigo'] .logo-area h2 {
  color: #ffffff;
  text-shadow:
    0 0 8px rgba(108, 242, 255, 0.45),
    0 2px 12px rgba(180, 110, 255, 0.3);
}

/* 自動登入大菱形 + 標題 — 同樣套青紫雙色 (loading 狀態) */
:root[data-theme='indigo'] .al-logo {
  color: #6cf2ff;
  text-shadow:
    0 0 16px rgba(108, 242, 255, 0.85),
    0 0 36px rgba(180, 110, 255, 0.7);
}
:root[data-theme='indigo'] .al-title {
  background: none;
  -webkit-background-clip: initial;
  -webkit-text-fill-color: initial;
  background-clip: initial;
  color: #ffffff;
  text-shadow:
    0 0 8px rgba(108, 242, 255, 0.45),
    0 2px 12px rgba(180, 110, 255, 0.3);
}

.subtitle {
  margin-top: 4px;
  font-size: 0.78rem;
  color: #64748b;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 600;
}

/* ===== 表單 ===== */
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

input {
  height: 42px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #2e3147;
  outline: none;
  background: #0f111a;
  color: #fff;
  font-size: 0.95rem;
  transition: all 0.15s;
  box-sizing: border-box;
}
input::placeholder {
  color: #475569;
}
input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.18);
}

/* ===== 按鈕 (主動作 — 金色漸層) ===== */
button {
  height: 48px;
  width: 100%;
  margin-top: 6px;
  border-radius: 12px;
  border: none;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--c-on);
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.3);
  transition: all 0.2s;
}
button:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(var(--c-deep-rgb), 0.4);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 錯誤訊息 ===== */
.errorForApply,
.error {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #f87171;
  text-align: center;
}

/* ===== loading 動畫 ===== */
.loadingForApply,
.loading {
  animation: pulse 1.2s infinite;
}

/* ===== 底部操作連結 ===== */
.action-links {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  font-size: 0.85rem;
}
.link {
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  transition:
    color 0.18s,
    text-shadow 0.18s;
}
.link:hover {
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.4);
}

/* ===== Modal 遮罩 ===== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 24px;
}

/* ===== Modal 卡片 ===== */
.modal-card {
  width: 100%;
  max-width: 380px;
  padding: 28px 24px 22px;
  border-radius: 24px;
  background: rgba(22, 24, 34, 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #e2e8f0;
}
.modal-card h3 {
  text-align: center;
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Modal 共用 input / select(讓 .modal-card 內的覆蓋全域 button 的金色) */
.modal-card input,
.modal-card select {
  width: 100%;
  box-sizing: border-box;
}

/* ===== Modal 關閉鈕 — 次要按鈕風格 ===== */
.close-btn {
  height: 42px;
  background: #1e2233;
  border: 1px solid #3a3f5c;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 12px;
  cursor: pointer;
  margin-top: 4px;
  box-shadow: none;
  transition: all 0.15s;
}
.close-btn:hover:not(:disabled) {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
  filter: none;
  transform: none;
  box-shadow: none;
}

/* ===== Mobile ===== */
@media (max-width: 600px) {
  .page {
    align-items: flex-start;
    padding: 18px 0 180px;
    margin: 0;
  }
  .login-card {
    width: calc(100vw - 48px);
    max-width: calc(100vw - 48px);
    margin: 0 24px;
    padding: 28px 20px 30px;
    border-radius: 16px;
  }
  .logo-glow {
    font-size: 38px;
  }
  .logo-area h2 {
    font-size: 1.4rem;
  }
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* ===== 自動登入覆蓋層 ===== */
.auto-login-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  padding: 24px;
}

.auto-login-card {
  text-align: center;
  max-width: 340px;
}

.al-logo-wrap {
  position: relative;
  width: 92px;
  height: 92px;
  margin: 0 auto 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.al-logo {
  font-size: 46px;
  font-weight: 700;
  color: var(--c-light);
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  animation: al-pulse 2s ease-in-out infinite;
}
.al-logo.success {
  color: #6ee7b7;
  text-shadow:
    0 0 16px rgba(110, 231, 183, 0.9),
    0 0 36px rgba(16, 185, 129, 0.6);
  animation: al-pop 0.4s ease-out;
}
.al-logo.failed {
  color: #fca5a5;
  text-shadow:
    0 0 16px rgba(252, 165, 165, 0.8),
    0 0 36px rgba(239, 68, 68, 0.5);
  animation: al-pop 0.4s ease-out;
}

/* 旋轉光環 */
.al-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--c-light);
  border-right-color: rgba(var(--c-deep-rgb), 0.6);
  animation: al-spin 1.2s linear infinite;
  box-shadow: 0 0 20px rgba(var(--c-light-rgb), 0.35);
}

.al-title {
  margin: 0 0 18px;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 2px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.al-stage {
  min-height: 52px;
}
.al-msg {
  margin: 0 0 5px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: 0.5px;
}
.al-msg.success {
  color: #6ee7b7;
}
.al-msg.failed {
  color: #fca5a5;
}
.al-sub {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  letter-spacing: 1px;
}

/* 三點點動畫 */
.al-dots {
  margin-top: 18px;
  display: flex;
  justify-content: center;
  gap: 6px;
}
.al-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--c-light);
  opacity: 0.3;
  animation: al-dot 1.2s ease-in-out infinite;
}
.al-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.al-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes al-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes al-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}
@keyframes al-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  60% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes al-dot {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
    box-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.7);
  }
}

/* Transition 動畫 */
.auto-fade-enter-active,
.auto-fade-leave-active {
  transition: opacity 0.3s ease;
}
.auto-fade-enter-from,
.auto-fade-leave-to {
  opacity: 0;
}
</style>
