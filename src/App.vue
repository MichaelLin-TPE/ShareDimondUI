<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import ErrorOverlay from './components/ErrorOverlay.vue'
import NotificationDrawer from './components/NotificationDrawer.vue'
import { useNotifications } from './composables/notifications.ts'

const route = useRoute()
// 新增：控制收費方式彈窗顯示狀態的變數
const showPricingModal = ref(false)
// 控制圖片彈窗顯示狀態的變數
const showUsageImage = ref(false)
// 新增：控制 LINE QR Code 彈窗顯示狀態的變數
const showLineQR = ref(false)
// 新增：控制功能說明彈窗顯示狀態的變數
const showFeaturesModal = ref(false)

interface FeatureCategory {
  title: string
  color: string
  items: { icon: string; name: string; desc: string }[]
}

const featureCategories: FeatureCategory[] = [
  // 🤖 業界首創 AI 助理 — 排最前面 + 整張卡抖動 (見 .features-category.shake-attn)
  {
    title: '🤖 AI 助理 (業界首創)',
    color: '#a855f7',
    items: [
      {
        icon: '💬',
        name: '即時 AI 問答 🔥',
        desc: '玩家在站內任何頁面點右下角機器人,直接問遊戲機制 / 公會規則 / 道具用法',
      },
      {
        icon: '🏰',
        name: '血盟設定 AI 自動讀',
        desc: '問「我們公積金幾%?」「+1 時間多久?」AI 即時撈本血盟 DB 回答,不靠人工餵',
      },
      {
        icon: '📚',
        name: 'FAQ 知識庫 + URL 匯入',
        desc: '會長可貼網址,系統自動爬內容餵 AI;自訂 FAQ 條目,新人問題秒回',
      },
      {
        icon: '🎯',
        name: '熱門問題自動排序',
        desc: 'AI 統計大家在問什麼,熱門題自動推到首頁,新人一進來就看到',
      },
    ],
  },
  // 🆕 招牌新功能
  {
    title: '🚀 即時通知整合 🆕',
    color: '#f59e0b',
    items: [
      {
        icon: '💬',
        name: 'Discord 自動推送 🔥',
        desc: '開單 / 結算 / 掛單 / 成交 即時推到血盟 Discord 頻道，訊息可點擊直接跳回網站，血盟成員再也不會漏看',
      },
      {
        icon: '🔔',
        name: '站內通知中心',
        desc: '右下角小鈴鐺，有新通知會閃爍提醒，點開可以翻完整紀錄，沒未讀就自動消失，畫面乾淨',
      },
      {
        icon: '📱',
        name: 'FCM 手機推播',
        desc: '手機鎖屏 / app 關閉也收得到「你得標了」「你的東西被買了」即時通知',
      },
      {
        icon: '🎯',
        name: '事件全自動 push',
        desc: '開單 / 競標被超越 / 得標 / 掛單 / 成交 / 提款審核 全部自動推，人在哪都接得到',
      },
    ],
  },
  // 🆕 數據分析 — 第二招牌
  {
    title: '📊 數據與決策 🆕',
    color: '#10b981',
    items: [
      {
        icon: '📈',
        name: '道具價格走勢圖 🔥',
        desc: '歷史成交價 SVG 折線圖，多幣別自動分線，自動算趨勢，告別亂喊天價，買賣有依據',
      },
      {
        icon: '📊',
        name: '出席率統計',
        desc: '7 / 30 / 90 天 / 全部 彈性區間，一眼看誰最活躍、誰常缺席',
      },
      {
        icon: '📦',
        name: '掉寶追蹤',
        desc: 'BOSS 掉率自動統計 + 即將掉落 / 逾期未掉 紅黃 highlight 即時提醒',
      },
      {
        icon: '📖',
        name: '完整歷史紀錄',
        desc: '寶物結標 / 分紅 / 提款 / 個人交易 全可追溯，出爭議有依據',
      },
    ],
  },
  // 既有核心
  {
    title: '💰 寶物分紅',
    color: 'var(--c-mid)',
    items: [
      { icon: '🎯', name: '競標開單', desc: '設定底價、時間，成員競價出價搶標，有防壓秒保護' },
      { icon: '💵', name: '固定金額單', desc: '快速固定價格結標，多位得標者可隨機抽選' },
      { icon: '🙋', name: '參與 +1', desc: '一鍵加入分紅名單，首輪僅限有參與者搶，到期自動結算' },
      { icon: '🃏', name: '卡片即時動畫', desc: '新單空格→實體化彈出，有人加碼整張卡邊緣發光，生動如真實競技場' },
    ],
  },
  {
    title: '💸 金流管理',
    color: 'var(--c-mid)',
    items: [
      { icon: '🔁', name: '會員轉帳', desc: '公會內成員互轉多幣別貨幣' },
      { icon: '📤', name: '申請提款', desc: '送出提款單，幹部審核後撥款' },
      { icon: '✅', name: '提款審核', desc: '幹部/會長核准或退回提款單，有完整稽核紀錄' },
      { icon: '🎁', name: '基金分配', desc: '會長將公會金庫依比例分給成員，有預算進度條防超發' },
    ],
  },
  {
    title: '🏪 個人交易市場',
    color: '#a855f7',
    items: [
      { icon: '💰', name: '個人掛賣區', desc: '成員間 P2P 交易，直購 / 競標雙模式，血盟內部二級市場' },
      { icon: '💎', name: '物品統一定價', desc: '會長 / 幹部統一管理參考價，新單自動帶入' },
      { icon: '🛒', name: '成交雙向通知', desc: '你的東西被買、你得標都會立刻通知到通知中心 + Discord' },
      { icon: '📋', name: '個人帳戶流水', desc: '個人收支 / 分紅 / 交易記錄全可查' },
    ],
  },
  {
    title: '👥 公會管理',
    color: '#a855f7',
    items: [
      { icon: '🙋‍♂️', name: '人員審核', desc: '新加入的成員由幹部審核放行' },
      { icon: '👑', name: '權限管理', desc: '會長指派幹部、移交會長職權' },
      { icon: '🚪', name: '成員管理', desc: '踢除成員、管理血盟名單' },
      { icon: '⚙️', name: '血盟設定', desc: '調整匯率、競標時長、Discord webhook 等公會參數' },
    ],
  },
  {
    title: '⚔️ 戰鬥輔助',
    color: '#ef4444',
    items: [
      { icon: '⏰', name: '首領重生追蹤', desc: '自訂首領清單、固定重生間隔、定時提醒' },
      { icon: '☠️', name: '死亡回報', desc: '一鍵回報死亡，自動計算下次重生' },
      { icon: '🔄', name: 'WebSocket 即時同步', desc: '盟友動作畫面 1 秒內同步，不用 F5' },
      { icon: '💳', name: '成員資產監控', desc: '會長一覽全體成員多幣別餘額，出帳一目了然' },
    ],
  },
  {
    title: '🎨 體驗設計',
    color: '#ec4899',
    items: [
      { icon: '🎨', name: '三套主題色', desc: 'Gold / Indigo / Razer 一鍵切換，主題色貫穿全站' },
      { icon: '📱', name: 'Mobile-first', desc: '手機桌機完整響應式，觸控優化，折疊式卡片省空間' },
      { icon: '🌙', name: '暗色 UI', desc: '夜戰友善，長時間瀏覽不刺眼' },
      { icon: '🛡️', name: 'Error boundary', desc: '畫面崩潰自動顯示「重新整理」按鈕，不會空白黑屏' },
    ],
  },
]

