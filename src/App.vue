<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'

const route = useRoute()
// 新增：控制收費方式彈窗顯示狀態的變數
const showPricingModal = ref(false)
// 控制圖片彈窗顯示狀態的變數
const showUsageImage = ref(false)
// 新增：控制 LINE QR Code 彈窗顯示狀態的變數
const showLineQR = ref(false)

const isLoginPage = computed(() => {
  return route.name === 'login' // 對應你 router 裡的 name: 'login'
})
</script>

<template>
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

      <div class="pricing-cards">
        <div class="plan-card">
          <div class="plan-title">月繳方案</div>
          <div class="plan-price">
            <span class="currency">NT$</span>2,000<span class="period"> / 月</span>
          </div>
          <div class="plan-desc">單一工會授權</div>
        </div>

        <div class="plan-card highlight">
          <div class="save-badge">節省 NT$ 4,000</div>
          <div class="plan-title text-gold">年繳方案</div>
          <div class="plan-price">
            <span class="currency text-gold">NT$</span>20,000<span class="period"> / 年</span>
          </div>
          <div class="plan-desc">單一工會授權</div>
        </div>
      </div>

      <div class="features-section">
        <h3>✨ 所有方案皆包含以下核心服務</h3>
        <ul class="features-list">
          <li class="feature-item highlight-feature">
            <span class="icon">❌</span>
            <span class="text"><strong>完全零抽成</strong> (您的分紅，系統不會有任何的介入)</span>
          </li>
          <li class="feature-item">
            <span class="icon">✅</span> <span class="text">提供技術諮詢與架構建議</span>
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
</template>

<style scoped>
/* --- 收費方式彈窗專屬樣式 --- */
.pricing-modal-container {
  position: relative;
  width: 90vw;
  max-width: 600px;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
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

/* 年繳高亮樣式 */
.plan-card.highlight {
  background: linear-gradient(145deg, #1e1e2f, #181825);
  border: 1px solid #f5c451;
  box-shadow: 0 0 20px rgba(245, 196, 81, 0.15);
}

.text-gold {
  color: #f5c451 !important;
}

.save-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #f5c451, #f59e0b);
  color: #000;
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

/* --- 圖片彈窗樣式 --- */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.85); /* 半透明黑底 */
  backdrop-filter: blur(5px); /* 背景模糊化，增加質感 */
  display: flex;
  justify-content: center;
  align-items: center;
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
  z-index: 9999;
  background: transparent;
}

.nav-link {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  padding: 5px 10px;
}

.nav-link:hover {
  color: #6366f1;
  text-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.divider {
  margin-top: 25px;
  width: 1px;
  height: 12px;
  background-color: #334155;
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
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 100vh !important;
    padding: 20px !important;
    box-sizing: border-box !important;
  }
}
</style>
