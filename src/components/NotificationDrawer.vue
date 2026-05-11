<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  useNotifications,
  formatRelativeTime,
  type NotificationItem,
} from '@/composables/notifications.ts'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const { items, unreadCount, markRead, markAllRead, refresh } = useNotifications()

const onItemClick = async (n: NotificationItem) => {
  if (!n.isRead) markRead(n.id)
  if (n.targetUrl) {
    router.replace(n.targetUrl)
  }
  emit('close')
}

const onMaskClick = () => emit('close')
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="props.open" class="nd-mask" @click.self="onMaskClick">
        <aside class="nd-panel" role="dialog" aria-label="通知中心">
          <header class="nd-head">
            <div class="nd-title">
              🔔 通知中心
              <span v-if="unreadCount > 0" class="nd-badge">{{ unreadCount }}</span>
            </div>
            <div class="nd-actions">
              <button
                v-if="unreadCount > 0"
                class="nd-btn ghost"
                @click="markAllRead"
                title="全部已讀"
              >
                全部已讀
              </button>
              <button class="nd-btn ghost" @click="refresh" title="重新整理">🔄</button>
              <button class="nd-btn ghost close-btn" @click="emit('close')" title="關閉">✕</button>
            </div>
          </header>

          <div v-if="items.length === 0" class="nd-empty">
            <div class="nd-empty-icon">📭</div>
            <div class="nd-empty-text">目前沒有通知</div>
          </div>

          <ul v-else class="nd-list">
            <li
              v-for="n in items"
              :key="n.id"
              class="nd-item"
              :class="{ unread: !n.isRead }"
              @click="onItemClick(n)"
            >
              <span class="nd-dot" v-if="!n.isRead"></span>
              <span class="nd-icon">{{ n.icon || '🔔' }}</span>
              <div class="nd-body">
                <div class="nd-row">
                  <span class="nd-iitem-title">{{ n.title }}</span>
                  <span class="nd-time">{{ formatRelativeTime(n.createTime) }}</span>
                </div>
                <div class="nd-content">{{ n.content }}</div>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nd-mask {
  position: fixed;
  inset: 0;
  height: 100vh;
  height: 100dvh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 9000;
  display: flex;
  justify-content: flex-end;
}
.nd-panel {
  width: min(100vw, 380px);
  height: 100vh;
  height: 100dvh;
  max-height: 100%;
  background: #14161f;
  border-left: 1px solid #2e3147;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.nd-head {
  padding: 18px 16px;
  border-bottom: 1px solid #24263a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.nd-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nd-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #ef4444;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}
.nd-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.nd-btn {
  height: 32px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid #2e3147;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  line-height: 1;
}
.nd-btn:hover {
  border-color: var(--c-mid);
  color: #fff;
}
.nd-btn.close-btn {
  width: 32px;
  padding: 0;
  font-size: 0.95rem;
}

/* List */
.nd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.nd-list::-webkit-scrollbar {
  width: 6px;
}
.nd-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.nd-item {
  position: relative;
  padding: 14px 16px 14px 22px;
  border-bottom: 1px solid #1e2030;
  cursor: pointer;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: background 0.15s;
}
.nd-item:hover {
  background: rgba(var(--c-light-rgb), 0.05);
}
.nd-item.unread {
  background: rgba(var(--c-light-rgb), 0.04);
}
.nd-dot {
  position: absolute;
  left: 8px;
  top: 22px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-light);
  box-shadow: 0 0 6px var(--c-light);
}
.nd-icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  line-height: 1.3;
}
.nd-body {
  flex: 1;
  min-width: 0;
}
.nd-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.nd-iitem-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nd-time {
  font-size: 0.72rem;
  color: #64748b;
  flex-shrink: 0;
}
.nd-content {
  font-size: 0.82rem;
  color: #94a3b8;
  word-break: break-word;
}

/* Empty */
.nd-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.nd-empty-icon {
  font-size: 3rem;
  margin-bottom: 10px;
  opacity: 0.5;
}
.nd-empty-text {
  color: #64748b;
  font-size: 0.95rem;
}

/* Drawer slide-in */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-active .nd-panel,
.drawer-leave-active .nd-panel {
  transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-enter-from .nd-panel,
.drawer-leave-to .nd-panel {
  transform: translateX(100%);
}
/* 手機: 標題與按鈕擠壓時的修正 */
@media (max-width: 420px) {
  .nd-head {
    padding: 14px 12px;
    gap: 8px;
  }
  .nd-title {
    font-size: 1rem;
  }
  .nd-btn {
    height: 30px;
    padding: 0 8px;
    font-size: 0.74rem;
  }
  .nd-btn.close-btn {
    width: 30px;
    padding: 0;
  }
  .nd-item {
    padding: 12px 14px 12px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active,
  .drawer-enter-active .nd-panel,
  .drawer-leave-active .nd-panel {
    transition: none;
  }
}
</style>
