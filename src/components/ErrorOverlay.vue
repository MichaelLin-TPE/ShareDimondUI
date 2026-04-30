<script setup lang="ts">
import { computed } from 'vue'
import { useErrorOverlayStore } from '@/stores/errorOverlay'

const store = useErrorOverlayStore()

const visible = computed(() => store.mode !== 'none')
const isTimeout = computed(() => store.mode === 'timeout')
const isMaintenance = computed(() => store.mode === 'maintenance')

const reload = () => {
  window.location.reload()
}
const dismiss = () => {
  store.dismiss()
}
</script>

<template>
  <Transition name="eo-fade">
    <div v-if="visible" class="eo-mask">
      <div class="eo-card">
        <template v-if="isTimeout">
          <div class="eo-icon">⏳</div>
          <div class="eo-title">連線逾時</div>
          <p class="eo-msg">伺服器在合理時間內沒有回應,請重新整理頁面再試一次。</p>
          <div class="eo-actions">
            <button class="eo-btn eo-btn-primary" @click="reload">🔄 重新整理</button>
          </div>
        </template>

        <template v-else-if="isMaintenance">
          <div class="eo-icon">🔧</div>
          <div class="eo-title">服務暫時無法使用</div>
          <p class="eo-msg">
            {{ store.message || '目前服務發生未知錯誤,或系統正在維護中,請稍後再試。' }}
          </p>
          <div class="eo-actions">
            <button class="eo-btn eo-btn-secondary" @click="dismiss">知道了</button>
            <button class="eo-btn eo-btn-primary" @click="reload">🔄 重新整理</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.eo-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(6px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.eo-card {
  width: 100%;
  max-width: 380px;
  padding: 32px 24px 24px;
  background: rgba(22, 24, 34, 0.98);
  border: 1px solid #3a3f5c;
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
  text-align: center;
}

.eo-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  filter: drop-shadow(0 0 12px rgba(245, 196, 81, 0.4));
}

.eo-title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffd166;
  letter-spacing: 0.5px;
}

.eo-msg {
  margin: 0 0 22px;
  font-size: 0.92rem;
  color: #cbd5e1;
  line-height: 1.6;
}

.eo-actions {
  display: flex;
  gap: 10px;
}
.eo-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.18s;
  font-family: inherit;
  letter-spacing: 0.5px;
}
.eo-btn-secondary {
  background: #1e2233;
  color: #e2e8f0;
  border: 1px solid #3a3f5c;
}
.eo-btn-secondary:hover {
  background: #2a2f44;
  color: #fff;
  border-color: #555a78;
}
.eo-btn-primary {
  background: linear-gradient(135deg, #ffd166, #f59e0b);
  color: #0f111a;
  font-weight: 800;
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);
}
.eo-btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(245, 158, 11, 0.4);
}

/* Transition */
.eo-fade-enter-active,
.eo-fade-leave-active {
  transition: opacity 0.2s ease;
}
.eo-fade-enter-from,
.eo-fade-leave-to {
  opacity: 0;
}
.eo-fade-enter-active .eo-card,
.eo-fade-leave-active .eo-card {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.eo-fade-enter-from .eo-card {
  transform: scale(0.92) translateY(12px);
}
</style>