const isLoginPage = computed(() => {
  return route.name === 'login' // 對應你 router 裡的 name: 'login'
})

// 通知抽屜 (全域，Dashboard 鈴鐺 / FAB / 任何地方都能控制 — 走同一個 singleton)
const { drawerOpen: notifDrawerOpen, closeDrawer: notifCloseDrawer } = useNotifications()
</script>

<template>
  <ErrorOverlay />
  <!-- 通知抽屜 (全域，任何 component openDrawer() 都能滑出) -->
  <NotificationDrawer :open="notifDrawerOpen" @close="notifCloseDrawer" />

  <div v-if="route.meta.fullscreen" id="app" :class="{ fullscreen: route.meta.fullscreen }">
    <RouterView />
  </div>

  <template v-else>
    <header>
      <img
        alt="Vue logo"
        class="logo"
        src="@/assets/share_diamond_logo.png"
        width="200"
        height="200"
      />
      <div class="wrapper">
        <HelloWorld msg="Diamond Core" />
      </div>
    </header>
    <RouterView />
  </template>

  <footer v-if="isLoginPage" class="bottom-nav">
    <button class="nav-link" @click="showUsageImage = true">核心用法</button>
    <div class="divider"></div>
    <button class="nav-link" @click="showFeaturesModal = true">功能說明</button>
    <div class="divider"></div>
    <button class="nav-link" @click="showLineQR = true">聯絡我們</button>
    <div class="divider"></div>
    <button class="nav-link" @click="showPricingModal = true">收費方式</button>
  </footer>
  <div
    v-if="isLoginPage && showPricingModal"
    class="image-modal-overlay"
    @click="showPricingModal = false"
  >
    <div class="pricing-modal-container" @click.stop>
      <div class="pricing-header">
        <h2>選擇最適合你的方案</h2>
        <p>透明定價，專業支援</p>
      </div>

      <div class="trial-banner">
        <span class="trial-icon">🎁</span>
        <div class="trial-text">
          <div class="trial-title">創血盟即享 <strong>7 天免費試用</strong></div>
          <div class="trial-sub">完整功能不限制，試用結束再選方案</div>
        </div>
      </div>

      <div class="pricing-cards">
        <div class="plan-card">
          <div class="plan-title">月繳方案</div>
          <div class="plan-price">
            <span class="currency">NT$</span>2,000<span class="period"> / 月</span>
          </div>
          <div class="plan-desc">單一公會授權</div>
        </div>

        <div class="plan-card highlight">
          <div class="save-badge">節省 NT$ 4,000</div>
          <div class="plan-title text-gold">年繳方案</div>
          <div class="plan-price">
            <span class="currency text-gold">NT$</span>20,000<span class="period"> / 年</span>
          </div>
          <div class="plan-desc">單一公會授權</div>
        </div>

        <div class="plan-card">
          <div class="plan-title">100 人以上</div>
          <div class="plan-prices-stack">
            <div class="plan-price-row">
              <span class="plan-price-label">月繳</span>
              <span class="plan-price-stack-amount">
                <span class="currency">NT$</span>3,500
              </span>
            </div>
            <div class="plan-price-row">
              <span class="plan-price-label">年繳</span>
              <span class="plan-price-stack-amount">
                <span class="currency">NT$</span>35,000
              </span>
            </div>
          </div>
          <div class="plan-desc">大型公會專案</div>
        </div>
      </div>

      <!-- 業界唯一賣點 + 服務承諾 (合併成一塊) -->
      <div class="features-section unique-section">
        <h3>🚀 業界首見 — 為什麼選 Diamond Core?</h3>
        <ul class="features-list">
          <li class="feature-item star-feature shake-attn">
            <span class="icon">🤖</span>
            <span class="text">
              <strong>AI 助理</strong>(業界首創)<br />
              <span class="sub">玩家直接問 AI,自動讀血盟 DB 設定 + FAQ 知識庫回答,新人不用追著會長問</span>
            </span>
          </li>
          <li class="feature-item star-feature">
            <span class="icon">💬</span>
            <span class="text">
              <strong>Discord 即時整合</strong>(全網首家)<br />
              <span class="sub">開單 / 結算 / 成交即時推到血盟頻道，訊息可點擊跳回，血盟成員再也不會漏看</span>
            </span>
          </li>
          <li class="feature-item star-feature">
            <span class="icon">📈</span>
            <span class="text">
              <strong>道具價格走勢圖</strong><br />
              <span class="sub">歷史成交價多幣別折線圖 + 趨勢分析，告別亂喊天價，出價有依據</span>
            </span>
          </li>
          <li class="feature-item star-feature">
            <span class="icon">🔔</span>
            <span class="text">
              <strong>三層通知防漏單</strong><br />
              <span class="sub">站內通知中心 + Discord 頻道 + FCM 手機推播，人在哪都接得到</span>
            </span>
          </li>
        </ul>

        <div class="sub-divider">✨ 加上以下保障</div>

        <ul class="features-list">
          <li class="feature-item highlight-feature">
            <span class="icon">❌</span>
            <span class="text"><strong>完全零抽成</strong> (您的分紅，系統不會有任何介入)</span>
          </li>
          <li class="feature-item">
            <span class="icon">✅</span> <span class="text">專屬客製化需求諮詢評估</span>
          </li>
          <li class="feature-item">
            <span class="icon">✅</span> <span class="text">系統異常排查與問題修復支援</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
  <div
    v-if="isLoginPage && showUsageImage"
    class="image-modal-overlay"
    @click="showUsageImage = false"
  >
    <div class="image-modal-container" @click.stop>
      <button class="close-btn" @click="showUsageImage = false">✕</button>
      <img src="@/assets/core_logic_pic.png" alt="核心用法教學" class="usage-image" />
    </div>
  </div>

  <div v-if="isLoginPage && showLineQR" class="image-modal-overlay" @click="showLineQR = false">
    <div class="image-modal-container" @click.stop>
      <img
        src="https://qr-official.line.me/gs/M_920wuugp_GW.png?oat_content=qr"
        alt="加入 LINE 聯絡我們"
        class="usage-image"
        style="background-color: white; padding: 15px"
      />
    </div>
  </div>

  <!-- 功能說明彈窗 -->
  <div
    v-if="isLoginPage && showFeaturesModal"
    class="image-modal-overlay"
    @click="showFeaturesModal = false"
  >
    <div class="features-modal-container" @click.stop>
      <button class="features-close-btn" @click="showFeaturesModal = false">✕</button>

      <div class="features-scroll">
        <div class="features-header">
          <h2>🚀 Diamond Core 功能總覽</h2>
          <p>一站式血盟管理解決方案</p>
        </div>

        <div class="features-grid">
          <div
            v-for="(cat, idx) in featureCategories"
            :key="idx"
            class="features-category"
            :class="{ 'shake-attn': cat.title.includes('AI') }"
            :style="{ '--cat-color': cat.color }"
          >
            <div class="features-category-title">{{ cat.title }}</div>
            <div class="features-category-list">
              <div v-for="(item, i) in cat.items" :key="i" class="features-item">
                <span class="features-item-icon">{{ item.icon }}</span>
                <div class="features-item-body">
                  <div class="features-item-name">{{ item.name }}</div>
                  <div class="features-item-desc">{{ item.desc }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="features-footer">
          <span>🛡️ 完全零抽成 &nbsp;·&nbsp; 🔄 WebSocket 即時同步 &nbsp;·&nbsp; 🔔 FCM 推播通知</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* --- 收費方式彈窗專屬樣式 --- */
.pricing-modal-container {
  position: relative;
  width: 90vw;
  max-width: 760px;
  max-height: 90vh;
  max-height: 90dvh;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.pricing-modal-container::-webkit-scrollbar {
  width: 6px;
}
.pricing-modal-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
}
@media (max-width: 600px) {
  .pricing-modal-container {
    width: 94vw;
    max-height: 92vh;
    max-height: 92dvh;
    padding: 20px 16px;
    border-radius: 18px;
  }
}

.pricing-header {
  text-align: center;
  margin-bottom: 25px;
}

.pricing-header h2 {
  color: #fff;
  font-size: 1.5rem;
  margin: 0 0 5px 0;
}

.pricing-header p {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0;
}

.trial-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, rgba(var(--c-light-rgb), 0.18), rgba(var(--c-deep-rgb), 0.10));
  border: 1px solid rgba(var(--c-light-rgb), 0.4);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(var(--c-deep-rgb), 0.12);
}
.trial-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px rgba(var(--c-light-rgb), 0.5));
}
.trial-text {
  flex: 1;
  min-width: 0;
}
.trial-title {
  color: #f1f5f9;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.3;
}
.trial-title strong {
  color: var(--c-light);
  font-weight: 900;
  letter-spacing: 0.5px;
}
.trial-sub {
  color: #94a3b8;
  font-size: 0.78rem;
  margin-top: 3px;
}

