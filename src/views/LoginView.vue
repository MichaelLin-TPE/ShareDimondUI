<script setup lang="ts">
import { ref } from 'vue'

const account = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const login = async () => {
  error.value = ''
  loading.value = true

  try {
    // mock login
    await new Promise(resolve => setTimeout(resolve, 800))
    alert('登入成功（mock）')
  } catch (e) {
    error.value = '帳號或密碼錯誤'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <h2>ShareDiamond 登入</h2>

    <input v-model="account" placeholder="帳號" />
    <input v-model="password" type="password" placeholder="密碼" />

    <button @click="login" :disabled="loading">
      {{ loading ? '登入中...' : '登入' }}
    </button>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.login-container {
  max-width: 320px;
  margin: 120px auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

input {
  padding: 10px;
  font-size: 14px;
}

button {
  padding: 10px;
  font-weight: bold;
}

.error {
  color: #e53935;
  font-size: 14px;
}
</style>
