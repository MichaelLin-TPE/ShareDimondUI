<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const authStore = useAuthStore()

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  at: string
}

const isOpen = ref(false)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const messageScroll = ref<HTMLDivElement | null>(null)
const hasUnreadHint = ref(true) // 第一次小紅點提示

const SUGGESTIONS = ['地龍多久重生?', '怎麼提款?', '我們公會分潤怎麼算?']

let nextId = 1

const showWelcome = computed(() => messages.value.length === 0)

const pushMsg = (role: 'user' | 'assistant', content: string) => {
  messages.value.push({
    id: nextId++,
    role,
    content,
    at: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
  })
  nextTick(() => {
    if (messageScroll.value) {
      messageScroll.value.scrollTop = messageScroll.value.scrollHeight
    }
  })
}

const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

const send = async (questionOverride?: string) => {
  const q = (questionOverride ?? inputText.value).trim()
  if (!q || loading.value) return
  pushMsg('user', q)
  inputText.value = ''
  loading.value = true
  try {
    const res = await fetch('https://api.gameshare-system.com/ai/faq/ask', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ question: q }),
    })
    const data = await res.json()
    if (!res.ok) {
      pushMsg('assistant', '⚠️ AI 暫時無法回答,請稍後再試')
      return
    }
    pushMsg('assistant', data.answer ?? '(空白回應)')
  } catch (e) {
    console.error(e)
    pushMsg('assistant', '⚠️ 連線失敗,請稍後再試')
  } finally {
    loading.value = false
  }
}

const onEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

const toggle = () => {
  isOpen.value = !isOpen.value
  hasUnreadHint.value = false
  if (isOpen.value) {
    nextTick(() => {
      if (messageScroll.value) {
        messageScroll.value.scrollTop = messageScroll.value.scrollHeight
      }
    })
  }
}
</script>

<template>
  <!-- 浮動按鈕 (永遠顯示, 無論 isOpen) -->
  <button
    type="button"
    class="float-btn"
    :class="{ 'is-open': isOpen }"
    :title="isOpen ? '收起 AI 助手' : '打開 AI 助手'"
    @click="toggle"
  >
    <span v-if="!isOpen" class="float-btn-icon">🤖</span>
    <span v-else class="float-btn-icon">✕</span>
    <span v-if="!isOpen && hasUnreadHint" class="float-btn-dot"></span>
  </button>

  <!-- 對話視窗 -->
  <transition name="fade-up">
    <div v-if="isOpen" class="float-window">
      <header class="float-head">
        <div class="float-head-text">
          <div class="float-title">🤖 AI 助手</div>
          <div class="float-sub">問我遊戲問題</div>
        </div>
        <button type="button" class="float-close" @click="toggle">✕</button>
      </header>

      <div ref="messageScroll" class="float-scroll">
        <div v-if="showWelcome" class="welcome">
          <div class="welcome-icon">👋</div>
          <div class="welcome-text">
            哈囉！我可以回答遊戲機制、道具、Boss、本公會規則等問題。
          </div>
          <div class="welcome-suggestions">
            <button
              v-for="s in SUGGESTIONS"
              :key="s"
              type="button"
              class="welcome-chip"
              @click="send(s)"
            >{{ s }}</button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="float-msg-row"
          :class="msg.role === 'user' ? 'msg-row-user' : 'msg-row-assistant'"
        >
          <div class="float-msg-bubble" :class="`bubble-${msg.role}`">
            {{ msg.content }}
          </div>
        </div>

        <div v-if="loading" class="float-msg-row msg-row-assistant">
          <div class="float-msg-bubble bubble-assistant typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="float-composer">
        <input
          v-model="inputText"
          type="text"
          class="float-input"
          placeholder="問問題..."
          :disabled="loading"
          @keydown="onEnter"
        />
        <button
          type="button"
          class="float-send"
          :disabled="loading || !inputText.trim()"
          @click="send()"
        >
          ↑
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* === 浮動按鈕 === */
.float-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  border: none;
  cursor: pointer;
  z-index: 1080;
  box-shadow: 0 6px 20px rgba(var(--c-deep-rgb), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  transition: transform 0.2s, box-shadow 0.2s;
  padding: 0;
}
.float-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 28px rgba(var(--c-deep-rgb), 0.7);
}
.float-btn.is-open {
  background: #161822;
  border: 1px solid #2e3147;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}
.float-btn-icon {
  font-size: 26px;
  line-height: 1;
  color: var(--c-on);
}
.float-btn.is-open .float-btn-icon {
  color: #94a3b8;
  font-size: 18px;
}
.float-btn-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5252;
  border: 2px solid #0b0d14;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

/* === 對話視窗 === */
.float-window {
  position: fixed;
  right: 20px;
  bottom: 88px;
  width: 360px;
  height: 520px;
  max-height: calc(100vh - 110px);
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  z-index: 1079;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* fade-up transition */
.fade-up-enter-active, .fade-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-up-enter-from, .fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* === 視窗 header === */
.float-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(var(--c-light-rgb), 0.2), rgba(var(--c-deep-rgb), 0.2));
  border-bottom: 1px solid #24263a;
}
.float-head-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.float-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #e2e8f0;
  line-height: 1.2;
}
.float-sub {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 2px;
  line-height: 1.2;
}
.float-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid #2e3147;
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.float-close:hover {
  background: #1f2233;
  color: #e2e8f0;
}

