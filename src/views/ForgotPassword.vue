<script setup lang="ts">
import { ref } from 'vue'
const email = ref('')
const loading = ref(false)
const error = ref('')

const login = async () => {
  if (!email.value) {
    error.value = '請輸入驗證電子郵件地址'
    return
  }
  loading.value = true
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
      <h2>忘記密碼</h2>
    </div>
    <div class="input_email">
      <input v-model="email" placeholder="請輸入驗證電子郵件地址" autocomplete="email" />
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <button @click="login" :disabled="loading">
      <span v-if="!loading">傳送驗證信件</span>
      <span v-else class="loading">發送中…</span>
    </button>
  </div>
</template>

<style>
/* ===== 錯誤 ===== */
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
button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
}
/* ===== 容器 ===== */
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

/* ===== Title ===== */
.title {
  margin-top: 32px; /* 原本 24 → 32 */
  font-size: 14px;
  color: white;
}

/* ===== Input 區 ===== */
.input_email {
  width: 50%;
  margin-top: 28px;
}

/* ===== Input ===== */
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

/* ===== Button ===== */
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

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(108, 242, 255, 0.35);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== 手機 / App ===== */
@media (max-width: 768px) {
  .input_email {
    width: 80%;
  }

  button {
    width: 80%;
  }
}
</style>
