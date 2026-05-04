<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useRoute, useRouter } from 'vue-router'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { resetSession } from '@/utils/session.ts'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isCollapsed = ref(true)
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

interface Menu {
  label: string
  category?: string | null
  categorySort?: number | null
}

interface MenuGroup {
  name: string
  sort: number
  items: Menu[]
}

const menuList = ref<Menu[]>([])

const labelToRoute: Record<string, string> = {
  '🏛️ 血盟大廳': '/clan/dashboard',
  '📖 歷史紀錄': '/clan/treasures',
  '💸 轉帳': '/clan/transfer',
  '📤 申請提款': '/clan/withdraw',
  '👑 權限管理': '/clan/memberRole',
  '📤 提款審核': '/clan/verifyWithdraw',
  '💰 基金分配': '/clan/distributionPage',
  '🙋‍♂️ 人員審核': '/clan/approvalPage',
  '⚙️ 血盟設置': '/clan/clanSettingsPage',
  '💳 成員帳戶': '/clan/allMemberBalance',
  '🚪 成員管理': '/clan/kickMemberPage',
  '💰 個人掛賣區': '/clan/marketPlace',
  '💸 個人帳戶': '/clan/personalLog',
  '⚔️ 首領追蹤': '/clan/bossTimer',
  '🍄 小遊戲': '/clan/game1a2b',
  '💎 物品定價': '/clan/itemPriceManage',
  '📦 掉寶追蹤': '/clan/lootTracker',
  '📊 出席率': '/clan/attendance',
  '⚙️ 設置': '/clan/settings',
}

const handleMenuClick = (item: Menu) => {
  isCollapsed.value = true
  const target = labelToRoute[item.label]
  if (target) router.replace(target)
}

const isActive = (item: Menu) => {
  const target = labelToRoute[item.label]
  return target ? route.path === target : false
}

const topLevelItems = computed<Menu[]>(() =>
  menuList.value.filter((m) => !m.category),
)

const groupedMenus = computed<MenuGroup[]>(() => {
  const map = new Map<string, MenuGroup>()
  for (const m of menuList.value) {
    if (!m.category) continue
    const sort = m.categorySort ?? 999
    let g = map.get(m.category)
    if (!g) {
      g = { name: m.category, sort, items: [] }
      map.set(m.category, g)
    } else {
      g.sort = Math.min(g.sort, sort)
    }
    g.items.push(m)
  }
  return Array.from(map.values()).sort((a, b) => a.sort - b.sort)
})

// 反向儲存:只記錄「使用者主動收起」的分類,沒被收起的全部視為展開
// 預設(空集合)= 全部展開;新加的分類也自動展開(不在 collapsed 清單裡)
const STORAGE_KEY = 'sidebarCollapsedCategories'
const collapsedSet = ref<Set<string>>(new Set())

const loadCollapsed = () => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved !== null) collapsedSet.value = new Set(JSON.parse(saved))
  } catch {
    /* ignore */
  }
}
const saveCollapsed = () => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsedSet.value]))
}
const isExpanded = (name: string) => !collapsedSet.value.has(name)
const toggleCategory = (name: string) => {
  if (collapsedSet.value.has(name)) collapsedSet.value.delete(name)
  else collapsedSet.value.add(name)
  collapsedSet.value = new Set(collapsedSet.value)
  saveCollapsed()
}

const logout = async () => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/logout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      return
    }
    // 清掉所有 session-bound store (auth + balance + biddingTreasure + sharedLists)
    resetSession()
    useAlert.success('登出成功')
    router.replace('/login')
  } catch (e) {
    console.log(e)
  }
}

onMounted(async () => {
  loadCollapsed()
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
    const res = await fetch('https://api.gameshare-system.com/get-menu', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
        TimeStamp: currentTimeStamp,
      },
    })
    if (!res.ok) {
      useAlert.error('憑證過期,請重新發送驗證信!')
      router.replace('/login')
      return
    }
    const data = await res.json()
    menuList.value = data
  } catch (e) {
    console.log(e)
  }
})
</script>