/* === Scroll 區 === */
.float-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.float-scroll::-webkit-scrollbar {
  width: 4px;
}
.float-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}

/* === Welcome 區 === */
.welcome {
  text-align: center;
  padding: 16px 8px;
  color: #cbd5e1;
}
.welcome-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.welcome-text {
  font-size: 0.85rem;
  line-height: 1.5;
  margin-bottom: 14px;
  color: #94a3b8;
}
.welcome-suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.welcome-chip {
  padding: 9px 12px;
  background: #161822;
  border: 1px solid #2e3147;
  border-radius: 18px;
  color: #cbd5e1;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1.2;
  transition: all 0.15s;
}
.welcome-chip:hover {
  background: rgba(var(--c-light-rgb), 0.15);
  color: var(--c-light);
  border-color: rgba(var(--c-light-rgb), 0.4);
}

/* === Message bubbles === */
.float-msg-row {
  display: flex;
}
.msg-row-user {
  justify-content: flex-end;
}
.msg-row-assistant {
  justify-content: flex-start;
}
.float-msg-bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
  box-sizing: border-box;
}
.bubble-user {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-bottom-right-radius: 4px;
  font-weight: 600;
}
.bubble-assistant {
  background: #161822;
  border: 1px solid #24263a;
  color: #e2e8f0;
  border-bottom-left-radius: 4px;
}

/* === Typing dots === */
.typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
}
.typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #94a3b8;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-3px); opacity: 1; }
}

/* === Composer === */
/* 兩邊用 explicit height + 一致 box-sizing,不依賴 grid stretch (button 跨瀏覽器不穩) */
.float-composer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #24263a;
  background: #0b0d14;
}
.float-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  margin: 0;
  padding: 0 12px;
  background: #161822;
  border: 1px solid #2e3147;
  border-radius: 8px;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  line-height: 1;
  transition: all 0.15s;
  appearance: none;
  -webkit-appearance: none;
}
.float-input::placeholder {
  color: #475569;
}
.float-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 2px rgba(var(--c-light-rgb), 0.15);
}
.float-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.float-send {
  flex: 0 0 auto;
  width: 44px;
  height: 40px;
  margin: 0;
  padding: 0;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(var(--c-deep-rgb), 0.35);
  transition: transform 0.1s;
  box-sizing: border-box;
  vertical-align: middle;
}
.float-send:hover:not(:disabled) {
  transform: translateY(-1px);
}
.float-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* === 手機 RWD === */
@media (max-width: 480px) {
  .float-btn {
    right: 14px;
    bottom: 14px;
    width: 52px;
    height: 52px;
  }
  .float-window {
    right: 12px;
    left: 12px;
    bottom: 76px;
    width: auto;
    height: 70vh;
    max-height: calc(100vh - 100px);
  }
}
</style>
