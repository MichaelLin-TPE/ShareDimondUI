<script setup lang="ts">
import { useNotifications } from '@/composables/notifications.ts'

/**
 * 右下角通知 FAB — 極簡版
 * - 沒未讀通知 → 整個 FAB 消失
 * - 有未讀 → 出現 + 持續呼吸 pulse
 * - 點擊 → 直接開抽屜 (沒中間 stack)
 *
 * 之前的功能去向:
 * - 🏪 市場掛單 / 💰 賣單待付款 → 由通知中心 LISTING_OPENED / LISTING_SOLD 事件涵蓋
 * - 🙋 申請審核 → 暫拿掉 (側邊欄「🙋‍♂️ 人員審核」menu 仍可進入,等後端有 apply endpoint 後可加 MEMBER_APPLIED 通知)
 */
const { unreadCount, openDrawer } = useNotifications()
</script>

<template>
  <Transition name="hub-fade">
    <button
      v-if="unreadCount > 0"
      type="button"
      class="hub-main has-unread"
      :title="`${unreadCount} 則新通知,點擊查看`"
      aria-label="未讀通知"
      @click="openDrawer"
    >
      <span class="main-icon">🔔</span>
      <span class="main-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>
  </Transition>
</template>

<style scoped>
.hub-main {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1020;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 6px 18px rgba(var(--c-light-rgb), 0.45),
    0 2px 6px rgba(0, 0, 0, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.hub-main:hover {
  transform: scale(1.06);
  box-shadow:
    0 8px 22px rgba(var(--c-light-rgb), 0.55),
    0 4px 10px rgba(0, 0, 0, 0.4);
}
.hub-main:active {
  transform: scale(0.96);
}

.main-icon {
  font-size: 1.5rem;
  line-height: 1;
}
.main-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: #ef4444;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c-deep);
  box-sizing: content-box;
}

/* 持續呼吸 — 抓使用者目光 */
.hub-main.has-unread {
  animation: hub-breathe 2s ease-in-out infinite;
}
@keyframes hub-breathe {
  0%, 100% {
    box-shadow:
      0 6px 18px rgba(var(--c-light-rgb), 0.45),
      0 2px 6px rgba(0, 0, 0, 0.4),
      0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    box-shadow:
      0 6px 18px rgba(var(--c-light-rgb), 0.5),
      0 2px 6px rgba(0, 0, 0, 0.4),
      0 0 0 12px rgba(245, 158, 11, 0);
  }
}

/* FAB 進場 / 離場淡出 */
.hub-fade-enter-active,
.hub-fade-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hub-fade-enter-from,
.hub-fade-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .hub-main.has-unread {
    animation: none;
  }
  .hub-fade-enter-active,
  .hub-fade-leave-active {
    transition: opacity 0.15s ease;
  }
}

/* 手機: FAB 稍小 + 靠邊一點 */
@media (max-width: 640px) {
  .hub-main {
    bottom: 16px;
    right: 16px;
    width: 50px;
    height: 50px;
  }
  .main-icon {
    font-size: 1.3rem;
  }
}
</style>
