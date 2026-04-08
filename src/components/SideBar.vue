<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { useRouter } from 'vue-router'
import { useAlert } from '@/utils/alerts.ts'
import { generateSignature } from '@/utils/SignTools.ts'

const router = useRouter()
const authStore = useAuthStore()

// 控制側邊欄伸縮的變數
const isCollapsed = ref(true)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleMenuClick = (item: Menu) => {
  // 點擊後自動收起選單
  isCollapsed.value = true

  if (item.label === '🏛️ 血盟大廳') {
    router.replace('/clan/dashboard')
  } else if (item.label == '📖 歷史紀錄') {
    router.replace('/clan/treasures')
  } else if (item.label == '💸 轉帳') {
    router.replace('/clan/transfer')
  } else if (item.label == '📤 申請提款') {
    router.replace('/clan/withdraw')
  } else if (item.label == '👑 成員管理') {
    router.replace('/clan/memberRole')
  } else if (item.label == '📤 提款審核') {
    router.replace('/clan/verifyWithdraw')
  } else if (item.label == '💰 基金分配') {
    router.replace('/clan/distributionPage')
  } else if (item.label == '🙋‍♂️ 人員審核') {
    router.replace('/clan/approvalPage')
  } else if (item.label == '⚙️ 血盟設置') {
    router.replace('/clan/clanSettingsPage')
  } else if (item.label == '💳 成員帳戶') {
    router.replace('/clan/allMemberBalance')
  } else if (item.label == '🚪 成員管理') {
    router.replace('/clan/kickMemberPage')
  } else if (item.label == '💰 個人掛賣區') {
    router.replace('/clan/marketPlace')
  } else if (item.label == '💸 個人帳戶') {
    router.replace('/clan/personalLog')
  }
}

const logout = async () => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/logout', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
      },
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message)
      return
    }
    authStore.authToken = ''
    useAlert.success('登出成功')
    router.replace('/login')
  } catch (e) {
    console.log(e)
  }
}

const menuList = ref<Menu[]>([])
interface Menu {
  label: string
}

onMounted(async () => {
  try {
    const currentTimeStamp = Math.floor(Date.now() / 1000).toString()
const res= await fetch('https://api.gameshare-system.com/get-menu', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authStore.authToken}`,
        Accept: 'application/json',
        Sign: generateSignature(currentTimeStamp),
TimeStamp:currentTimeStamp
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
          <div class="name">{{ authStore.member.clanName }}</div>
        </div>
        <button class="logout" @click="logout">登出</button>
      </div>
      <nav class="menu-list">
        <div
          v-for="item in menuList"
          :key="item.label"
          class="menu-item"
          @click="handleMenuClick(item)"
        >
          {{ item.label }}
        </div>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
/* 1. 調整遮罩層的 z-index，確保它蓋住 dashboard，但又在選單之下 */
.sidebar-overlay {
  /* ... 原本的設定 ... */
  z-index: 1040; /* 建議調高一點，確保能蓋住其他可能設定了 z-index 的卡片 */
}

/* 2. 調整側邊欄的 z-index */
.sidebar {
  /* ... 原本的設定 ... */
  z-index: 1050; /* 確保選單在遮罩層之上 */
}

/* 3. 調整按鈕的 z-index */
.toggle-btn {
  /* ... 原本的設定 ... */
  z-index: 1030; /* 按鈕在最底層，這樣抽屜滑出來時，三條線按鈕會被遮罩蓋住，視覺比較乾淨 */
}

/* 切換按鈕樣式 - 固定在左側 */
.toggle-btn {
  position: fixed;
  left: 15px;
  top: 15px;
  z-index: 998;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1a1f2e;
  color: #00d4ff;
  border: 1px solid rgba(0, 212, 255, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* 遮罩層 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 999; /* 介於按鈕與側邊欄之間 */
}

/* 側邊欄主體 */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  /* 寬度設為螢幕寬度的 80%，但最大不超過 320px */
  width: 80vw;
  max-width: 320px;
  height: 100vh;
  background: #0e0f13;
  color: #fff;
  z-index: 1000;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 5px 0 15px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

/* 收起狀態 */
.is-collapsed {
  transform: translateX(-100%);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 16px;
}

/* 選單區域加上捲軸 */
.menu-list {
  flex: 1;
  overflow-y: auto; /* 超過高度時顯示捲軸 */
  padding-right: 4px;
}

/* 自定義捲軸樣式 */
.menu-list::-webkit-scrollbar {
  width: 4px;
}
.menu-list::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 255, 0.2);
  border-radius: 10px;
}

/* 餘下樣式保持不變 */
.clan {
  display: flex;
  align-items: center;
  gap: 10px; /* 減少間距，讓資訊更緊湊 */
  margin-bottom: 10px;
  justify-content: space-between; /* 關鍵：把文字和按鈕推到兩邊 */
}

.logo {
  width: 40px; /* 稍微縮小 LOGO，讓畫面更精緻 */
  height: 40px;
  border-radius: 8px;
}

.clan-info {
  flex: 1; /* 關鍵：佔滿剩餘空間，推開登出按鈕 */
  overflow: hidden; /* 避免文字過長撐壞佈局 */
}

.name {
  font-size: 15px; /* 稍微縮小字體 */
  font-weight: bold;
  white-space: nowrap; /* 避免換行 */
  overflow: hidden;
  text-overflow: ellipsis; /* 文字過長時顯示省略號 (...) */
}

/* 登出按鈕微調 */
.logout {
  padding: 3px 6px; /* 關鍵：減少內距，讓按鈕變小 */
  font-size: 10px;
  border-radius: 6px;
  color: #00d4ff;
  background: #12141d;
  border: 1px solid rgba(0, 212, 255, 0.3);
  cursor: pointer;
  white-space: nowrap; /* 避免換行 */
  margin-left: auto; /* 關鍵：推到最右邊 */
  width: 40px;
  height: 40px;
}

.logout:hover {
  background: rgba(0, 212, 255, 0.1);
  border-color: #00d4ff;
}

.balance_view {
  font-size: 13px; /* 稍微縮小字體 */
  color: #f5c451;
  padding: 10px;
  background: rgba(245, 196, 81, 0.08);
  border-radius: 8px;
  margin-bottom: 10px;
}

.menu-item {
  padding: 10px 12px; /* 稍微減少內距 */
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.2s;
  font-size: 14px; /* 稍微縮小選單字體 */
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #00d4ff;
  padding-left: 16px; /* 懸停時稍微右移增加動感 */
}
</style>