.pricing-cards {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
}

/* 手機版改為上下排列 */
@media (max-width: 600px) {
  .pricing-cards {
    flex-direction: column;
  }
}

.plan-card {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  position: relative;
  transition: transform 0.2s;
}

.plan-card:hover {
  transform: translateY(-3px);
}

.plan-title {
  color: #cbd5e1;
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 15px;
}

.plan-price {
  color: #fff;
  font-size: 2rem;
  font-weight: 900;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: baseline;
}

.currency {
  font-size: 1rem;
  margin-right: 4px;
  color: #94a3b8;
}

.period {
  font-size: 1rem;
  color: #64748b;
  font-weight: normal;
}

.plan-desc {
  color: #64748b;
  font-size: 0.85rem;
}

/* 100 人以上方案: 雙價格垂直排列 */
.plan-prices-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  margin-top: 4px;
}
.plan-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}
.plan-price-label {
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
}
.plan-price-stack-amount {
  color: #fff;
  font-size: 1.2rem;
  font-weight: 900;
}
.plan-price-stack-amount .currency {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-right: 3px;
}

/* 年繳高亮樣式 */
.plan-card.highlight {
  background: linear-gradient(145deg, #1e1e2f, #181825);
  border: 1px solid var(--c-mid);
  box-shadow: 0 0 20px rgba(var(--c-light-rgb), 0.15);
}

.text-gold {
  color: var(--c-mid) !important;
}

.save-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
  font-size: 0.8rem;
  font-weight: bold;
  padding: 4px 12px;
  border-radius: 20px;
  white-space: nowrap;
}

