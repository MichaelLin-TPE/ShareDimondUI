<script setup lang="ts">
import {ref,onMounted} from 'vue'

interface Clan{
  id:string,
  name:string
}
const fetchClans = async ()=>{
  try{
    const res = await fetch('http://localhost:8080/clans')
    if (!res.ok){
      throw new Error("取得血盟失敗")
    }
    clans.value = await res.json()
  }catch (e){
    console.error(e)
    error.value = '無法取得血盟資料'
  }
}

onMounted(()=>{
  fetchClans()
})

const clans = ref<Clan[]>([])

const selectedClan = ref('')

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const login = async () => {
  error.value = ''
  loading.value = true

  try {
    if (!selectedClan.value) {
      throw new Error('請選擇血盟')
    }

    await new Promise(resolve => setTimeout(resolve, 800))
    alert(`登入成功（mock）\n血盟：${selectedClan.value}`)
  } catch (e) {
    error.value = '登入失敗'
  } finally {
    loading.value = false
  }
}
const onApplyClan = () => {
  alert('申請加入血盟（mock）')
}

const onForgotPassword = () => {
  alert('忘記密碼（mock）')
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

      <div class="form">
        <select
          v-model="selectedClan"
          :class="{ selected: selectedClan !== '' }">
          <option value="" disabled>選擇血盟</option>
          <option
            v-for="clan in clans"
            :key="clan.id"
            :value="clan.id"
          >
            {{ clan.name }}
          </option>
        </select>

        <input
          v-model="account"
          placeholder="Account"
          autocomplete="username"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />

        <button @click="login" :disabled="loading">
          <span v-if="!loading">登入系統</span>
          <span v-else class="loading">驗證中…</span>
        </button>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="action-links">
          <span class="link left" @click="onApplyClan">
              申請加入血盟
          </span>
          <span class="link right" @click="onForgotPassword">
              忘記密碼
          </span>
        </div>

      </div>
    </div>
  </div>
</template>


<style scoped>


/* ===== 底部操作連結 ===== */
.action-links {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  font-size: 14px;
}

.link {
  color: var(--text-placeholder);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s, text-shadow 0.2s;
}

.link:hover {
  color: var(--text-primary);
  text-shadow: 0 0 8px rgba(108, 242, 255, 0.4);
}


/* ===== Mobile 微調 ===== */
@media (max-width: 480px) {
  .page {
    align-items: flex-start; /* 不再垂直置中 */
    padding-bottom: 200px; /* 往上推，但不要貼頂 */
  }
}

:root {
  --text-primary: #e6faff; /* 跟 input 輸入後一致 */
  --text-placeholder: #b5b9e3; /* 跟 Account placeholder 一致 */
}

select {
  height: 42px;
  padding: 0 14px;
  border-radius: 10px;
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-placeholder); /* 像 Account placeholder */
  font-size: 14px;
  appearance: none;
  cursor: pointer;
}

/* 當真的選到血盟 */
select.selected {
  color: var(--text-primary);
}

select option {
  color: #000;
}


select:focus {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(108, 242, 255, 0.6),
  0 0 12px rgba(108, 242, 255, 0.35);
}

/* ===== 背景 ===== */
.page {
  --text-primary: #e6faff;
  --text-placeholder: #b5b9e3;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: 'Inter', 'PingFang TC', system-ui, sans-serif;
}

/* ===== 卡片 ===== */
.login-card {
  width: 360px;
  padding: 32px 28px 36px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.06),
    rgba(255, 255, 255, 0.02)
  );
  border-radius: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45),
  inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

/* ===== LOGO 區 ===== */
.logo-area {
  text-align: center;
  margin-bottom: 24px;
}

.logo-glow {
  font-size: 42px;
  color: #6cf2ff;
  margin-bottom: 8px;
  text-shadow: 0 0 12px rgba(108, 242, 255, 0.9),
  0 0 32px rgba(180, 110, 255, 0.8);
}

.logo-area h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 1px;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #9aa4d6;
  letter-spacing: 2px;
  text-transform: uppercase;
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
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 14px;
  transition: box-shadow 0.2s, background 0.2s;
}

input::placeholder {
  color: #b5b9e3;
}

input:focus {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(108, 242, 255, 0.6),
  0 0 12px rgba(108, 242, 255, 0.35);
}

/* ===== 按鈕 ===== */
button {
  height: 44px;
  margin-top: 6px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #0b0f1a;
  background: linear-gradient(135deg, #6cf2ff, #b46eff);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 30px rgba(180, 110, 255, 0.45);
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ===== 錯誤 ===== */
.error {
  margin-top: 4px;
  font-size: 13px;
  color: #ff6b6b;
  text-align: center;
}

/* ===== loading ===== */
.loading {
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1
  }
  50% {
    opacity: 0.5
  }
  100% {
    opacity: 1
  }
}
</style>