<template>
  <button v-if="isCollapsed" class="toggle-btn" @click="toggleSidebar">
    <span>☰</span>
  </button>

  <div v-if="!isCollapsed" class="sidebar-overlay" @click="toggleSidebar"></div>

  <aside class="sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <div class="sidebar-content">
      <div class="clan">
        <img class="logo" src="/share_diamond_logo.png" />
        <div v-if="authStore.member" class="clan-info">
          <div class="clan-tag">血盟</div>
          <div class="name">{{ authStore.member.clanName }}</div>
        </div>
        <button class="logout" @click="logout" title="登出">⏻</button>
      </div>

      <nav class="menu-list">
        <!-- 頂層項目 (沒分類) -->
        <a
          v-for="item in topLevelItems"
          :key="item.label"
          class="menu-item"
          :class="{ 'is-active': isActive(item) }"
          @click="handleMenuClick(item)"
        >
          {{ item.label }}
        </a>

        <!-- 分類折疊 -->
        <section
          v-for="group in groupedMenus"
          :key="group.name"
          class="menu-group"
          :class="{ 'is-open': isExpanded(group.name) }"
        >
          <button
            type="button"
            class="group-header"
            @click="toggleCategory(group.name)"
          >
            <svg class="group-chevron" viewBox="0 0 24 24" width="12" height="12">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="group-name">{{ group.name }}</span>
          </button>

          <div class="group-items">
            <div class="group-items-inner">
              <a
                v-for="item in group.items"
                :key="item.label"
                class="menu-item"
                :class="{ 'is-active': isActive(item) }"
                @click="handleMenuClick(item)"
              >
                {{ item.label }}
              </a>
            </div>
          </div>
        </section>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.toggle-btn {
  position: fixed;
  left: 15px;
  top: 15px;
  z-index: 1030;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #14171f;
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.15s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.toggle-btn:hover {
  background: #1a1f2a;
  border-color: rgba(255, 255, 255, 0.18);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 1040;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 78vw;
  max-width: 280px;
  height: 100vh;
  background: #0c0e14;
  color: #fff;
  z-index: 1050;
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}
.is-collapsed {
  transform: translateX(-100%);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 14px 8px 10px;
}

/* === Clan header === */
.clan {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
}
.logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}
.clan-info {
  flex: 1;
  min-width: 0;
}
.clan-tag {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  font-weight: 700;
  line-height: 1.4;
}
.name {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.logout {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 17px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.logout:hover {
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.4);
}

/* === Menu list === */
.menu-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 2px;
}
.menu-list::-webkit-scrollbar {
  width: 3px;
}
.menu-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

/* === Items (universal: top-level 與分類內共用) === */
.menu-item {
  display: block;
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.35;
  transition:
    color 0.12s,
    background 0.12s;
  position: relative;
  text-decoration: none;
  user-select: none;
}
.menu-item:hover {
  color: #fff;
}
.menu-item.is-active {
  color: #ffffff;
  background: linear-gradient(
    90deg,
    rgba(68, 214, 44, 0.22) 0%,
    rgba(68, 214, 44, 0.05) 100%
  );
  font-weight: 700;
}
.menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 3px;
  background: #44d62c;
  box-shadow:
    0 0 6px #44d62c,
    0 0 12px rgba(68, 214, 44, 0.7);
}

/* === Category group === */
.menu-group {
  margin-top: 0;
}
.group-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 32px;
  line-height: 1;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  transition:
    color 0.12s,
    background 0.12s;
}
.group-header:hover {
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.04);
}
.menu-group.is-open .group-header {
  color: rgba(255, 255, 255, 0.85);
}
.group-name {
  text-align: left;
}
.group-chevron {
  color: currentColor;
  opacity: 0.6;
  transition: transform 0.22s ease;
}
.menu-group.is-open .group-chevron {
  transform: rotate(90deg);
}

/* === 分類內子項目 折疊動畫 === */
.group-items {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s ease;
}
.menu-group.is-open .group-items {
  grid-template-rows: 1fr;
}
.group-items-inner {
  overflow: hidden;
}
.group-items-inner .menu-item {
  padding-left: 18px;
}
</style>