/* 服務列表樣式 */
.features-section {
  background: #0f172a;
  border-radius: 12px;
  padding: 20px;
}

.features-section h3 {
  color: #e2e8f0;
  font-size: 1rem;
  margin: 0 0 15px 0;
  text-align: center;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: #cbd5e1;
  font-size: 0.95rem;
  line-height: 1.4;
}

.feature-item.highlight-feature {
  color: #fff;
}

.feature-item .icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

/* 業界首見賣點區 — 視覺更突出 (主題色漸層邊框 + 大 icon) */
.features-section.unique-section {
  background: linear-gradient(
    135deg,
    rgba(var(--c-light-rgb), 0.1),
    rgba(var(--c-deep-rgb), 0.05)
  );
  border: 1px solid rgba(var(--c-light-rgb), 0.35);
  margin-bottom: 14px;
}
.features-section.unique-section h3 {
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.4);
}
.feature-item.star-feature {
  align-items: flex-start;
  gap: 14px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(var(--c-light-rgb), 0.15);
}
.feature-item.star-feature:last-child {
  border-bottom: none;
}
.feature-item.star-feature .icon {
  font-size: 1.6rem;
  filter: drop-shadow(0 0 8px rgba(var(--c-light-rgb), 0.5));
  margin-top: 2px;
}
.feature-item.star-feature .text {
  flex: 1;
  line-height: 1.5;
}
.feature-item.star-feature .text strong {
  color: var(--c-light);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.3px;
}
.feature-item.star-feature .sub {
  display: block;
  color: #94a3b8;
  font-size: 0.82rem;
  margin-top: 4px;
  line-height: 1.55;
}

