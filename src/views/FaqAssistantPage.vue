<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useAlert } from '@/utils/alerts.ts'

const authStore = useAuthStore()

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  at: string
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const messageScroll = ref<HTMLDivElement | null>(null)
const composerInput = ref<HTMLTextAreaElement | null>(null)

// 強制捲到最底 — 用 requestAnimationFrame 確保 DOM 已 paint
const scrollToBottom = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (messageScroll.value) {
        messageScroll.value.scrollTop = messageScroll.value.scrollHeight
      }
    })
  })
}

// loading 狀態變化 (打字動畫進場/退場) 也要捲到底
watch(loading, () => scrollToBottom())

let nextId = 1
const pushMsg = (role: 'user' | 'assistant', content: string) => {
  messages.value.push({
    id: nextId++,
    role,
    content,
    at: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
  })
  scrollToBottom()
}

const focusInput = () => {
  nextTick(() => {
    composerInput.value?.focus()
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

const sendQuestion = async (questionOverride?: string) => {
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
      useAlert.error(data.message ?? 'AI 回應失敗')
      pushMsg('assistant', '⚠️ AI 暫時無法回答,請稍後再試')
      return
    }
    pushMsg('assistant', data.answer ?? '(空白回應)')
  } catch (e) {
    console.error(e)
    pushMsg('assistant', '⚠️ 連線失敗,請稍後再試')
  } finally {
    loading.value = false
    // AI 回完自動把 focus 拉回輸入框,使用者可以直接接著打
    focusInput()
    scrollToBottom()
  }
}

const onEnter = (e: KeyboardEvent) => {
  // Shift+Enter 換行,純 Enter 送出
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendQuestion()
  }
}

onMounted(() => {
  pushMsg(
    'assistant',
    '👋 哈囉! 我是公會 FAQ 助手,可以回答遊戲機制、道具、Boss、本公會規則等問題。\n直接打字問我吧 ✨',
  )
  focusInput()
})
</script>

<template>
  <div class="ai-page">
    <!-- 標題 -->
    <header class="ai-head">
      <h2 class="ai-title">🤖 AI 助手</h2>
      <p class="ai-sub">公會 FAQ 機器人 · 由 Claude 提供</p>
    </header>

    <!-- 對話區 -->
    <div ref="messageScroll" class="chat-scroll">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row"
        :class="msg.role === 'user' ? 'msg-row-user' : 'msg-row-assistant'"
      >
        <div class="msg-avatar">
          {{ msg.role === 'user' ? '🧑' : '🤖' }}
        </div>
        <div class="msg-content-wrap">
          <div class="msg-bubble" :class="`msg-bubble-${msg.role}`">
            {{ msg.content }}
          </div>
          <div class="msg-time">{{ msg.at }}</div>
        </div>
      </div>

      <div v-if="loading" class="msg-row msg-row-assistant">
        <div class="msg-avatar">🤖</div>
        <div class="msg-content-wrap">
          <div class="msg-bubble msg-bubble-assistant typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 輸入區 -->
    <div class="composer">
      <textarea
        ref="composerInput"
        v-model="inputText"
        class="composer-input"
        rows="1"
        placeholder="問我任何遊戲問題..."
        :disabled="loading"
        @keydown="onEnter"
      />
      <button
        type="button"
        class="composer-send"
        :disabled="loading || !inputText.trim()"
        :title="loading ? '傳送中...' : '送出 (Enter)'"
        @click="sendQuestion()"
      >
        <span v-if="loading" class="send-loading">
          <span></span><span></span><span></span>
        </span>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12l14 0M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 0px);
  padding: 16px 20px 20px;
  background-color: #0b0d14;
  color: #ffffff;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

/* === 標題 === */
.ai-head {
  flex-shrink: 0;
  margin-bottom: 12px;
  padding-left: 48px;
}
.ai-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #e2e8f0;
  letter-spacing: 0.3px;
  line-height: 1.2;
}
.ai-sub {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.2;
}

/* === 對話區 === */
.chat-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.chat-scroll::-webkit-scrollbar {
  width: 6px;
}
.chat-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}

.msg-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.msg-row-user {
  flex-direction: row-reverse;
}
.msg-row-assistant {
  flex-direction: row;
}
.msg-avatar {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #161822;
  border: 1px solid #24263a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
}
.msg-content-wrap {
  display: flex;
  flex-direction: column;
  max-width: 75%;
}
.msg-row-user .msg-content-wrap {
  align-items: flex-end;
}
.msg-row-assistant .msg-content-wrap {
  align-items: flex-start;
}
.msg-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 0.92rem;
  line-height: 1.55;
  white-space: pre-line;
  word-break: break-word;
  box-sizing: border-box;
}
.msg-bubble-user {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border-bottom-right-radius: 4px;
  font-weight: 600;
}
.msg-bubble-assistant {
  background: #161822;
  border: 1px solid #24263a;
  color: #e2e8f0;
  border-bottom-left-radius: 4px;
}
.msg-time {
  font-size: 0.7rem;
  color: #475569;
  margin-top: 4px;
  padding: 0 6px;
}

/* === Typing dots === */
.typing {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 14px 16px;
}
.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}

/* === Composer (輸入區) === */
/* 兩邊都 explicit height + flex, 不用 grid stretch (button 在 stretch 下跨瀏覽器不穩) */
.composer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #1f2233;
  margin-top: 8px;
}
.composer-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 48px;       /* 固定 48 跟按鈕一致 */
  margin: 0;
  padding: 14px 14px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  line-height: 1.4;
  resize: none;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  /* 多行時內部 scroll, 不撐高 */
  overflow-y: auto;
}
.composer-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.composer-input::placeholder {
  color: #475569;
}
.composer-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.composer-send {
  flex: 0 0 auto;
  width: 48px;        /* icon 按鈕,正方形,佔比 ~5% */
  height: 48px;       /* 跟 input 完全一樣高 */
  margin: 0;
  padding: 0;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.15s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  vertical-align: middle;
}
.composer-send:hover:not(:disabled) {
  transform: translateY(-1px);
}
.composer-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}
/* loading 三個圓點 */
.send-loading {
  display: inline-flex;
  gap: 3px;
}
.send-loading span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: send-loading-pulse 1.2s infinite ease-in-out;
}
.send-loading span:nth-child(2) { animation-delay: 0.15s; }
.send-loading span:nth-child(3) { animation-delay: 0.3s; }
@keyframes send-loading-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1.1); opacity: 1; }
}
.composer-send:hover:not(:disabled) {
  transform: translateY(-1px);
}
.composer-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 768px) {
  .msg-content-wrap {
    max-width: 85%;
  }
  .ai-head {
    padding-left: 48px;
  }
}
</style>
