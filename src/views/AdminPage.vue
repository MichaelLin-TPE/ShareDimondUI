<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useAdminClient } from '@/composables/adminClient'
import './admin/admin-shared.css'

const { adminToken, tokenInput, authed, saveToken, clearToken, toasts } = useAdminClient()

// ===== Tabs =====
// 加新 tab 的方式:
//   1) 在 src/views/admin/ 建一個新的 TabXxx.vue (用 useAdminClient() 拿 callApi / showToast)
//   2) 在這裡 import + 加進 tabs 陣列就完事 — AdminPage 殼不會再膨脹
type TabKey = 'codes' | 'extend' | 'payments' | 'commissions' | 'broadcast'
type TabDef = {
  key: TabKey
  label: string
  emoji: string
  comp: ReturnType<typeof defineAsyncComponent>
}

const tabs: TabDef[] = [
  {
    key: 'codes',
    label: '推廣碼',
    emoji: '🎟️',
    comp: defineAsyncComponent(() => import('./admin/CodesTab.vue')),
  },
  {
    key: 'extend',
    label: '血盟延期',
    emoji: '⏰',
    comp: defineAsyncComponent(() => import('./admin/ExtendTab.vue')),
  },
  {
    key: 'payments',
    label: '付款記錄',
    emoji: '💵',
    comp: defineAsyncComponent(() => import('./admin/PaymentsTab.vue')),
  },
  {
    key: 'commissions',
    label: '抽成結算',
    emoji: '💰',
    comp: defineAsyncComponent(() => import('./admin/CommissionsTab.vue')),
  },
  {
    key: 'broadcast',
    label: '群發信件',
    emoji: '📧',
    comp: defineAsyncComponent(() => import('./admin/BroadcastTab.vue')),
  },
]

const activeTab = ref<TabKey>('codes')
const currentComp = computed(() => tabs.find((t) => t.key === activeTab.value)?.comp)

// 用 key 強制重 mount 觸發 tab 的 onMounted 重新拉資料
const refreshKey = ref(0)
function refreshCurrent() {
  refreshKey.value++
}
</script>

<template>
  <div class="admin-root">
    <!-- ===== Token gate ===== -->
    <div v-if="!authed" class="gate">
      <div class="gate-card">
        <div class="gate-emoji">🔐</div>
        <h1>Admin 登入</h1>
        <p class="gate-sub">請輸入管理員 Token</p>
        <input
          v-model="tokenInput"
          type="password"
          placeholder="X-Admin-Token"
          class="field"
          @keyup.enter="saveToken"
        />
        <button class="btn btn-primary btn-block" @click="saveToken">進入</button>
        <p class="gate-hint">Token 會儲存在本機,下次自動登入</p>
      </div>
    </div>

    <!-- ===== Main ===== -->
    <div v-else class="main">
      <header class="topbar">
        <div class="brand">
          <span class="brand-emoji">⚙️</span>
          <span class="brand-text">Diamond Core Admin</span>
        </div>
        <div class="topbar-right">
          <button class="btn btn-ghost" @click="refreshCurrent">🔄 重新載入</button>
          <button class="btn btn-danger-ghost" @click="clearToken">登出</button>
        </div>
      </header>

      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: activeTab === t.key }"
          @click="activeTab = t.key"
        >
          <span class="tab-emoji">{{ t.emoji }}</span>
          <span class="tab-label">{{ t.label }}</span>
        </button>
      </nav>

      <component :is="currentComp" :key="`${activeTab}-${refreshKey}`" />

      <!-- Toasts (全域,所有 tab 共用同一個 toasts 陣列) -->
      <div class="toast-stack">
        <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]">
          {{ t.msg }}
        </div>
      </div>
    </div>
  </div>
</template>