/* 業界首見區內部分隔 — 招牌功能 vs 服務承諾 */
.sub-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 12px;
  font-size: 0.82rem;
  color: var(--c-light);
  font-weight: 700;
  letter-spacing: 0.5px;
}
.sub-divider::before,
.sub-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    rgba(var(--c-light-rgb), 0.3),
    transparent
  );
}

/* --- 圖片彈窗樣式 --- */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background-color: rgba(0, 0, 0, 0.85); /* 半透明黑底 */
  backdrop-filter: blur(5px); /* 背景模糊化，增加質感 */
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  box-sizing: border-box;
  z-index: 10000; /* 確保在最上層，蓋過導覽列 */
}

.image-modal-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.2s ease-out;
}

.usage-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain; /* 確保圖片不變形 */
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.close-btn {
  position: absolute;
  top: -40px; /* 放在圖片右上角外面 */
  right: 0;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 2rem;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* --- 功能說明彈窗樣式 --- */
.features-modal-container {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 92vw;
  max-width: 780px;
  max-height: 88vh;
  /* dvh 處理手機 URL bar 動態高度 */
  max-height: 88dvh;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  color: #e2e8f0;
  overflow: hidden; /* close 按鈕在邊緣，內層才滾 */
}

/* 內層真正捲的容器 */
.features-scroll {
  flex: 1;
  min-height: 0; /* flex item 可縮 */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 32px 28px 24px;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
}
.features-scroll::-webkit-scrollbar {
  width: 6px;
}
.features-scroll::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}

