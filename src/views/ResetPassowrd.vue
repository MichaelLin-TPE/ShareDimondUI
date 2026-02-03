<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const token = route.query.token as string | undefined
const passwordNew = ref('')
const passwordAgain = ref('')
const error = ref('')
const loading = ref(false)

const sendNewPassword = async () => {
  error.value = ''
  if (!token) {
    handleInvalidToken()
    return
  }
  if (!passwordNew.value) {
    error.value = '請輸入密碼'
    return
  }
  if (!passwordAgain.value) {
    error.value = '請再次輸入密碼'
    return
  }
  if (passwordAgain.value != passwordNew.value) {
    error.value = '請檢察密碼是否一致'
    return
  }
  loading.value = true
  try {
    const res = await fetch('https://gameshare-system.com/update-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        passwordNew: passwordNew.value,
      }),
    })
    if (!res.ok) {
      const errorBody = await res.json()
      if (errorBody.status == -999) {
        handleInvalidToken()
        return
      }
      error.value = errorBody.message
      return
    }
    alert('更新密碼成功,請好好保存您的新密碼!')
    router.replace('/login')
  } catch (e) {
    handleInvalidToken()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!token) {
    handleInvalidToken()
    return
  }
  try {
    const res = await fetch('https://gameshare-system.com/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) {
      handleInvalidToken()
    }
  } catch (e) {
    handleInvalidToken()
  }
})
const handleInvalidToken = () => {
  alert('憑證過期,請重新發送驗證信!')
  router.replace('/login')
}
</script>

<template>
  <div class="about">
    <div class="header_view">
      <img
        alt="Vue logo"
        class="logo"
        src="@/assets/share_diamond_logo.png"
        width="100"
        height="100"
      />
      <h1 class="header_title">DiamondCore</h1>
    </div>
    <div class="title">
      <h2>重設密碼</h2>
    </div>
    <div class="input_password">
      <input
        v-model="passwordNew"
        type="password"
        placeholder="請輸入新密碼"
        autocomplete="password"
      />
    </div>
    <div class="input_password_again">
      <input
        v-model="passwordAgain"
        type="password"
        placeholder="請再次輸入新密碼"
        autocomplete="password"
      />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button @click="sendNewPassword" :disabled="loading">
      <span v-if="!loading">提交新密碼</span>
      <span v-else class="loading">發送中…</span>
    </button>
  </div>
</template>

<style>
/* ===== 錯誤 ===== */
button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}
.error {
  margin-top: 10px;
  font-size: 14px;
  color: #ff6b6b;
  text-align: center;
}

/* ===== Placeholder ===== */
input::placeholder {
  color: #b5b9e3;
  opacity: 1;
}

button {
  width: 50%;
  height: 60px;
  margin-top: 22px;

  border-radius: 12px;
  border: none;

  font-size: 14px;
  font-weight: 600;
  letter-spacing: 1px;

  color: #0b0f1a;
  background: linear-gradient(135deg, #6cf2ff, #b46eff);

  cursor: pointer;
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    opacity 0.15s;
}

/* ===== Input ===== */
.input_password,
.input_password_again {
  width: 50%;
  margin-top: 28px;
}
input {
  width: 100%;
  height: 60px;
  padding: 0 16px;

  border-radius: 12px;
  border: none;
  outline: none;

  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font-size: 14px;
  letter-spacing: 0.5px;

  transition:
    background 0.2s,
    box-shadow 0.2s;
}

input:focus {
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 2px rgba(108, 242, 255, 0.35);
}

.about {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ===== Header ===== */
.header_view {
  display: flex;
  align-items: center;
}

.header_title {
  margin-left: 16px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #f5f7fa;
}

/* ===== 手機 / App ===== */
@media (max-width: 768px) {
  .input_password_again,
  .input_password {
    width: 80%;
  }

  button {
    width: 80%;
  }
}
</style>