.features-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(15, 17, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 10;
  -webkit-tap-highlight-color: transparent;
}
.features-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}

.features-header {
  text-align: center;
  margin-bottom: 24px;
}
.features-header h2 {
  margin: 0 0 6px;
  font-size: 1.55rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--c-mid), #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.features-header p {
  margin: 0;
  font-size: 0.88rem;
  color: #94a3b8;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.features-category {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-top: 3px solid var(--cat-color);
  border-radius: 12px;
  padding: 14px 14px 10px;
}
.features-category-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--cat-color);
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}
.features-category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.features-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.15s;
}
.features-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.features-item-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 1px;
}
.features-item-body {
  flex: 1;
  min-width: 0;
}
.features-item-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 2px;
}
.features-item-desc {
  font-size: 0.74rem;
  color: #94a3b8;
  line-height: 1.4;
}

.features-footer {
  text-align: center;
  padding: 12px 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: #64748b;
  font-size: 0.78rem;
}

@media (max-width: 640px) {
  .features-modal-container {
    width: 96vw;
    max-height: 92dvh;
    border-radius: 16px;
  }
  .features-scroll {
    padding: 48px 16px 18px; /* 上方留空給 close 按鈕，避免重疊 */
  }
  .features-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .features-header h2 {
    font-size: 1.25rem;
  }
}

/* === 抖動動畫 — 給「業界首創 AI 助理」的吸睛標榜 === */
@keyframes shake-attention {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  8%       { transform: translateX(-3px) rotate(-1.5deg); }
  16%      { transform: translateX(3px) rotate(1.5deg); }
  24%      { transform: translateX(-2px) rotate(-1deg); }
  32%      { transform: translateX(2px) rotate(1deg); }
  40%      { transform: translateX(-1px) rotate(-0.5deg); }
  48%      { transform: translateX(1px) rotate(0.5deg); }
  56%, 100% { transform: translateX(0) rotate(0deg); }
}
.shake-attn {
  animation: shake-attention 2.4s cubic-bezier(.36,.07,.19,.97) infinite;
  transform-origin: center;
  will-change: transform;
}
.features-category.shake-attn {
  box-shadow: 0 0 22px rgba(168, 85, 247, 0.35);
  border-color: rgba(168, 85, 247, 0.45);
}
@media (prefers-reduced-motion: reduce) {
  .shake-attn { animation: none; }
}

/* --- 底部固定導覽樣式 --- */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 25px 0;
  width: auto;
  max-width: 100vw;
  z-index: 9999;
  background: transparent;
  box-sizing: border-box;
}

.nav-link {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.18s,
    text-shadow 0.18s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  padding: 5px 10px;
}

.nav-link:hover {
  color: var(--c-light);
  text-shadow: 0 0 8px rgba(var(--c-light-rgb), 0.4);
}

.divider {
  width: 1px;
  height: 12px;
  background-color: #334155;
  flex-shrink: 0;
}

/* 手機:緊湊 + 取消分隔線 */
@media (max-width: 480px) {
  .bottom-nav {
    left: 0;
    right: 0;
    transform: none;
    width: 100%;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-around;
    gap: 0;
    padding: 12px 4px;
    box-sizing: border-box;
  }
  .nav-link {
    flex: 1 1 0;
    min-width: 0;
    display: inline-flex;
    justify-content: center;
    font-size: 0.78rem;
    padding: 4px 4px;
    white-space: nowrap;
  }
  .divider {
    display: none;
  }
}

/* --- 基本佈局樣式 --- */
header {
  line-height: 1.5;
  max-height: 100vh;
}
.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }
  .logo {
    margin: 0 2rem 0 0;
  }
  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

<style>
/* 手機版全局優化 */
@media (max-width: 768px) {
  header {
    display: none !important;
  }
  #app {
    padding: 0 !important;
    margin: 0 !important;
    min-height: 100vh !important;
    box-sizing: border-box !important;
  }
}
</style>
